
// [Manage] Last Updated: 2024-05-22
import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, getDoc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { Trade, Portfolio, SyncStatus, User } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { DEFAULT_PALETTE, THEME } from '../constants';
import { downloadJSON } from '../utils/storage';

const INITIAL_PORTFOLIO: Portfolio = { id: 'main', name: 'Main Account', initialCapital: 100000, profitColor: THEME.RED, lossColor: THEME.DEFAULT_LOSS };

export const useTradeData = (user: User | null, authStatus: string, db: any, config: any) => {
    // Local State (Single Source of Truth for UI)
    const [trades, setTrades] = useLocalStorage<Trade[]>('local_trades', []);
    const [strategies, setStrategies] = useLocalStorage<string[]>('local_strategies', ['動能突破', '急殺抄底', '波段趨勢']);
    // UPDATED: Default to Trade Types instead of Mindsets
    const [emotions, setEmotions] = useLocalStorage<string[]>('local_emotions', ['短線', '事件', '產業', '波段']);
    const [portfolios, setPortfolios] = useLocalStorage<Portfolio[]>('local_portfolios', [INITIAL_PORTFOLIO]);
    
    // UI State
    const [activePortfolioIds, setActivePortfolioIds] = useLocalStorage<string[]>('app_active_portfolios', ['main']);
    const [lossColor, setLossColor] = useLocalStorage<string>('app_loss_color', THEME.DEFAULT_LOSS);
    
    // Sync State
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
    const [lastBackupTime, setLastBackupTime] = useState<Date | null>(null);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

    // Import State
    const [pendingImport, setPendingImport] = useState<any>(null);

    // --- Sync Logic (Memoized) ---
    const triggerCloudBackup = useCallback(async () => {
        if (!user || authStatus !== 'online') {
            setSyncStatus('offline');
            return;
        }
        
        setSyncStatus('saving');
        try {
            const dataToSave = {
                trades,
                strategies,
                emotions,
                portfolios,
                settings: { lossColor },
                lastUpdated: Timestamp.now()
            };
            
            await setDoc(doc(db, 'users', user.uid), dataToSave);
            setSyncStatus('synced');
            setLastBackupTime(new Date());
        } catch (e) {
            console.error("Backup failed", e);
            setSyncStatus('error');
        }
    }, [user, authStatus, db, trades, strategies, emotions, portfolios, lossColor]);

    // --- Actions (Memoized) ---
    const actions = useMemo(() => ({
        saveTrade: (trade: Trade, editingId: string | null) => {
            if (editingId) {
                setTrades(prev => prev.map(t => t.id === editingId ? { ...trade, id: editingId } : t));
            } else {
                const newTrade = { ...trade, id: `trade-${Date.now()}`, timestamp: new Date().toISOString() };
                setTrades(prev => [newTrade, ...prev]);
            }
            setTimeout(triggerCloudBackup, 0); 
        },

        deleteTrade: (id: string) => {
            setTrades(prev => prev.filter(t => t.id !== id));
            setTimeout(triggerCloudBackup, 0);
        },

        updatePortfolio: (id: string, key: keyof Portfolio, value: any) => {
            setPortfolios(prev => prev.map(p => p.id === id ? { ...p, [key]: value } : p));
            setTimeout(triggerCloudBackup, 0);
        },

        updateSettings: (key: string, value: any) => {
            if (key === 'portfolios') {
                const newPortfolios = value as Portfolio[];
                setPortfolios(newPortfolios);
                setActivePortfolioIds(prev => {
                   const newIds = newPortfolios.map(p => p.id);
                   const validActive = prev.filter(id => newIds.includes(id));
                   if (newIds.length > prev.length) return newIds; 
                   return validActive.length > 0 ? validActive : [newIds[0]];
                });
            }
            setTimeout(triggerCloudBackup, 0);
        },

        addStrategy: (s: string) => {
            if (!strategies.includes(s)) {
                setStrategies(prev => [...prev, s]);
                setTimeout(triggerCloudBackup, 0);
            }
        },

        addEmotion: (e: string) => {
            if (!emotions.includes(e)) {
                setEmotions(prev => [...prev, e]);
                setTimeout(triggerCloudBackup, 0);
            }
        },
        
        deleteStrategy: (s: string) => {
            setStrategies(prev => prev.filter(item => item !== s));
            setTimeout(triggerCloudBackup, 0);
        },

        deleteEmotion: (e: string) => {
            setEmotions(prev => prev.filter(item => item !== e));
            setTimeout(triggerCloudBackup, 0);
        },

        triggerCloudBackup,

        resetAllData: async (t: any) => {
            if (window.confirm(t.resetConfirm)) {
                try {
                    // 1. If logged in, wipe cloud data first
                    if (user && authStatus === 'online') {
                        const resetState = {
                            trades: [],
                            strategies: ['動能突破', '急殺抄底', '波段趨勢'],
                            emotions: ['短線', '事件', '產業', '波段'],
                            portfolios: [INITIAL_PORTFOLIO],
                            settings: { lossColor: THEME.DEFAULT_LOSS },
                            lastUpdated: Timestamp.now()
                        };
                        await setDoc(doc(db, 'users', user.uid), resetState);
                    }

                    // 2. Clear Local Storage
                    const keysToRemove = [
                        'local_trades', 'local_strategies', 'local_emotions', 'local_portfolios',
                        'app_active_portfolios', 'app_loss_color', 'app_lang', 
                        'app_hide_amounts', 'app_dd_threshold', 'app_max_loss_streak', 'app_chart_height'
                    ];
                    keysToRemove.forEach(k => localStorage.removeItem(k));

                    // 3. Force Reload
                    window.location.reload();

                } catch (error) {
                    console.error("Reset failed:", error);
                    alert("Cloud reset failed, performing local reset.");
                    localStorage.clear();
                    window.location.reload();
                }
            }
        },

        handleImportJSON: (e: React.ChangeEvent<HTMLInputElement>, t: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target?.result as string);
                    if (trades.length > 0) {
                        setPendingImport(data);
                    } else {
                        if (data.trades) setTrades(data.trades);
                        if (data.strategies) setStrategies(data.strategies);
                        if (data.emotions) setEmotions(data.emotions);
                        if (data.portfolios && Array.isArray(data.portfolios)) {
                            setPortfolios(data.portfolios);
                            const newIds = data.portfolios.map((p: any) => p.id);
                            setActivePortfolioIds(newIds);
                        }
                        if (data.settings && data.settings.lossColor) {
                            setLossColor(data.settings.lossColor);
                        }
                        alert(t.importSuccess);
                        setTimeout(triggerCloudBackup, 0);
                    }
                } catch (err) {
                    console.error(err);
                    alert(t.importError);
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        },

        resolveImportConflict: (choice: 'merge' | 'overwrite') => {
            if (!pendingImport) return;
            const data = pendingImport;

            if (choice === 'overwrite') {
                if (data.trades) setTrades(data.trades);
                if (data.strategies) setStrategies(data.strategies);
                if (data.emotions) setEmotions(data.emotions);
                if (data.portfolios && Array.isArray(data.portfolios)) {
                    setPortfolios(data.portfolios);
                    const newIds = data.portfolios.map((p: any) => p.id);
                    setActivePortfolioIds(newIds);
                }
                if (data.settings && data.settings.lossColor) {
                    setLossColor(data.settings.lossColor);
                }
            } else {
                if (data.trades) {
                    setTrades(prev => {
                        const tradeMap = new Map(prev.map(t => [t.id, t]));
                        data.trades.forEach((t: Trade) => tradeMap.set(t.id, t));
                        return Array.from(tradeMap.values()).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    });
                }
                if (data.strategies) setStrategies(prev => Array.from(new Set([...prev, ...data.strategies])));
                if (data.emotions) setEmotions(prev => Array.from(new Set([...prev, ...data.emotions])));
                if (data.portfolios && Array.isArray(data.portfolios)) {
                    setPortfolios(prev => {
                        const portMap = new Map(prev.map(p => [p.id, p]));
                        data.portfolios.forEach((p: Portfolio) => portMap.set(p.id, p));
                        return Array.from(portMap.values());
                    });
                    setActivePortfolioIds(prev => Array.from(new Set([...prev, ...data.portfolios.map((p:any) => p.id)])));
                }
                if (data.settings && data.settings.lossColor) setLossColor(data.settings.lossColor);
            }
            setPendingImport(null);
            setTimeout(triggerCloudBackup, 0);
        },

        resolveSyncConflict: (choice: 'merge' | 'discard') => {
            // Note: In a real implementation, we would need the 'cloudData' here.
            // For now, we trigger a re-fetch or push based on choice.
            if (choice === 'discard') {
                // Fetch cloud data and overwrite local
                getDoc(doc(db, 'users', user!.uid)).then(snap => {
                    if(snap.exists()) {
                        const data = snap.data();
                        setTrades(data.trades || []);
                        setStrategies(data.strategies || []);
                        setEmotions(data.emotions || []);
                        setPortfolios(data.portfolios || [INITIAL_PORTFOLIO]);
                        setSyncStatus('synced');
                    }
                });
            } else {
                // Merge is basically just triggering a backup of current local state
                // Firestore will overwrite, effectively "User wins"
                triggerCloudBackup();
            }
            setIsSyncModalOpen(false);
        },

        downloadBackup: () => downloadJSON({ trades, strategies, emotions, portfolios, settings: { lossColor } }),
        retrySync: triggerCloudBackup
    }), [trades, strategies, emotions, portfolios, lossColor, triggerCloudBackup, pendingImport, setTrades, setStrategies, setEmotions, setPortfolios, setActivePortfolioIds, user, authStatus, db]);


    // Initial Sync (Pull & Conflict Detection)
    useEffect(() => {
        if (!user || authStatus !== 'online') return;

        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // If we are currently saving, ignore the snapshot to prevent loops
                if (syncStatus === 'saving') return; 

                // CASE 1: Auto-Restore (Local is empty, Cloud has data)
                if (trades.length === 0 && data.trades && data.trades.length > 0) {
                     setTrades(data.trades);
                     setStrategies(data.strategies || []);
                     setEmotions(data.emotions || []);
                     setPortfolios(data.portfolios || [INITIAL_PORTFOLIO]);
                     if(data.portfolios) {
                        setActivePortfolioIds(data.portfolios.map((p:any) => p.id));
                     }
                     setSyncStatus('synced');
                     setLastBackupTime(data.lastUpdated?.toDate());
                } 
                // CASE 2: Conflict Detection (Local has data, Cloud has DIFFERENT data)
                // We only check this if we haven't just synced (lastBackupTime is null or old)
                else if (trades.length > 0 && data.trades) {
                    const localStr = JSON.stringify(trades);
                    const cloudStr = JSON.stringify(data.trades);
                    
                    if (localStr !== cloudStr) {
                        // Only trigger conflict modal if this is a fresh session (no lastBackupTime yet)
                        // This implies we logged in on a new device or refreshed, and data differs.
                        if (!lastBackupTime) {
                            setIsSyncModalOpen(true);
                        }
                    } else {
                        // Data matches, just update status
                        setSyncStatus('synced');
                        setLastBackupTime(data.lastUpdated?.toDate());
                    }
                }
            }
        });

        return () => unsubscribe();
    }, [user, authStatus, db]); // Removed 'trades' dependency to prevent loop, checking inside ref or assuming initial load logic

    return {
        trades, strategies, emotions, portfolios,
        activePortfolioIds, setActivePortfolioIds,
        lossColor, setLossColor,
        isSyncing, isSyncModalOpen, syncStatus, lastBackupTime,
        isImportModalOpen: !!pendingImport,
        actions
    };
};
