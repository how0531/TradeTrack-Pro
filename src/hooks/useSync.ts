
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, getDoc, onSnapshot, Timestamp, Firestore } from 'firebase/firestore';
import { useLocalStorage } from './useLocalStorage';
import { SyncStatus, User, Trade, Portfolio } from '../types';
import { stableStringify } from '../utils/storage';

interface SyncData {
    trades: Trade[];
    strategies: string[];
    emotions: string[];
    portfolios: Portfolio[];
    lossColor: string;
    settings?: { lossColor: string };
}

interface UseSyncProps {
    user: User | null;
    authStatus: string;
    db: Firestore; 
    data: SyncData;
    onPull: (data: Partial<SyncData> & { lastUpdated?: any }) => void; // Callback when data is pulled from cloud
}

export const useSync = ({ user, authStatus, db, data, onPull }: UseSyncProps) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
    const [lastBackupTime, setLastBackupTime] = useState<Date | null>(null);
    const [lastSyncTimeStr, setLastSyncTimeStr] = useLocalStorage<string>('app_last_sync_time', '');
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

    // Refs to prevent stale closures in onSnapshot
    const dataRef = useRef(data);
    const syncStatusRef = useRef(syncStatus);
    const lastBackupTimeRef = useRef(lastBackupTime);
    const lastSyncTimeStrRef = useRef(lastSyncTimeStr);
    const lastPullTimeRef = useRef<number>(0);

    useEffect(() => { dataRef.current = data; }, [data]);
    useEffect(() => { syncStatusRef.current = syncStatus; }, [syncStatus]);
    useEffect(() => { lastBackupTimeRef.current = lastBackupTime; }, [lastBackupTime]);
    useEffect(() => { lastSyncTimeStrRef.current = lastSyncTimeStr; }, [lastSyncTimeStr]);

    const triggerCloudBackup = useCallback(async (): Promise<boolean> => {
        if (!user || authStatus !== 'online') {
            setSyncStatus('offline');
            return false;
        }
        
        setSyncStatus('saving');
        try {
            const now = Timestamp.now();
            const dataToSave = {
                trades: data.trades,
                strategies: data.strategies,
                emotions: data.emotions,
                portfolios: data.portfolios,
                settings: { lossColor: data.lossColor },
                lastUpdated: now
            };
            
            await setDoc(doc(db, 'users', user.uid), dataToSave);
            
            setSyncStatus('synced');
            setLastBackupTime(new Date());
            setLastSyncTimeStr(now.toDate().toISOString());
            return true;
        } catch (e) {
            console.error("Backup failed", e);
            setSyncStatus('error');
            return false;
        }
    }, [user, authStatus, db, data, setLastSyncTimeStr]);

    // Initial Sync (Pull & Conflict Detection)
    useEffect(() => {
        if (!user || authStatus !== 'online') return;

        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const cloudData = docSnap.data();
                
                if (docSnap.metadata.hasPendingWrites) return; // Ignore local writes (latency compensation)
                
                // CRITICAL: Avoid race conditions if we are currently saving or just finished pulling/saving
                const now = Date.now();
                if (syncStatusRef.current === 'saving' || (now - lastPullTimeRef.current < 3000)) {
                    return; 
                }

                const localData = dataRef.current;
                
                // CASE 1: Auto-Restore (Local is empty, Cloud has data)
                if (localData.trades.length === 0 && cloudData.trades && cloudData.trades.length > 0) {
                     lastPullTimeRef.current = Date.now();
                     onPull(cloudData);
                     setSyncStatus('synced');
                     setLastBackupTime(cloudData.lastUpdated?.toDate());
                     if (cloudData.lastUpdated) {
                         setLastSyncTimeStr(cloudData.lastUpdated.toDate().toISOString());
                     }
                } 
                // CASE 2: Conflict Detection
                else if (localData.trades.length > 0 && cloudData.trades && !isSyncModalOpen) {
                    const cloudTimeStr = cloudData.lastUpdated?.toDate().toISOString();
                    const localTimeStr = lastSyncTimeStrRef.current;

                    if (cloudTimeStr && localTimeStr && cloudTimeStr === localTimeStr) {
                         setSyncStatus('synced');
                         setLastBackupTime(cloudData.lastUpdated?.toDate());
                         return;
                    }

                    const localStr = stableStringify(localData.trades);
                    const cloudStr = stableStringify(cloudData.trades);
                    
                    if (localStr !== cloudStr) {
                        // Relaxed Check: Only flag conflict if we have NO record of ever syncing, 
                        // AND we have local data.
                        const hasEverSynced = !!lastBackupTimeRef.current || !!lastSyncTimeStrRef.current;
                        
                        if (!hasEverSynced) {
                             setIsSyncModalOpen(true);
                        } else {
                             const cloudTime = cloudData.lastUpdated?.toDate().getTime();
                             // Use backup time OR parse the string from LS
                             const localTime = lastBackupTimeRef.current?.getTime() || (lastSyncTimeStrRef.current ? new Date(lastSyncTimeStrRef.current).getTime() : 0);
                             
                             // If cloud is significantly newer (>5s), and data differs -> Conflict
                             if (cloudTime && cloudTime > localTime + 5000) {
                                 setIsSyncModalOpen(true);
                             } else {
                                 // Otherwise, assume local is newer or equal (latency), or harmless drift.
                                 // Auto-resolve to 'synced' if we just saved or close enough.
                                 // Actually, if data differs and cloud is OLDER, efficient overwrite (we just saved).
                                 // If data differs and cloud is NEWER, we truly have a conflict?
                                 // But we just filtered cloudTime > localTime + 5000.
                                 // So here cloud is NOT significantly newer.
                                 setSyncStatus('synced');
                                 setLastBackupTime(cloudData.lastUpdated?.toDate());
                                 if (cloudData.lastUpdated) setLastSyncTimeStr(cloudData.lastUpdated.toDate().toISOString());
                             }
                        }

                    } else {
                        setSyncStatus('synced');
                        setLastBackupTime(cloudData.lastUpdated?.toDate());
                        if (cloudData.lastUpdated) setLastSyncTimeStr(cloudData.lastUpdated.toDate().toISOString());
                    }
                }
            }
        });

        return () => unsubscribe();
    }, [user, authStatus, db, onPull, setLastSyncTimeStr]);

    // Manual Pull: Force fetch and overwrite local
    const manualPull = useCallback(async (): Promise<boolean> => {
        if (!user || authStatus !== 'online') return false;
        setSyncStatus('saving'); // UI feedback
        try {
            const docSnap = await getDoc(doc(db, 'users', user.uid));
            if (docSnap.exists()) {
                const cloudData = docSnap.data();
                onPull(cloudData);
                setSyncStatus('synced');
                if (cloudData.lastUpdated) {
                    setLastSyncTimeStr(cloudData.lastUpdated.toDate().toISOString());
                    setLastBackupTime(cloudData.lastUpdated.toDate());
                }
                return true;
            }
            setSyncStatus('synced');
            return false;
        } catch (e) {
            console.error("Manual pull failed", e);
            setSyncStatus('error');
            return false;
        }
    }, [user, authStatus, db, onPull, setLastSyncTimeStr]);

    return {
        isSyncing,
        syncStatus,
        lastBackupTime,
        isSyncModalOpen,
        setIsSyncModalOpen,
        triggerCloudBackup,
        manualPull, // Export manual pull
        setSyncStatus,
        setLastSyncTimeStr // Exposed for manual conflict resolution overrides
    };
};
