import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useIndexedDBData } from '../hooks/useIndexedDBData';
import { useSync } from '../hooks/useSync';
import { useMetrics } from '../hooks/useMetrics';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { detectDuplicates, mergeDuplicates, DuplicateGroup, DetectionOptions } from '../utils/duplicateDetection';
import { safeDateParse } from '../utils/calculations';
import { Trade, Portfolio, Metrics, Frequency, TimeRange, SyncStatus, RiskStreaks, Translation, Streaks, BrokerConfig, AutoSyncParams } from '../types';
import { db, resetFirestoreCache } from '../firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { I18N, THEME } from '../constants';
import { preemptiveWake } from '../services/backendGateway';

interface TradeContextType {
    // Data
    trades: Trade[];
    strategies: string[];
    emotions: string[];
    portfolios: Portfolio[];

    // UI State & Filters
    activePortfolioIds: string[];
    setActivePortfolioIds: React.Dispatch<React.SetStateAction<string[]>>;
    currentMonth: Date;
    setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
    filterStrategy: string[];
    setFilterStrategy: React.Dispatch<React.SetStateAction<string[]>>;
    filterEmotion: string[];
    setFilterEmotion: React.Dispatch<React.SetStateAction<string[]>>;
    timeRange: TimeRange;
    setTimeRange: React.Dispatch<React.SetStateAction<TimeRange>>;
    frequency: Frequency;
    setFrequency: React.Dispatch<React.SetStateAction<Frequency>>;
    customRange: { start: string | null; end: string | null };
    setCustomRange: React.Dispatch<React.SetStateAction<{ start: string | null; end: string | null }>>;
    isDatePickerOpen: boolean;
    setIsDatePickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isFilterOpen: boolean;
    setIsFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;

    // Preferences
    lang: 'zh' | 'en';
    setLang: React.Dispatch<React.SetStateAction<'zh' | 'en'>>;
    hideAmounts: boolean;
    setHideAmounts: React.Dispatch<React.SetStateAction<boolean>>;
    ddThreshold: number;
    setDdThreshold: React.Dispatch<React.SetStateAction<number>>;
    maxLossStreak: number;
    setMaxLossStreak: React.Dispatch<React.SetStateAction<number>>;
    chartHeight: number;
    setChartHeight: React.Dispatch<React.SetStateAction<number>>;
    lossColor: string;
    setLossColor: React.Dispatch<React.SetStateAction<string>>;

    // Broker Accounts
    brokerConfigs: BrokerConfig[];
    activeBrokerId: string;
    setActiveBrokerId: React.Dispatch<React.SetStateAction<string>>;
    updateBrokerConfig: (id: string, config: BrokerConfig) => void;
    addBrokerConfig: (config: BrokerConfig) => void;
    deleteBrokerConfig: (id: string) => void;
    activeBrokerConfig: BrokerConfig | null;


    // Metrics
    filteredTrades: Trade[];
    metrics: Metrics;
    streaks: Streaks;
    riskStreaks: RiskStreaks;
    dailyPnlMap: Record<string, number>;
    availableStrategies: string[];
    availableEmotions: string[];

    // Sync
    isSyncing: boolean;
    syncStatus: SyncStatus;
    lastBackupTime: Date | null;
    triggerCloudBackup: () => Promise<{ success: boolean, error?: string }>;
    manualPull: () => Promise<{ success: boolean, error?: string }>;
    syncError: string | null;
    repairDatabase: () => Promise<void>;
    isSyncModalOpen: boolean;
    onResolveSyncConflict: (choice: 'cloud' | 'local' | 'merge') => Promise<void>;
    conflictStats: { localCount: number; cloudCount: number; duplicateCount: number } | null;

    // Actions
    actions: {
        saveTrade: (trade: Trade, editingId: string | null) => void;
        saveTrades: (trades: (Omit<Trade, 'id' | 'timestamp'> & { id?: string; timestamp?: string })[]) => void;
        deleteTrade: (id: string) => void;
        updatePortfolio: (id: string, key: keyof Portfolio, value: string | number) => void;
        addPortfolio: (portfolio: Portfolio) => void;
        deletePortfolio: (id: string) => void;
        addStrategy: (s: string) => void;
        addEmotion: (e: string) => void;
        deleteStrategy: (s: string) => void;
        deleteEmotion: (e: string) => void;
        clearLocalData: () => void;
        downloadBackup: () => void;
        resetAllData: (t: Translation) => Promise<void>;
        handleImportJSON: (e: React.ChangeEvent<HTMLInputElement>, t: Translation) => void;
        resolveImportConflict: (choice: 'merge' | 'overwrite') => void;
        isImportModalOpen: boolean;
        detectDuplicates: (options?: DetectionOptions) => DuplicateGroup[];
        removeDuplicates: () => void;
    };

