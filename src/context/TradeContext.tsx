import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useIndexedDBData } from '../hooks/useIndexedDBData';
import { useSync } from '../hooks/useSync';
import { useMetrics } from '../hooks/useMetrics';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { detectDuplicates, mergeDuplicates, DuplicateGroup, DetectionOptions } from '../utils/duplicateDetection';
import { safeDateParse } from '../utils/calculations';
import { Trade, Portfolio, Metrics, Frequency, TimeRange, SyncStatus, RiskStreaks, Translation, Streaks, BrokerConfig, AutoSyncParams, User } from '../types';
import { db, resetFirestoreCache } from '../firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { wipeCloudData } from '../services/firestoreService';
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
        /** Pre-computed: trades from the incoming import that collide by id with an existing trade. */
        importConflicts: Array<{ incoming: Trade; existing: Trade }>;
        /** Total trade count in the incoming import file. */
        incomingImportCount: number;
        detectDuplicates: (options?: DetectionOptions) => DuplicateGroup[];
        removeDuplicates: () => void;
    };

    // Auth (exposed for settings)
    authStatus: 'loading' | 'online' | 'offline';
    user: User | null;
    login: () => void;
    logout: () => void;

    // Translation
    t: Translation;

    // Auto Execution
    autoSyncParams: AutoSyncParams | null;
    setAutoSyncParams: React.Dispatch<React.SetStateAction<AutoSyncParams | null>>;

    // Ephemeral toast (auto-dismisses); null when nothing to show.
    toast: { kind: 'info' | 'success' | 'error'; message: string } | null;
    dismissToast: () => void;
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

    // Lightweight ephemeral toast — used to give visible confirmation of
    // background operations the user kicked off (e.g. smart-merge result).
    // Replaces the previous "modal closes silently, hope it worked" UX.
    const [toast, setToast] = useState<{ kind: 'info' | 'success' | 'error'; message: string } | null>(null);
    const showToast = useCallback((kind: 'info' | 'success' | 'error', message: string) => {
        setToast({ kind, message });
        window.setTimeout(() => setToast(prev => (prev && prev.message === message ? null : prev)), 4000);
    }, []);

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
            // 增量合併：upsert 差異記錄，而非全量覆蓋。
            // Defensive validation — Firestore can race during writes and
            // produce a doc that is missing fields or has a null id; silently
            // upserting those into IndexedDB used to give the user "phantom"
            // trades or worse, drop the primary key and skip writes entirely.
            if (Array.isArray(patches.trades) && patches.trades.length > 0) {
                const validTrades = patches.trades.filter(t => {
                    const ok = !!t && typeof t.id === 'string' && t.id.length > 0;
                    if (!ok) console.warn('[Sync] dropped malformed pull trade:', t);
                    return ok;
                });
                if (validTrades.length > 0) {
                    await localActions.saveTrades(
                        validTrades.map(t => ({
                            ...t,
                            updatedAt: t.updatedAt || new Date().toISOString(),
                            isDeleted: t.isDeleted ?? false,
                        }))
                    );
                }
            }
            if (Array.isArray(patches.strategies)) {
                setStrategies(patches.strategies.filter((s): s is string => typeof s === 'string'));
            }
            if (Array.isArray(patches.emotions)) {
                setEmotions(patches.emotions.filter((e): e is string => typeof e === 'string'));
            }
            if (Array.isArray(patches.portfolios)) {
                const validPortfolios = patches.portfolios.filter(
                    (p: Portfolio) => !!p && typeof p.id === 'string' && p.id.length > 0
                );
                setPortfolios(validPortfolios);
                setActivePortfolioIds(validPortfolios.map(p => p.id));
            }
            if (patches.settings?.lossColor) setLossColor(patches.settings.lossColor);
        }
    });

    // C7: Debounced cloud backup scheduler
    // 取代散在各 action 裡的 setTimeout(triggerCloudBackup, 0)：
    //  1. 給 React + Dexie useLiveQuery 充分時間 flush 新狀態到 dataRef
    //     (原本 0ms 會在 dataRef 更新前就跑 push，造成 stale closure 漏寫)
    //  2. 連續 mutation 合併為一次 cloud push，省雲端寫入額度
    const backupTimerRef = useRef<number | null>(null);
    const scheduleCloudBackup = useCallback(() => {
        if (backupTimerRef.current !== null) {
            clearTimeout(backupTimerRef.current);
        }
        backupTimerRef.current = window.setTimeout(() => {
            backupTimerRef.current = null;
            triggerCloudBackup();
        }, 350);
    }, [triggerCloudBackup]);

    // 元件卸載時清掉未觸發的 timer，避免 memory leak / late update warning
    useEffect(() => {
        return () => {
            if (backupTimerRef.current !== null) clearTimeout(backupTimerRef.current);
        };
    }, []);

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

    const handleImportJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>, t: Translation) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (trades.length > 0) {
                    setPendingImport(data);
                    return;
                }

                // Direct Import (no existing trades — no conflict modal)
                if (data.trades) setTrades(data.trades);
                if (data.strategies) setStrategies(data.strategies);
                if (data.emotions) setEmotions(data.emotions);
                if (data.portfolios && Array.isArray(data.portfolios)) {
                    setPortfolios(data.portfolios);
                    setActivePortfolioIds(data.portfolios.map((p: Portfolio) => p.id));
                }
                if (data.settings?.lossColor) {
                    setLossColor(data.settings.lossColor);
                }

                // Duplicate detection runs on the parsed input directly — no need
                // to wait for React to flush state, so the old setTimeout(...,100)
                // was a guard for nothing. Same goes for the 200ms cloud-push
                // delay: scheduleCloudBackup already debounces by 350ms.
                const autoMerge = localStorage.getItem('auto_merge_on_import') === 'true';
                const duplicates = detectDuplicates(data.trades || []);

                if (duplicates.length > 0) {
                    const total = duplicates.reduce((sum, group) => sum + group.duplicates.length, 0);
                    const shouldMerge =
                        autoMerge ||
                        window.confirm(
                            lang === 'zh'
                                ? `匯入完成！檢測到 ${total} 筆重複交易，是否要合併？`
                                : `Import complete! Found ${total} duplicates. Merge them?`
                        );

                    if (shouldMerge) {
                        const cleaned = mergeDuplicates(data.trades, duplicates);
                        setTrades(cleaned);
                        if (autoMerge) {
                            alert(
                                lang === 'zh'
                                    ? `匯入完成！已自動合併 ${total} 筆重複交易。`
                                    : `Import complete! Auto-merged ${total} duplicates.`
                            );
                        }
                    }
                } else {
                    alert(t.importSuccess);
                }

                scheduleCloudBackup();
            } catch (err) {
                console.error(err);
                alert(t.importError);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }, [trades, lang, setTrades, setStrategies, setEmotions, setPortfolios, setActivePortfolioIds, setLossColor, scheduleCloudBackup]);

    const resolveImportConflict = useCallback((choice: 'merge' | 'overwrite') => {
        if (!pendingImport) return;
        const data = pendingImport;
        const importedPortfolios: Portfolio[] | null = Array.isArray(data.portfolios) ? data.portfolios : null;

        try {
            if (choice === 'overwrite') {
                if (Array.isArray(data.trades)) setTrades(data.trades);
                if (Array.isArray(data.strategies)) setStrategies(data.strategies);
                if (Array.isArray(data.emotions)) setEmotions(data.emotions);
                if (importedPortfolios) {
                    setPortfolios(importedPortfolios);
                    setActivePortfolioIds(importedPortfolios.map(p => p.id));
                }
                if (data.settings?.lossColor) setLossColor(data.settings.lossColor);
            } else {
                // MERGE — last-write-wins on id collision
                if (Array.isArray(data.trades)) {
                    const tradeMap = new Map(trades.map(t => [t.id, t]));
                    data.trades.forEach((t: Trade) => tradeMap.set(t.id, t));
                    setTrades(
                        Array.from(tradeMap.values()).sort((a, b) =>
                            safeDateParse(b.date).getTime() - safeDateParse(a.date).getTime()
                        )
                    );
                }
                if (Array.isArray(data.strategies)) {
                    setStrategies(Array.from(new Set([...strategies, ...data.strategies])));
                }
                if (Array.isArray(data.emotions)) {
                    setEmotions(Array.from(new Set([...emotions, ...data.emotions])));
                }
                if (importedPortfolios) {
                    const portMap = new Map(portfolios.map(p => [p.id, p]));
                    importedPortfolios.forEach(p => portMap.set(p.id, p));
                    setPortfolios(Array.from(portMap.values()));
                    setActivePortfolioIds(
                        Array.from(new Set([...activePortfolioIds, ...importedPortfolios.map(p => p.id)]))
                    );
                }
                if (data.settings?.lossColor) setLossColor(data.settings.lossColor);
            }
            scheduleCloudBackup();
        } catch (err) {
            // Don't let a malformed import file crash the React tree. Best-effort
            // recovery: clear the conflict modal and surface the failure.
            console.error('Import conflict resolution failed:', err);
            alert(lang === 'zh' ? '匯入失敗：檔案格式錯誤' : 'Import failed: malformed file');
        } finally {
            setPendingImport(null);
        }
    }, [pendingImport, trades, strategies, emotions, portfolios, activePortfolioIds, lang, setTrades, setStrategies, setEmotions, setPortfolios, setActivePortfolioIds, setLossColor, scheduleCloudBackup]);

    const resetAllData = useCallback(async (t: Translation) => {
        console.log('🚀 Data Reset Started...');
        try {
            // Cloud Reset (Explicitly Clear)
            // B1d (v3.9.2): 改用 wipeCloudData — 舊碼只覆寫 v1 legacy blob
            // (users/{uid})，v2 同步管線的 trades 子集合與 metadata/main
            // 原封不動，重置後下次登入全量 pull 又把資料整批拉回來。
            if (user && authStatus === 'online') {
                console.log('🧹 Clearing Cloud Data (v1 blob + v2 sub-collection)...');
                await wipeCloudData(db, user.uid);
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
    }, [user, authStatus]);

    const onResolveSyncConflict = async (choice: 'cloud' | 'local' | 'merge') => {
        if (choice === 'cloud') {
            await manualPull();
            showToast('success', lang === 'zh' ? '已套用雲端版本' : 'Applied cloud version');
        } else if (choice === 'local') {
            await triggerCloudBackup();
            showToast('success', lang === 'zh' ? '已上傳本機版本' : 'Pushed local version to cloud');
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

                const tradeMap = new Map<string, Trade>();
                cloudTrades.forEach(t => tradeMap.set(t.id, t));
                trades.forEach(t => tradeMap.set(t.id, t));
                const mergedTrades = Array.from(tradeMap.values());

                const groups = detectDuplicates(mergedTrades);
                const dedupedCount = groups.reduce((sum, g) => sum + g.duplicates.length, 0);
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
                showToast(
                    'success',
                    lang === 'zh'
                        ? `合併完成：${cleanedTrades.length} 筆${dedupedCount > 0 ? `（已去除 ${dedupedCount} 筆重複）` : ''}`
                        : `Merge complete: ${cleanedTrades.length} trades${dedupedCount > 0 ? ` (${dedupedCount} duplicates removed)` : ''}`
                );
            } catch (error) {
                console.error('Smart merge failed:', error);
                await triggerCloudBackup();
                showToast('error', lang === 'zh' ? '合併失敗，已退回上傳本機版本' : 'Merge failed, fell back to pushing local version');
            }
        }
        setIsSyncModalOpen(false);
    };

    // Pre-compute conflicts so the ImportConflictModal can render a preview
    // without dipping into pendingImport (which is intentionally private).
    const importConflicts = useMemo(() => {
        if (!pendingImport || !Array.isArray(pendingImport.trades)) return [];
        const existingById = new Map(trades.map(t => [t.id, t]));
        const out: Array<{ incoming: Trade; existing: Trade }> = [];
        for (const incoming of pendingImport.trades as Trade[]) {
            const existing = incoming?.id ? existingById.get(incoming.id) : undefined;
            if (existing) out.push({ incoming, existing });
        }
        return out;
    }, [pendingImport, trades]);
    const incomingImportCount = pendingImport && Array.isArray(pendingImport.trades)
        ? pendingImport.trades.length
        : 0;

    // Combine Actions — memoised so consumers depending on `actions` keep a stable
    // reference across re-renders that don't actually change the action surface.
    const combinedActions = useMemo(() => ({
        ...localActions,
        resetAllData,
        handleImportJSON,
        resolveImportConflict,
        isImportModalOpen: !!pendingImport,
        importConflicts,
        incomingImportCount,
        // Wrap actions that should trigger sync
        saveTrade: (t: Trade, id: string | null) => { localActions.saveTrade(t, id); scheduleCloudBackup(); },
        saveTrades: (ts: (Omit<Trade, 'id' | 'timestamp'> & { id?: string; timestamp?: string })[]) => { localActions.saveTrades(ts); scheduleCloudBackup(); },
        deleteTrade: (id: string) => { localActions.deleteTrade(id); scheduleCloudBackup(); },
        updatePortfolio: (id: string, k: keyof Portfolio, v: Portfolio[keyof Portfolio]) => { localActions.updatePortfolio(id, k, v); scheduleCloudBackup(); },
        addPortfolio: (p: Portfolio) => {
            localActions.addPortfolio(p);
            setActivePortfolioIds(prev => [...prev, p.id]);
            scheduleCloudBackup();
        },
        deletePortfolio: (id: string) => {
            localActions.deletePortfolio(id);
            setActivePortfolioIds(prev => prev.filter(pid => pid !== id));
            scheduleCloudBackup();
        },
        addStrategy: (s: string) => { localActions.addStrategy(s); scheduleCloudBackup(); },
        addEmotion: (e: string) => { localActions.addEmotion(e); scheduleCloudBackup(); },
        deleteStrategy: (s: string) => { localActions.deleteStrategy(s); scheduleCloudBackup(); },
        deleteEmotion: (e: string) => { localActions.deleteEmotion(e); scheduleCloudBackup(); },
        detectDuplicates: (options?: DetectionOptions) => detectDuplicates(trades, options),
        removeDuplicates: () => {
            const duplicateGroups = detectDuplicates(trades);
            if (duplicateGroups.length === 0) return;
            const cleaned = mergeDuplicates(trades, duplicateGroups);
            setTrades(cleaned);
            scheduleCloudBackup();
        },
    }), [localActions, resetAllData, handleImportJSON, resolveImportConflict, pendingImport, scheduleCloudBackup, setActivePortfolioIds, setTrades, trades, importConflicts, incomingImportCount]);

    const t = useMemo(() => I18N[lang] || I18N['zh'], [lang]);

    // Memoise the context value so consumers don't re-render every time the
    // provider re-renders if no field they care about changed. Setters from
    // useState/useLocalStorage are stable; we only list values + memoised callbacks.
    const value = useMemo<TradeContextType>(() => ({
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
        t,
        autoSyncParams, setAutoSyncParams,
        toast,
        dismissToast: () => setToast(null),
    }), [
        trades, strategies, emotions, portfolios,
        activePortfolioIds, currentMonth,
        filterStrategy, filterEmotion, timeRange, frequency, customRange,
        isDatePickerOpen, isFilterOpen,
        lang, hideAmounts, ddThreshold, maxLossStreak, chartHeight, lossColor,
        brokerConfigs, activeBrokerId, updateBrokerConfig, addBrokerConfig, deleteBrokerConfig, activeBrokerConfig,
        filteredTrades, metrics, streaks, riskStreaks, dailyPnlMap,
        availableStrategies, availableEmotions,
        isSyncing, syncStatus, lastBackupTime, triggerCloudBackup, manualPull,
        isSyncModalOpen, onResolveSyncConflict, conflictStats, syncError,
        combinedActions, authStatus, user, login, logout, t,
        autoSyncParams,
        setActivePortfolioIds,
        toast,
    ]);

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
