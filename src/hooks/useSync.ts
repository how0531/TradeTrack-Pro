
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
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
    db: any; // Firestore instance type is complex, keeping as any or could use Firestore type if imported
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
                
                if (syncStatusRef.current === 'saving') return; 

                const localData = dataRef.current;
                
                // CASE 1: Auto-Restore (Local is empty, Cloud has data)
                if (localData.trades.length === 0 && cloudData.trades && cloudData.trades.length > 0) {
                     onPull(cloudData);
                     setSyncStatus('synced');
                     setLastBackupTime(cloudData.lastUpdated?.toDate());
                     if (cloudData.lastUpdated) {
                         setLastSyncTimeStr(cloudData.lastUpdated.toDate().toISOString());
                     }
                } 
                // CASE 2: Conflict Detection
                else if (localData.trades.length > 0 && cloudData.trades) {
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
                        if (!lastBackupTimeRef.current) {
                             setIsSyncModalOpen(true);
                        } else {
                             const cloudTime = cloudData.lastUpdated?.toDate().getTime();
                             const localTime = lastBackupTimeRef.current.getTime();
                             if (cloudTime && cloudTime > localTime + 5000) {
                                 setIsSyncModalOpen(true);
                             } else {
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

    return {
        isSyncing,
        syncStatus,
        lastBackupTime,
        isSyncModalOpen,
        setIsSyncModalOpen,
        triggerCloudBackup,
        setSyncStatus,
        setLastSyncTimeStr // Exposed for manual conflict resolution overrides
    };
};
