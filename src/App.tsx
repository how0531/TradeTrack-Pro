
// [Manage] Last Updated: 2024-05-22
import React, { useState, useMemo } from 'react';
import { TrendingUp, Activity, Plus, Eye, EyeOff, Filter, Cloud, CloudOff, RefreshCw, AlertOctagon, Check, AlertCircle, BrainCircuit, Share2 } from 'lucide-react';

// Modules & Hooks
import { THEME, I18N } from './constants';
import { Trade, ViewMode, TimeRange, Frequency } from './types';
import { getLocalDateStr, formatCurrency, formatDecimal, formatChartAxisDate, formatCompactNumber } from './utils/format';
import { calculateMetrics } from './utils/calculations';
import { useAuth } from './hooks/useAuth';
import { useTradeData } from './hooks/useTradeData';
import { useMetrics } from './hooks/useMetrics';
import { useLocalStorage } from './hooks/useLocalStorage';

// Components
import { PortfolioSelector } from './components/selectors/PortfolioSelector';
import { FrequencySelector } from './components/selectors/FrequencySelector';
import { TimeRangeSelector } from './components/selectors/TimeRangeSelector';
import { MultiSelectDropdown } from './components/selectors/MultiSelectDropdown';
import { SettingsView } from './features/settings/SettingsView';
import { StatsChart, StatsContent } from './components/tabs/StatsTab';
import { JournalTab } from './components/tabs/JournalTab';
import { LogsTab } from './components/tabs/LogsTab';
import { TradeModal } from './features/trade/TradeModal';
import { StrategyDetailModal } from './features/analytics/StrategyDetailModal';
import { CustomDateRangeModal } from './components/modals/CustomDateRangeModal';
import { SyncConflictModal } from './components/modals/SyncConflictModal';
import { ShareModal } from './components/modals/ShareModal';

