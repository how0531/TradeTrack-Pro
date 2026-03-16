
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, getDoc, onSnapshot, Timestamp, Firestore } from 'firebase/firestore';
import { useLocalStorage } from './useLocalStorage';
import { SyncStatus, User, Trade, Portfolio } from '../types';
import { stableStringify } from '../utils/storage';
import { detectDuplicates } from '../utils/duplicateDetection';

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

// Utility to strip undefined values which causes Firestore setDoc to fail
const sanitizeForFirestore = (obj: any): any => {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        return value === undefined ? null : value;
    }));
};

/**
 * Robust date conversion utility for Firestore objects
 */
const parseFirestoreDate = (val: any): Date | null => {
    if (!val) return null;
    // 1. If it's already a Firestore Timestamp object
    if (typeof val.toDate === 'function') return val.toDate();
    // 2. If it's a plain Date object
    if (val instanceof Date) return val;
    // 3. If it looks like a raw Timestamp object {seconds, nanoseconds}
    if (val && typeof val === 'object' && typeof val.seconds === 'number') {
        try {
            return new Timestamp(val.seconds, val.nanoseconds || 0).toDate();
        } catch (e) {
            return new Date(val.seconds * 1000);
        }
    }
    // 4. ISO String or numeric timestamp
    if (typeof val === 'string' || typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
};

export const useSync = ({ user, authStatus, db, data, onPull }: UseSyncProps) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
    const [lastBackupTime, setLastBackupTime] = useState<Date | null>(null);
    const [lastSyncTimeStr, setLastSyncTimeStr] = useLocalStorage<string>('app_last_sync_time', '');
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [conflictStats, setConflictStats] = useState<{
        localCount: number; cloudCount: number; duplicateCount: number;
    } | null>(null);

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

    const triggerCloudBackup = useCallback(async (): Promise<{success: boolean, error?: string}> => {
        if (!user || authStatus !== 'online') {
            setSyncStatus('offline');
            return { success: false, error: 'User is offline' };
        }
        
        setSyncStatus('saving');
        try {
            const now = Timestamp.now();
            const rawData = {
                trades: data.trades,
                strategies: data.strategies,
                emotions: data.emotions,
                portfolios: data.portfolios,
                settings: { lossColor: data.lossColor },
                lastUpdated: now
            };
            
            const dataToSave = sanitizeForFirestore(rawData);
            await setDoc(doc(db, 'users', user.uid), dataToSave);
            
            lastPullTimeRef.current = Date.now();
            const timeDate = now.toDate();
            const timeStr = timeDate.toISOString();
            lastSyncTimeStrRef.current = timeStr; 

            setSyncStatus('synced');
            setSyncError(null);
            setLastBackupTime(timeDate);
            setLastSyncTimeStr(timeStr);
            return { success: true };
        } catch (e: any) {
            console.error("Backup failed", e);
            setSyncStatus('error');
            setSyncError(e.message || 'Unknown error');
            lastPullTimeRef.current = Date.now(); 
            return { success: false, error: e.message || 'Unknown error' };
        }
    }, [user, authStatus, db, data, setLastSyncTimeStr]);

    // Initial Sync (Pull & Conflict Detection)
    useEffect(() => {
        if (!user || authStatus !== 'online') return;

        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const cloudData = docSnap.data();
                if (docSnap.metadata.hasPendingWrites) return; 
                
                const now = Date.now();
                if (syncStatusRef.current === 'saving' || (now - lastPullTimeRef.current < 5000)) {
                    return; 
                }

                if (syncStatusRef.current === 'error') {
                    return;
                }

                const localData = dataRef.current;
                const cloudLastUpdated = parseFirestoreDate(cloudData.lastUpdated);
                
                if (localData.trades.length === 0 && cloudData.trades && cloudData.trades.length > 0) {
                     lastPullTimeRef.current = Date.now();
                     onPull(cloudData);
                     setSyncStatus('synced');
                     setLastBackupTime(cloudLastUpdated);
                     if (cloudLastUpdated) {
                         const timeStr = cloudLastUpdated.toISOString();
                         setLastSyncTimeStr(timeStr);
                         lastSyncTimeStrRef.current = timeStr; 
                     }
                } 
                else if (localData.trades.length > 0 && cloudData.trades && !isSyncModalOpen) {
                    const cloudTimeStr = cloudLastUpdated?.toISOString();
                    const localTimeStr = lastSyncTimeStrRef.current;

                    if (cloudTimeStr && localTimeStr && cloudTimeStr === localTimeStr) {
                         setSyncStatus('synced');
                         setLastBackupTime(cloudLastUpdated);
                         return;
                    }

                    const localStr = stableStringify(localData.trades);
                    const cloudStr = stableStringify(cloudData.trades);
                    
                    if (localStr !== cloudStr) {
                        const hasEverSynced = !!lastBackupTimeRef.current || !!lastSyncTimeStrRef.current;

                        // Calculate conflict stats for the modal preview
                        const allTrades = [...localData.trades, ...(cloudData.trades || [])];
                        const groups = detectDuplicates(allTrades);
                        const dupeCount = groups.reduce((s, g) => s + g.duplicates.length, 0);
                        setConflictStats({
                            localCount: localData.trades.length,
                            cloudCount: (cloudData.trades || []).length,
                            duplicateCount: dupeCount
                        });

                        if (!hasEverSynced) {
                             setIsSyncModalOpen(true);
                        } else {
                             const cloudTime = cloudLastUpdated?.getTime();
                             const localTime = lastBackupTimeRef.current?.getTime() || (lastSyncTimeStrRef.current ? new Date(lastSyncTimeStrRef.current).getTime() : 0);
                             
                             if (cloudTime && cloudTime > localTime + 10000) {
                                  setIsSyncModalOpen(true);
                             } else {
                                  setSyncStatus('synced');
                                  setLastBackupTime(cloudLastUpdated);
                                  if (cloudLastUpdated) {
                                      const timeStr = cloudLastUpdated.toISOString();
                                      setLastSyncTimeStr(timeStr);
                                      lastSyncTimeStrRef.current = timeStr; 
                                  }
                             }
                        }
                    } else {
                        setSyncStatus('synced');
                        setLastBackupTime(cloudLastUpdated);
                        if (cloudLastUpdated) {
                            const timeStr = cloudLastUpdated.toISOString();
                            setLastSyncTimeStr(timeStr);
                            lastSyncTimeStrRef.current = timeStr; 
                        }
                    }
                }
            }
        }, (err) => {
            console.error("onSnapshot error:", err);
            setSyncStatus('error');
            setSyncError(err.message || 'Permission denied or network issue');
        });

        return () => unsubscribe();
    }, [user, authStatus, db, onPull, setLastSyncTimeStr, isSyncModalOpen]);

    const manualPull = useCallback(async (): Promise<{success: boolean, error?: string}> => {
        if (!user || authStatus !== 'online') return { success: false, error: 'User is offline' };
        setSyncStatus('saving');
        try {
            const docSnap = await getDoc(doc(db, 'users', user.uid));
            if (docSnap.exists()) {
                const cloudData = docSnap.data();
                onPull(cloudData);
                lastPullTimeRef.current = Date.now();
                setSyncStatus('synced');
                setSyncError(null);
                
                const cloudLastUpdated = parseFirestoreDate(cloudData.lastUpdated);
                if (cloudLastUpdated) {
                    const timeStr = cloudLastUpdated.toISOString();
                    setLastSyncTimeStr(timeStr);
                    lastSyncTimeStrRef.current = timeStr; 
                    setLastBackupTime(cloudLastUpdated);
                }
                return { success: true };
            }
            setSyncStatus('synced');
            return { success: false, error: 'No cloud data found' };
        } catch (e: any) {
            console.error("Manual pull failed", e);
            setSyncStatus('error');
            setSyncError(e.message || 'Unknown error');
            lastPullTimeRef.current = Date.now();
            return { success: false, error: e.message || 'Unknown error' };
        }
    }, [user, authStatus, db, onPull, setLastSyncTimeStr]);

    return {
        isSyncing,
        syncStatus,
        syncError,
        lastBackupTime,
        isSyncModalOpen,
        setIsSyncModalOpen,
        triggerCloudBackup,
        manualPull, 
        setSyncStatus,
        setLastSyncTimeStr,
        conflictStats
    };
};