    // Auth (exposed for settings)
    authStatus: string;
    user: any; // Keep generic for now if User type has issues, or switch to User | null
    login: () => void;
    logout: () => void;

    // Translation
    t: Translation;

    // Auto Execution
    autoSyncParams: AutoSyncParams | null;
    setAutoSyncParams: React.Dispatch<React.SetStateAction<AutoSyncParams | null>>;
}

const TradeContext = createContext<TradeContextType | undefined>(undefined);

export const TradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // 🔥 Layer 1: App 載入時背景預先喚醒後端（不 block UI）
    preemptiveWake();

    // 1. Auth
    const { user, status: authStatus, login, logout } = useAuth();

    // 2. Local Data
    const {
        trades, strategies, emotions, portfolios,
        activePortfolioIds, setActivePortfolioIds,
        lossColor, setLossColor, actions: localActions,
        // Exposed setters for Sync
        setTrades, setStrategies, setEmotions, setPortfolios
    } = useIndexedDBData();

    // 4. Preferences (Lifted from App.tsx)
    const [lang, setLang] = useLocalStorage<'zh' | 'en'>('app_lang', 'zh');
    const [hideAmounts, setHideAmounts] = useLocalStorage<boolean>('app_hide_amounts', false);
    const [ddThreshold, setDdThreshold] = useLocalStorage<number>('app_dd_threshold', 20);
    const [maxLossStreak, setMaxLossStreak] = useLocalStorage<number>('app_max_loss_streak', 3);
    const [chartHeight, setChartHeight] = useLocalStorage<number>('app_chart_height', 220);

    // 2.1 Multi-Broker Support
    const [rawBrokerConfigs, setBrokerConfigs] = useLocalStorage<BrokerConfig[]>('broker_configs', []);
    const brokerConfigs = useMemo(() => Array.isArray(rawBrokerConfigs) ? rawBrokerConfigs.filter(c => c && typeof c === 'object') : [], [rawBrokerConfigs]);
    const [activeBrokerId, setActiveBrokerId] = useLocalStorage<string>('active_broker_id', '');

    // Migration Logic
    useEffect(() => {
        try {
            const legacy = localStorage.getItem('broker_config');
            const current = localStorage.getItem('broker_configs');

            // Only migrate if legacy exists AND current (new) config is missing
            if (legacy && !current) {
                console.log('🔄 Performing Broker Config Migration...');
                const parsed = JSON.parse(legacy);
                const initial: BrokerConfig = {
                    ...parsed,
                    id: parsed.id || Math.random().toString(36).substr(2, 9),
                    alias: parsed.alias || '',
                    isConnected: false // Reset connection on migration
                };
                setBrokerConfigs([initial]);
                setActiveBrokerId(initial.id);
                // We keep the legacy key for backup safety, or rename it
                localStorage.setItem('broker_config_backup', legacy);
                localStorage.removeItem('broker_config');
            }
        } catch (e) {
            console.error("Broker config migration error", e);
        }
    }, []); // Run once on mount to avoid race conditions with state updates


    // Broker Config Actions
    const addBrokerConfig = useCallback((config: BrokerConfig) => {
        setBrokerConfigs(prev => [...prev, config]);
    }, [setBrokerConfigs]);

    const updateBrokerConfig = useCallback((id: string, updatedConfig: BrokerConfig) => {
        setBrokerConfigs(prev => prev.map(config => config.id === id ? { ...config, ...updatedConfig } : config));
    }, [setBrokerConfigs]);

    const deleteBrokerConfig = useCallback((id: string) => {
        setBrokerConfigs(prev => prev.filter(config => config.id !== id));
        if (activeBrokerId === id) {
            setActiveBrokerId(''); // Clear active if deleted
        }
    }, [setBrokerConfigs, activeBrokerId, setActiveBrokerId]);

    const activeBrokerConfig = useMemo(() => {
        if (!Array.isArray(brokerConfigs)) return null;
        return brokerConfigs.find(config => config.id === activeBrokerId) || null;
    }, [brokerConfigs, activeBrokerId]);

    // UI State & Filters
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [filterStrategy, setFilterStrategy] = useState<string[]>([]);
    const [filterEmotion, setFilterEmotion] = useState<string[]>([]);
    const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
    const [frequency, setFrequency] = useState<Frequency>('daily');
    const [customRange, setCustomRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [autoSyncParams, setAutoSyncParams] = useState<AutoSyncParams | null>(null);

    // 5. Sync Logic
    const {
        isSyncing, syncStatus, syncError, lastBackupTime, isSyncModalOpen, setIsSyncModalOpen,
        triggerCloudBackup, manualPull, setLastSyncTimeStr, setSyncStatus, conflictStats
    } = useSync({
        user,
        authStatus,
        db,
        data: { trades, strategies, emotions, portfolios, lossColor },
        onPull: async (patches) => {
            // 增量合併：upsert 差異記錄，而非全量覆蓋
            if (patches.trades && patches.trades.length > 0) {
                // 將所有 patch trade 寫入 IndexedDB (bulkPut = upsert)
                // 軟刪除的記錄也會寫入，因為 useLiveQuery 已設定過濾掉 isDeleted:true
                await localActions.saveTrades(
                    patches.trades.map(t => ({
                        ...t,
                        updatedAt: t.updatedAt || new Date().toISOString(),
                        isDeleted: t.isDeleted ?? false,
                    }))
                );
            }
            if (patches.strategies) setStrategies(patches.strategies);
            if (patches.emotions) setEmotions(patches.emotions);
            if (patches.portfolios) {
                setPortfolios(patches.portfolios);
                setActivePortfolioIds(patches.portfolios.map((p: any) => p.id));
            }
            if (patches.settings?.lossColor) setLossColor(patches.settings.lossColor);
        }
    });

    // 6. Metrics Calculation
    const { filteredTrades, metrics, streaks, riskStreaks, dailyPnlMap } = useMetrics(
        trades, portfolios, activePortfolioIds, frequency, lang, customRange, filterStrategy, filterEmotion, timeRange
    );

    // 7. Computed Lists
    const availableStrategies = useMemo(() => {
        const tradeSet = new Set(trades.map(t => t.strategy).filter((s): s is string => !!s && s.trim() !== ''));
        strategies.forEach(s => tradeSet.add(s));
        return Array.from(tradeSet).sort();
    }, [trades, strategies]);

    const availableEmotions = useMemo(() => {
        const tradeSet = new Set(trades.map(t => t.emotion).filter((e): e is string => !!e && e.trim() !== ''));
        emotions.forEach(e => tradeSet.add(e));
        return Array.from(tradeSet).sort();
    }, [trades, emotions]);

    // 8. Import/Export State & Handlers (Refactored from old useTradeData)
    const [pendingImport, setPendingImport] = useState<any>(null);

    const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>, t: Translation) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (trades.length > 0) {
                    setPendingImport(data);
                } else {
                    // Direct Import
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

                    // 檢查是否啟用「匯入後自動合併」
                    const autoMerge = localStorage.getItem('auto_merge_on_import') === 'true';

                    // 自動檢測重複並提示合併
                    setTimeout(() => {
                        const duplicates = detectDuplicates(data.trades || []);
                        if (duplicates.length > 0) {
                            const total = duplicates.reduce((sum, group) => sum + group.duplicates.length, 0);

                            // 若啟用自動合併，直接合併不詢問
                            if (autoMerge) {
                                const cleaned = mergeDuplicates(data.trades, duplicates);
                                setTrades(cleaned);
                                alert(
                                    lang === 'zh'
                                        ? `匯入完成！已自動合併 ${total} 筆重複交易。`
                                        : `Import complete! Auto-merged ${total} duplicates.`
                                );
                            } else {
                                // 未啟用則詢問使用者
                                if (window.confirm(
                                    lang === 'zh'
                                        ? `匯入完成！檢測到 ${total} 筆重複交易，是否要合併？`
                                        : `Import complete! Found ${total} duplicates. Merge them?`
                                )) {
                                    const cleaned = mergeDuplicates(data.trades, duplicates);
                                    setTrades(cleaned);
                                }
                            }
                        } else {
                            alert(t.importSuccess);
                        }
                    }, 100);

                    setTimeout(triggerCloudBackup, 200);
                }
            } catch (err) {
                console.error(err);
                alert(t.importError);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const resolveImportConflict = (choice: 'merge' | 'overwrite') => {
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
            // MERGE LOGIC
            if (data.trades) {
                const tradeMap = new Map(trades.map(t => [t.id, t]));
                data.trades.forEach((t: Trade) => tradeMap.set(t.id, t));
                const merged = Array.from(tradeMap.values()).sort((a, b) => safeDateParse(b.date).getTime() - safeDateParse(a.date).getTime());
                setTrades(merged);
            }
            if (data.strategies) {
                const merged = Array.from(new Set([...strategies, ...data.strategies]));
                setStrategies(merged);
            }
            if (data.emotions) {
                const merged = Array.from(new Set([...emotions, ...data.emotions]));
                setEmotions(merged);
            }
            if (data.portfolios && Array.isArray(data.portfolios)) {
                const portMap = new Map(portfolios.map(p => [p.id, p]));
                data.portfolios.forEach((p: Portfolio) => portMap.set(p.id, p));
                const merged = Array.from(portMap.values());
                setPortfolios(merged);

                const newActive = Array.from(new Set([...activePortfolioIds, ...data.portfolios.map((p: Portfolio) => p.id)]));
                setActivePortfolioIds(newActive);
            }
            if (data.settings && data.settings.lossColor) setLossColor(data.settings.lossColor);
        }
        setPendingImport(null);
        setTimeout(triggerCloudBackup, 0);
    };

    const resetAllData = async (t: Translation) => {
        console.log('🚀 Data Reset Started...');
        try {
            // Cloud Reset (Explicitly Clear)
            if (user && authStatus === 'online') {
                console.log('🧹 Clearing Cloud Data...');
                await setDoc(doc(db, 'users', user.uid), {
                    trades: [],
                    strategies: [],
                    emotions: [],
                    portfolios: [],
                    settings: { lossColor: THEME.DEFAULT_LOSS },
                    lastUpdated: new Date()
                });
                console.log('✅ Cloud Data Cleared');
            }

            // 2. Delete the entire IndexedDB database atomically
            //    This avoids triggering useLiveQuery observers table-by-table,
            //    which caused React re-renders on partial state → crash.
            console.log('🧹 Deleting IndexedDB (atomic)...');
            await indexedDB.deleteDatabase('TradeTrackDB');
            console.log('✅ IndexedDB Deleted');

            // 3. Clear all localStorage preferences
            localStorage.clear();

            // 4. Reload — DB will be recreated with defaults on next load
            window.location.reload();

        } catch (error) {
            console.error("Reset failed:", error);
            // Fallback: brute-force cleanup
            localStorage.clear();
            try { await indexedDB.deleteDatabase('TradeTrackDB'); } catch (_) {}
            window.location.reload();
        }
    };

    const onResolveSyncConflict = async (choice: 'cloud' | 'local' | 'merge') => {
        if (choice === 'cloud') {
            // Use cloud version: pull cloud data and overwrite local
            await manualPull();
        } else if (choice === 'local') {
            // Use local version: push local to cloud
            await triggerCloudBackup();
        } else {
            // Smart merge: combine both sides by id, then dedup
            try {
                if (!user) {
                    setIsSyncModalOpen(false);
                    return;
                }
                const docSnap = await getDoc(doc(db, 'users', user.uid));
                const cloudTrades: Trade[] = docSnap.exists() ? (docSnap.data()?.trades || []) : [];
                const cloudPortfolios: Portfolio[] = docSnap.exists() ? (docSnap.data()?.portfolios || []) : [];
                const cloudStrategies: string[] = docSnap.exists() ? (docSnap.data()?.strategies || []) : [];
                const cloudEmotions: string[] = docSnap.exists() ? (docSnap.data()?.emotions || []) : [];

                // Merge trades by id (local takes priority for same id)
                const tradeMap = new Map<string, Trade>();
                cloudTrades.forEach(t => tradeMap.set(t.id, t));
                trades.forEach(t => tradeMap.set(t.id, t)); // Local overwrites cloud for same id
                const mergedTrades = Array.from(tradeMap.values());

                // Dedup
                const groups = detectDuplicates(mergedTrades);
                const cleanedTrades = groups.length > 0 ? mergeDuplicates(mergedTrades, groups) : mergedTrades;
                setTrades(cleanedTrades);

                // Merge portfolios by id
                const portfolioMap = new Map<string, Portfolio>();
                cloudPortfolios.forEach(p => portfolioMap.set(p.id, p));
                portfolios.forEach(p => portfolioMap.set(p.id, p));
                const mergedPortfolios = Array.from(portfolioMap.values());
                setPortfolios(mergedPortfolios);
                setActivePortfolioIds(mergedPortfolios.map(p => p.id));

                // Merge strategies & emotions (union)
                const mergedStrategies = Array.from(new Set([...cloudStrategies, ...strategies]));
                const mergedEmotions = Array.from(new Set([...cloudEmotions, ...emotions]));
                setStrategies(mergedStrategies);
                setEmotions(mergedEmotions);

                // Push merged result directly to cloud (avoid stale closure from triggerCloudBackup)
                // triggerCloudBackup reads `data` from its closure, but setTrades hasn't flushed yet.
                // So we push the merged data directly using setDoc.
                const now = new Date();
                const rawData = {
                    trades: cleanedTrades,
                    strategies: mergedStrategies,
                    emotions: mergedEmotions,
                    portfolios: mergedPortfolios,
                    settings: { lossColor },
                    lastUpdated: now
                };
                await setDoc(doc(db, 'users', user.uid), JSON.parse(JSON.stringify(rawData, (_, v) => v === undefined ? null : v)));
                setSyncStatus('synced');
                setLastSyncTimeStr(now.toISOString());
            } catch (error) {
                console.error('Smart merge failed:', error);
                // Fallback: just push local to cloud
                await triggerCloudBackup();
            }
        }
        setIsSyncModalOpen(false);
    };

    // Combine Actions
    const combinedActions = {
        ...localActions,
        resetAllData,
        handleImportJSON,
        resolveImportConflict,
        isImportModalOpen: !!pendingImport,
        // Wrap actions that should trigger sync
        saveTrade: (t: Trade, id: string | null) => { localActions.saveTrade(t, id); setTimeout(triggerCloudBackup, 0); },
        saveTrades: (ts: (Omit<Trade, 'id' | 'timestamp'> & { id?: string; timestamp?: string })[]) => { localActions.saveTrades(ts); setTimeout(triggerCloudBackup, 0); },
        deleteTrade: (id: string) => { localActions.deleteTrade(id); setTimeout(triggerCloudBackup, 0); },
        updatePortfolio: (id: string, k: keyof Portfolio, v: Portfolio[keyof Portfolio]) => { localActions.updatePortfolio(id, k, v); setTimeout(triggerCloudBackup, 0); },
        addPortfolio: (p: Portfolio) => {
            localActions.addPortfolio(p);
            // Optional: Auto-activate new portfolio
            setActivePortfolioIds(prev => [...prev, p.id]);
            setTimeout(triggerCloudBackup, 0);
        },
        deletePortfolio: (id: string) => {
            localActions.deletePortfolio(id);
            setActivePortfolioIds(prev => prev.filter(pid => pid !== id));
            setTimeout(triggerCloudBackup, 0);
        },
        addStrategy: (s: string) => { localActions.addStrategy(s); setTimeout(triggerCloudBackup, 0); },
        addEmotion: (e: string) => { localActions.addEmotion(e); setTimeout(triggerCloudBackup, 0); },
        deleteStrategy: (s: string) => { localActions.deleteStrategy(s); setTimeout(triggerCloudBackup, 0); },
        deleteEmotion: (e: string) => { localActions.deleteEmotion(e); setTimeout(triggerCloudBackup, 0); },
        // 重複交易檢測與合併
        detectDuplicates: (options?: DetectionOptions) => detectDuplicates(trades, options),
        removeDuplicates: () => {
            const duplicateGroups = detectDuplicates(trades);
            if (duplicateGroups.length === 0) return;
            const cleaned = mergeDuplicates(trades, duplicateGroups);
            setTrades(cleaned);
            setTimeout(triggerCloudBackup, 0);
        },
    };


    const value: TradeContextType = {
        trades, strategies, emotions, portfolios,
        activePortfolioIds, setActivePortfolioIds,
        currentMonth, setCurrentMonth,
        filterStrategy, setFilterStrategy,
        filterEmotion, setFilterEmotion,
        timeRange, setTimeRange,
        frequency, setFrequency,
        customRange, setCustomRange,
        isDatePickerOpen, setIsDatePickerOpen,
        isFilterOpen, setIsFilterOpen,
        lang, setLang,
        hideAmounts, setHideAmounts,
        ddThreshold, setDdThreshold,
        maxLossStreak, setMaxLossStreak,
        chartHeight, setChartHeight,
        lossColor, setLossColor,
        brokerConfigs,
        activeBrokerId,
        setActiveBrokerId,
        updateBrokerConfig,
        addBrokerConfig,
        deleteBrokerConfig,
        activeBrokerConfig,
        filteredTrades, metrics, streaks, riskStreaks, dailyPnlMap,
        availableStrategies, availableEmotions,
        isSyncing, syncStatus, lastBackupTime, triggerCloudBackup, manualPull, isSyncModalOpen, onResolveSyncConflict, conflictStats,
        syncError, repairDatabase: resetFirestoreCache,
        actions: combinedActions,
        authStatus, user, login, logout,
        t: I18N[lang] || I18N['zh'],
        autoSyncParams, setAutoSyncParams
    };

    return (
        <TradeContext.Provider value={value}>
            {children}
        </TradeContext.Provider>
    );
};

export const useTradeContext = () => {
    const context = useContext(TradeContext);
    if (context === undefined) {
        throw new Error('useTradeContext must be used within a TradeProvider');
    }
    return context;
};