export default function App() {
    const { user, status: authStatus, db, config, login, logout } = useAuth();
    const { trades, strategies, emotions, portfolios, activePortfolioIds, setActivePortfolioIds, lossColor, setLossColor, isSyncing, isSyncModalOpen, syncStatus, lastBackupTime, actions } = useTradeData(user, authStatus, db, config);
    
    // View State
    const [view, setView] = useState<ViewMode>('stats');
    const [stratView, setStratView] = useState<'list' | 'chart'>('list');
    
    // UI Interaction State
    const [showFullEquity, setShowFullEquity] = useState(false);
    
    // Modals & Forms
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [form, setForm] = useState<Trade>({ id: '', pnl: 0, date: getLocalDateStr(), amount: '', type: 'profit', strategy: '', note: '', emotion: '', image: '', portfolioId: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [detailStrategy, setDetailStrategy] = useState<string | null>(null);
    
    // Filters & Range
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [filterStrategy, setFilterStrategy] = useState<string[]>([]);
    const [filterEmotion, setFilterEmotion] = useState<string[]>([]);
    const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
    const [frequency, setFrequency] = useState<Frequency>('daily');
    const [customRange, setCustomRange] = useState<{start: string | null, end: string | null}>({ start: null, end: null });
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false); 
    
    // Preferences
    const [lang, setLang] = useLocalStorage<'zh' | 'en'>('app_lang', 'zh');
    const [hideAmounts, setHideAmounts] = useLocalStorage<boolean>('app_hide_amounts', false);
    const [ddThreshold, setDdThreshold] = useLocalStorage<number>('app_dd_threshold', 20);
    const [maxLossStreak, setMaxLossStreak] = useLocalStorage<number>('app_max_loss_streak', 3);
    const [chartHeight, setChartHeight] = useLocalStorage<number>('app_chart_height', 220); 

    const t = I18N[lang] || I18N['zh'];
    
    // Metrics Hook
    const { filteredTrades, metrics, streaks, riskStreaks, dailyPnlMap } = useMetrics(trades, portfolios, activePortfolioIds, frequency, lang, customRange, filterStrategy, filterEmotion, timeRange);
    
    // Derived Calculations
    const strategyMetrics = useMemo(() => {
        if (!detailStrategy) return null;
        const sTrades = trades.filter(t => t.strategy === detailStrategy).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return calculateMetrics(sTrades, portfolios, activePortfolioIds, 'daily', lang, null, null);
    }, [detailStrategy, trades, portfolios, activePortfolioIds, lang]);
    
    const monthlyStats = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const tradesInMonth = filteredTrades.filter(t => { if (!t.date) return false; const [tY, tM] = t.date.split('-').map(Number); return tY === year && (tM - 1) === month; });
        const pnl = tradesInMonth.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
        const wins = tradesInMonth.filter(t => (Number(t.pnl) || 0) > 0).length;
        const count = tradesInMonth.length;
        const winRate = count > 0 ? (wins / count) * 100 : 0;
        return { pnl, count, winRate };
    }, [filteredTrades, currentMonth]);

    // NEW: Computed Lists for Filtering (Includes deleted/historical tags)
    const availableStrategies = useMemo(() => {
        const tradeSet = new Set(trades.map(t => t.strategy).filter(s => s && s.trim() !== ''));
        // Add currently configured strategies to ensure they appear even if not used yet
        strategies.forEach(s => tradeSet.add(s));
        return Array.from(tradeSet).sort();
    }, [trades, strategies]);

    const availableEmotions = useMemo(() => {
        const tradeSet = new Set(trades.map(t => t.emotion).filter(e => e && e.trim() !== ''));
        emotions.forEach(e => tradeSet.add(e));
        return Array.from(tradeSet).sort();
    }, [trades, emotions]);

    const isStreakAlert = riskStreaks.currentLoss >= maxLossStreak;
    const isDDAlert = Math.abs(metrics.currentDD) >= ddThreshold;
    const isRiskAlert = isStreakAlert || isDDAlert;
    const hasActiveFilters = filterStrategy.length > 0 || filterEmotion.length > 0;

    const moodGradient = useMemo(() => {
        if (metrics.isPeak && metrics.totalTrades > 0) return `radial-gradient(circle at 50% -20%, ${THEME.GOLD}22, transparent 60%)`; 
        if (metrics.eqChange >= 0) return `radial-gradient(circle at 50% -20%, ${THEME.GREEN}22, transparent 60%)`; 
        return `radial-gradient(circle at 50% -20%, ${THEME.RED}22, transparent 60%)`; 
    }, [metrics.isPeak, metrics.eqChange, metrics.totalTrades]);

    // Logic to separate Number and Unit for styling
    const getFormattedEquity = () => {
        if (showFullEquity) {
            return { val: formatCurrency(metrics.currentEq, hideAmounts), unit: '' };
        }

        const raw = hideAmounts ? '****' : formatCompactNumber(metrics.currentEq, false);
        // Regex to separate numeric part from string part (e.g. "150.25" and "萬")
        const match = raw.match(/^([0-9.,+-]+)(.*)$/);
        return {
            val: match ? match[1] : raw,
            unit: match ? match[2] : ''
        };
    };

    const eqDisplay = getFormattedEquity();
    
    // --- Dynamic Font Size Logic for Header ---
    const eqLength = (eqDisplay.val?.length || 0) + (eqDisplay.unit?.length || 0);
    const eqFontSizeClass = eqLength > 12 ? 'text-2xl' : eqLength > 9 ? 'text-3xl' : 'text-4xl';

    if (authStatus === 'loading') {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-8">
                <div className="relative">
                    <div className="w-16 h-16 border-2 border-white/5 bg-[#141619] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(200,176,133,0.1)] animate-pulse">
                         <TrendingUp size={32} className="text-[#C8B085]" />
                    </div>
                </div>
            </div>
        );
    }
    
    const SyncIndicator = () => {
        const isOnline = authStatus === 'online' && user && !user.isAnonymous;
        if (!isOnline) {
            return (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/5">
                    <CloudOff size={10} className="text-slate-500" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{t.offline}</span>
                </div>
            );
        }
        if (syncStatus === 'saving') {
            return (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/5">
                    <RefreshCw size={10} className="text-gold animate-spin" />
                    <span className="text-[9px] font-bold text-gold uppercase tracking-tighter">{t.saving}</span>
                </div>
            );
        }
        if (syncStatus === 'error') {
             return (
                <button onClick={actions.retrySync} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors">
                    <AlertCircle size={10} className="text-red-400" />
                    <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">{t.syncError}</span>
                </button>
            );
        }
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/5 transition-all duration-500">
                <Check size={10} className="text-[#5B9A8B]" />
                <span className="text-[9px] font-bold text-[#5B9A8B] uppercase tracking-tighter">{t.saved}</span>
            </div>
        );
    };

    return (
        <div className={`min-h-[100dvh] bg-[#000000] text-[#E0E0E0] font-sans flex flex-col max-w-md mx-auto relative shadow-2xl transition-all duration-700 overflow-hidden ${isRiskAlert ? 'shadow-[0_0_50px_rgba(208,90,90,0.3)] border-x border-red-500/20' : ''}`}>
            
            <div className="fixed inset-0 pointer-events-none z-0 transition-all duration-1000 ease-in-out" style={{ background: moodGradient }} />

            {/* ALERT BANNER */}
            {isRiskAlert && (
                <div className="bg-[#D05A5A]/10 border-b border-[#D05A5A]/30 backdrop-blur-md px-4 py-2 flex items-center justify-between sticky top-0 z-50 animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-2">
                        <AlertOctagon size={16} className="text-[#D05A5A] animate-pulse" />
                        <span className="text-xs font-bold text-[#D05A5A] uppercase tracking-wide">
                             {isDDAlert 
                                ? (lang === 'zh' ? `回撤 ${formatDecimal(Math.abs(metrics.currentDD))}% 已達警戒 (${ddThreshold}%)` : `Drawdown ${formatDecimal(Math.abs(metrics.currentDD))}% hits limit (${ddThreshold}%)`)
                                : (lang === 'zh' ? `連敗 ${riskStreaks.currentLoss} 次，建議暫停交易` : `Lost ${riskStreaks.currentLoss} in a row. Take a break.`)
                             }
                        </span>
                    </div>
                    <button onClick={() => isDDAlert ? setDdThreshold(99) : setMaxLossStreak(99)} className="text-[10px] text-[#D05A5A] underline opacity-80 hover:opacity-100">{lang === 'zh' ? '忽略' : 'Dismiss'}</button>
                </div>
            )}

            {/* HEADER AREA - Z-INDEX INCREASED TO 50 TO BE ABOVE CONTENT */}
            {view !== 'settings' && (
                <div className="flex flex-col bg-transparent rounded-b-[32px] border-b border-white/5 z-50 relative overflow-visible shrink-0">
                    <div className="px-5 pt-6 flex flex-col w-full relative z-10">
                        <div className="flex justify-between items-center mb-2 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded-lg bg-[#25282C] border border-white/5 shadow-sm"><Activity size={14} color={THEME.BLUE} /></div>
                                <SyncIndicator />
                            </div>
                            <div className="flex items-center gap-3">
                                <PortfolioSelector portfolios={portfolios} activeIds={activePortfolioIds} onChange={setActivePortfolioIds} lang={lang} />
                                <button onClick={() => setHideAmounts(!hideAmounts)} className="text-slate-500 hover:text-white transition-colors p-1">{hideAmounts ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                            </div>
                        </div>

                        <div className="flex flex-col mb-3 shrink-0">
                            <div className="flex justify-between items-baseline mb-1 gap-2">
                                {/* MAIN EQUITY: Styled with split unit & Toggle Interaction */}
                                <div className="flex-1 min-w-0">
                                    <h1 
                                        onClick={() => setShowFullEquity(!showFullEquity)}
                                        className={`${eqFontSizeClass} font-bold font-barlow-numeric tracking-tight text-[#C8B085] flex items-baseline gap-1 cursor-pointer select-none active:opacity-80 transition-opacity whitespace-nowrap overflow-hidden`}
                                    >
                                        <span>{eqDisplay.val}</span>
                                        {/* Reduced unit size from text-xl to text-base for smaller appearance */}
                                        {eqDisplay.unit && <span className="text-base font-bold translate-y-[-1px] opacity-90">{eqDisplay.unit}</span>}
                                    </h1>
                                </div>
                                <div className="text-right shrink-0">
                                    {metrics.isPeak ? (
                                        <div className="flex items-center justify-end gap-1 text-[#C8B085] animate-pulse">
                                            <TrendingUp size={12} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{t.newPeak}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-end gap-1 text-slate-500">
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{t.currentDD}</span>
                                            <span className="text-xs font-bold font-barlow-numeric" style={{ color: THEME.GREEN }}>{formatDecimal(metrics.currentDD)}%</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* PNL CHANGE: Using formatCompactNumber with forceSign=true to show +/- */}
                                <div className={`flex items-center gap-1 text-xs font-bold font-barlow-numeric ${metrics.eqChange >= 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                    {formatCompactNumber(metrics.eqChange, true)}
                                    <span className="opacity-60">({metrics.eqChangePct >= 0 ? '+' : ''}{formatDecimal(metrics.eqChangePct)}%)</span>
                                </div>
                            </div>
                        </div>

                        {/* FREQUENCY + TIME RANGE + FILTER CONTROLS */}
                        <div className="flex items-center gap-1.5 mb-3 shrink-0 h-[28px]">
                            {/* Frequency Dropdown (Left) */}
                            <FrequencySelector currentFreq={frequency} setFreq={setFrequency} lang={lang} />
                            
                            {/* Time Range Capsule (Middle - Flex Grows) */}
                            <TimeRangeSelector 
                                currentRange={timeRange} 
                                setRange={(r: any) => { 
                                    if(r === 'CUSTOM') setIsDatePickerOpen(true); 
                                    else { setTimeRange(r); setCustomRange({start: null, end: null}); }
                                }} 
                                lang={lang} 
                                customRangeLabel={
                                    customRange.start && customRange.end ? (
                                        <div className="flex flex-col items-center justify-center leading-none -space-y-0.5">
                                            <span className="text-[8px] font-barlow-numeric font-bold tracking-tighter">{customRange.start.slice(5).replace('-','/')}</span>
                                            <span className="text-[8px] font-barlow-numeric font-bold tracking-tighter opacity-80">{customRange.end.slice(5).replace('-','/')}</span>
                                        </div>
                                    ) : (customRange.start ? customRange.start.slice(5).replace('-','/') : undefined)
                                } 
                            />

                            {/* Share Button (New) */}
                            <button 
                                onClick={() => setIsShareModalOpen(true)}
                                className="h-[28px] w-[28px] flex items-center justify-center rounded-lg border bg-[#C8B085]/10 border-[#C8B085]/20 text-[#C8B085] hover:bg-[#C8B085]/20 shrink-0 transition-colors"
                            >
                                <Share2 size={12} />
                            </button>

                            {/* Filter Button (Right) */}
                            <button 
                                onClick={() => setIsFilterOpen(!isFilterOpen)} 
                                className={`
                                    h-[28px] w-[28px] flex items-center justify-center rounded-lg border transition-all shrink-0
                                    ${isFilterOpen || hasActiveFilters 
                                        ? 'bg-[#C8B085] text-black border-[#C8B085] shadow-[0_0_10px_rgba(200,176,133,0.3)]' 
                                        : 'bg-[#C8B085]/10 border-[#C8B085]/20 text-[#C8B085] hover:bg-[#C8B085]/20'
                                    }
                                `}
                            >
                                <Filter size={12} />
                            </button>
                        </div>

                        {isFilterOpen && (
                            <div className="grid grid-cols-2 gap-2 mb-3 shrink-0 animate-in fade-in slide-in-from-top-2 relative z-[60]">
                                {/* Use availableStrategies/Emotions to include historical tags */}
                                <MultiSelectDropdown options={availableStrategies} selected={filterStrategy} onChange={setFilterStrategy} icon={Activity} defaultLabel={t.allStrategies} lang={lang} />
                                <MultiSelectDropdown options={availableEmotions} selected={filterEmotion} onChange={setFilterEmotion} icon={BrainCircuit} defaultLabel={t.allEmotions} lang={lang} />
                            </div>
                        )}

                        {/* Stats Chart with Zoom Handler */}
                        <StatsChart 
                            metrics={metrics} 
                            portfolios={portfolios} 
                            activePortfolioIds={activePortfolioIds} 
                            frequency={frequency} 
                            lang={lang} 
                            hideAmounts={hideAmounts} 
                            chartHeight={chartHeight}
                            setChartHeight={setChartHeight}
                            onZoom={(s, e) => { setCustomRange({ start: s, end: e }); setTimeRange('CUSTOM'); }}
                        />
                    </div>
                </div>
            )}

            {/* MAIN CONTENT AREA */}
            <div className="relative w-full bg-transparent flex-1 min-h-[57dvh]">
                <div className="px-4 py-5 pb-32 space-y-5 min-h-full">
                    
                    {view === 'stats' && (
                        <StatsContent 
                            metrics={metrics} 
                            lang={lang} 
                            hideAmounts={hideAmounts}
                            stratView={stratView}
                            setStratView={setStratView}
                            detailStrategy={detailStrategy}
                            setDetailStrategy={setDetailStrategy}
                            hasActiveFilters={hasActiveFilters}
                            setFilterStrategy={setFilterStrategy}
                            setFilterEmotion={setFilterEmotion}
                            ddThreshold={ddThreshold}
                        />
                    )}
                    
                    {view === 'calendar' && (
                        <JournalTab 
                            dailyPnlMap={dailyPnlMap} 
                            currentMonth={currentMonth} 
                            setCurrentMonth={setCurrentMonth} 
                            onDateClick={(d: string) => { setForm({ id: '', pnl: 0, date: d, amount: '', type: 'profit', strategy: '', note: '', emotion: '', image: '', portfolioId: activePortfolioIds[0] || '' }); setEditingId(null); setIsModalOpen(true); }} 
                            monthlyStats={monthlyStats.count > 0 ? monthlyStats : { pnl: 0, count: 0, winRate: 0 }} 
                            hideAmounts={hideAmounts} 
                            lang={lang} 
                            streaks={streaks} 
                            strategies={availableStrategies} // Use inclusive list
                            emotions={availableEmotions}     // Use inclusive list
                            filterStrategy={filterStrategy} 
                            setFilterStrategy={setFilterStrategy} 
                            filterEmotion={filterEmotion} 
                            setFilterEmotion={setFilterEmotion} 
                        />
                    )}
                    
                    {view === 'logs' && (
                        <LogsTab 
                            trades={filteredTrades} 
                            lang={lang} 
                            hideAmounts={hideAmounts} 
                            portfolios={portfolios} 
                            onEdit={(t: Trade) => { setForm({...t, amount: String(Math.abs(t.pnl)), type: t.pnl >= 0 ? 'profit' : 'loss', portfolioId: t.portfolioId || ''}); setEditingId(t.id); setIsModalOpen(true); }} 
                            onDelete={actions.deleteTrade} 
                            strategies={availableStrategies} // Use inclusive list
                            emotions={availableEmotions}     // Use inclusive list
                            filterStrategy={filterStrategy} 
                            setFilterStrategy={setFilterStrategy} 
                            filterEmotion={filterEmotion} 
                            setFilterEmotion={setFilterEmotion} 
                        />
                    )}
                    
                    {view === 'settings' && (
                        <SettingsView lang={lang} setLang={setLang} trades={trades} actions={actions} ddThreshold={ddThreshold} setDdThreshold={setDdThreshold} maxLossStreak={maxLossStreak} setMaxLossStreak={setMaxLossStreak} lossColor={lossColor} setLossColor={setLossColor} strategies={strategies} emotions={emotions} portfolios={portfolios} activePortfolioIds={activePortfolioIds} setActivePortfolioIds={setActivePortfolioIds} onBack={() => setView('stats')} currentUser={user} onLogin={login} onLogout={logout} lastBackupTime={lastBackupTime} />
                    )}
                </div>
            </div>

            <TradeModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                form={form} 
                setForm={setForm} 
                onSubmit={(e: React.FormEvent) => { e.preventDefault(); actions.saveTrade({ id: form.id, date: form.date, pnl: form.type === 'profit' ? Math.abs(parseFloat(form.amount || '0')) : -Math.abs(parseFloat(form.amount || '0')), strategy: form.strategy, note: form.note, emotion: form.emotion, image: form.image, portfolioId: form.portfolioId }, editingId); setIsModalOpen(false); }} 
                isEditing={!!editingId} 
                strategies={strategies} 
                emotions={emotions} 
                portfolios={portfolios} 
                lang={lang} 
                metrics={metrics} // PASS METRICS HERE
            />
            <StrategyDetailModal strategy={detailStrategy} metrics={strategyMetrics} onClose={() => setDetailStrategy(null)} lang={lang} hideAmounts={hideAmounts} ddThreshold={ddThreshold} />
            <CustomDateRangeModal isOpen={isDatePickerOpen} onClose={() => setIsDatePickerOpen(false)} onApply={(s: string, e: string) => { setCustomRange({ start: s, end: e }); setTimeRange('CUSTOM'); setIsDatePickerOpen(false); }} initialRange={customRange} lang={lang} />
            <SyncConflictModal isOpen={isSyncModalOpen} onResolve={actions.resolveSyncConflict} lang={lang} isSyncing={isSyncing} />
            
            <ShareModal 
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                metrics={metrics}
                lang={lang}
            />

             {/* PREMIUM FLOATING NAVIGATION BAR */}
             <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[350px] pointer-events-none h-16">
                {/* 1. VISUAL BACKGROUND LAYER (WITH CUTOUT) */}
                <div 
                    className="absolute inset-0 bg-[#1A1C20]/20 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl ring-1 ring-white/5"
                    style={{
                        WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent 28px, black 28.5px)',
                        maskImage: 'radial-gradient(circle at 50% 50%, transparent 28px, black 28.5px)'
                    }}
                />

                {/* 2. INTERACTION LAYER */}
                <div className="relative h-full w-full pointer-events-auto flex items-center justify-between px-3">
                    
                    {/* Left Group */}
                    <div className="flex items-center gap-1 h-full py-2">
                        {[
                            { id: 'stats', label: t.stats }, 
                            { id: 'calendar', label: t.journal }
                        ].map(tab => {
                            const isActive = view === tab.id;
                            return (
                                <button 
                                    key={tab.id} 
                                    onClick={() => setView(tab.id as any)} 
                                    className={`
                                        relative w-16 h-full rounded-2xl transition-all duration-500 group flex flex-col items-center justify-center overflow-hidden
                                        ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}
                                    `}
                                >
                                    <span className={`text-[10px] font-bold uppercase tracking-wider block transition-all duration-300 relative z-10 ${isActive ? 'text-[#C8B085] scale-110' : 'text-slate-500 group-hover:text-slate-300'}`}>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* CENTRAL FLOATING BUTTON */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[64px] h-[64px] rounded-full z-20 pointer-events-auto transition-all group overflow-hidden shadow-[0_8px_32px_rgba(200,176,133,0.3)] hover:scale-105 active:scale-95">
                        <button 
                            onClick={() => { setEditingId(null); setForm({ id: '', pnl: 0, date: getLocalDateStr(), amount: '', type: 'profit', strategy: '', note: '', emotion: '', image: '', portfolioId: activePortfolioIds[0] || '' }); setIsModalOpen(true); }} 
                            className="w-full h-full flex items-center justify-center text-[#C8B085] relative z-10 bg-[#C8B085]/20 backdrop-blur-xl border border-[#C8B085]/40 rounded-full"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50 rounded-full"></div>
                            <Plus size={32} strokeWidth={2.5} className="transition-transform duration-300 group-hover:rotate-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] relative z-20" />
                        </button>
                    </div>

                    {/* Right Group */}
                    <div className="flex items-center gap-1 h-full py-2">
                        {[
                            { id: 'logs', label: t.logs }, 
                            { id: 'settings', label: t.settings }
                        ].map(tab => {
                            const isActive = view === tab.id;
                            return (
                                <button 
                                    key={tab.id} 
                                    onClick={() => setView(tab.id as any)} 
                                    className={`
                                        relative w-16 h-full rounded-2xl transition-all duration-500 group flex flex-col items-center justify-center overflow-hidden
                                        ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}
                                    `}
                                >
                                    <span className={`text-[10px] font-bold uppercase tracking-wider block transition-all duration-300 relative z-10 ${isActive ? 'text-[#C8B085] scale-110' : 'text-slate-500 group-hover:text-slate-300'}`}>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
