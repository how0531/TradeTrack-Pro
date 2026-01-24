import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocalData } from '../hooks/useLocalData';
import { useSync } from '../hooks/useSync';
import { useMetrics } from '../hooks/useMetrics';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Trade, Portfolio, Metrics, Frequency, TimeRange, SyncStatus, RiskStreaks, Translation, Streaks, BrokerConfig } from '../types';
import { doc, getDoc } from 'firebase/firestore'; 
import { I18N } from '../constants'; 

interface TradeContextType {
    // Data
    trades: Trade[];
    strategies: string[];
    emotions: string[];
    portfolios: Portfolio[];
    
    // UI State & Filters
    activePortfolioIds: string[];
    setActivePortfolioIds: (ids: string[]) => void;
    currentMonth: Date;
    setCurrentMonth: (d: Date) => void;
    filterStrategy: string[];
    setFilterStrategy: (s: string[]) => void;
    filterEmotion: string[];
    setFilterEmotion: (e: string[]) => void;
    timeRange: TimeRange;
    setTimeRange: (t: TimeRange) => void;
    frequency: Frequency;
    setFrequency: (f: Frequency) => void;
    customRange: { start: string | null; end: string | null };
    setCustomRange: (r: { start: string | null; end: string | null }) => void;
    isDatePickerOpen: boolean;
    setIsDatePickerOpen: (b: boolean) => void;
    isFilterOpen: boolean;
    setIsFilterOpen: (b: boolean) => void;

    // Preferences
    lang: 'zh' | 'en';
    setLang: (l: 'zh' | 'en') => void;
    hideAmounts: boolean;
    setHideAmounts: (b: boolean) => void;
    ddThreshold: number;
    setDdThreshold: (n: number) => void;
    maxLossStreak: number;
    setMaxLossStreak: (n: number) => void;
    chartHeight: number;
    setChartHeight: (h: number) => void;
    lossColor: string;
    setLossColor: (c: string) => void;
    
    // Broker Accounts
    brokerConfigs: BrokerConfig[];
    activeBrokerId: string;
    setActiveBrokerId: (id: string) => void;
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
    triggerCloudBackup: () => Promise<boolean>;
    isSyncModalOpen: boolean;
    onResolveSyncConflict: (choice: 'merge' | 'discard') => void;

    // Actions
    actions: {
        saveTrade: (trade: Trade, editingId: string | null) => void;
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
    };
    
    // Auth (exposed for settings)
    authStatus: string;
    user: any; // Keep generic for now if User type has issues, or switch to User | null
    login: () => void;
    logout: () => void;
    
    // Translation
    t: Translation;
}

const TradeContext = createContext<TradeContextType | undefined>(undefined);

export const TradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // 1. Auth
    const { user, status: authStatus, db, login, logout } = useAuth();

    // 2. Local Data
    const { 
        trades, strategies, emotions, portfolios, 
        activePortfolioIds, setActivePortfolioIds, 
        lossColor, setLossColor, actions: localActions,
        // Exposed setters for Sync
        setTrades, setStrategies, setEmotions, setPortfolios 
    } = useLocalData();

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
        const legacy = localStorage.getItem('broker_config');
        if (legacy && brokerConfigs.length === 0) {
            try {
                const parsed = JSON.parse(legacy);
                const initial: BrokerConfig = {
                    ...parsed,
                    id: parsed.id || Math.random().toString(36).substr(2, 9),
                    alias: parsed.alias || '',
                    isConnected: false
                };
                setBrokerConfigs([initial]);
                setActiveBrokerId(initial.id);
                localStorage.removeItem('broker_config');
            } catch (e) {
                console.error("Broker config migration error", e);
            }
        }
    }, [brokerConfigs, setBrokerConfigs, setActiveBrokerId, lang]);

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

    // 5. Sync Logic
    const { 
        isSyncing, syncStatus, lastBackupTime, isSyncModalOpen, setIsSyncModalOpen, 
        triggerCloudBackup, setLastSyncTimeStr, setSyncStatus 
    } = useSync({
        user,
        authStatus,
        db,
        data: { trades, strategies, emotions, portfolios, lossColor },
        onPull: (cloudData) => {
            if(cloudData.trades) setTrades(cloudData.trades);
            if(cloudData.strategies) setStrategies(cloudData.strategies);
            if(cloudData.emotions) setEmotions(cloudData.emotions);
            if(cloudData.portfolios) {
                setPortfolios(cloudData.portfolios);
                // Also update active if needed, logic borrowed from old useTradeData
                setActivePortfolioIds(cloudData.portfolios.map((p:any) => p.id));
            }
            if(cloudData.settings?.lossColor) setLossColor(cloudData.settings.lossColor);
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
    };

    const resetAllData = async (t: Translation) => {
        if (window.confirm(t.resetConfirm)) {
            try {
                // Cloud Reset
                if (user && authStatus === 'online') {
                    // Logic similar to old useTradeData
                    // We can just set empty here and let sync pick it up, or explicit delete
                     await triggerCloudBackup(); // Use the sync hook logic to overwrite cloud with empty? 
                     // Actually easier to just clear local and trigger sync, but standard is careful cloud manipulation
                     // Let's stick to the direct ref logic or import from hook?
                     // For simplicity: We cleared local data above, now we sync empty state.
                }

                localActions.clearLocalData();
                window.location.reload();

            } catch (error) {
                console.error("Reset failed:", error);
                localStorage.clear();
                window.location.reload();
            }
        }
    };

    const onResolveSyncConflict = (choice: 'merge' | 'discard') => {
        if (choice === 'discard') {
            getDoc(doc(db, 'users', user!.uid)).then(snap => {
                if(snap.exists()) {
                    const data = snap.data();
                    setTrades(data.trades || []);
                    setStrategies(data.strategies || []);
                    setEmotions(data.emotions || []);
                    setPortfolios(data.portfolios || []);
                    setSyncStatus('synced');
                    if (data.lastUpdated) {
                        setLastSyncTimeStr(data.lastUpdated.toDate().toISOString());
                    }
                }
            });
        } else {
            triggerCloudBackup();
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
        deleteTrade: (id: string) => { localActions.deleteTrade(id); setTimeout(triggerCloudBackup, 0); },
        updatePortfolio: (id: string, k: any, v: any) => { localActions.updatePortfolio(id, k, v); setTimeout(triggerCloudBackup, 0); },
        addPortfolio: (p: Portfolio) => { 
            setPortfolios(prev => [...prev, p]); 
            // Optional: Auto-activate new portfolio
            setActivePortfolioIds(prev => [...prev, p.id]);
            setTimeout(triggerCloudBackup, 0); 
        },
        deletePortfolio: (id: string) => { 
            setPortfolios(prev => prev.filter(p => p.id !== id));
            setActivePortfolioIds(prev => prev.filter(pid => pid !== id));
            setTimeout(triggerCloudBackup, 0); 
        },
        addStrategy: (s: string) => { localActions.addStrategy(s); setTimeout(triggerCloudBackup, 0); },
        addEmotion: (e: string) => { localActions.addEmotion(e); setTimeout(triggerCloudBackup, 0); },
        deleteStrategy: (s: string) => { localActions.deleteStrategy(s); setTimeout(triggerCloudBackup, 0); },
        deleteEmotion: (e: string) => { localActions.deleteEmotion(e); setTimeout(triggerCloudBackup, 0); },
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
        isSyncing, syncStatus, lastBackupTime, triggerCloudBackup, isSyncModalOpen, onResolveSyncConflict,
        actions: combinedActions,
        authStatus, user, login, logout,
        t: I18N[lang] || I18N['zh']
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
