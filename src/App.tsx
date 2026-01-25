// [Manage] Last Updated: 2026-01-26 (Force V1.5.0 Stable)
import React, { useState, useMemo, useEffect } from 'react';

// FORCE PURGE CACHE - Kill V1.6.0 SW
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
        for(let reg of regs) reg.unregister();
    });
}
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TrendingUp, Activity, Eye, EyeOff, Filter, Cloud, CloudOff, RefreshCw, AlertOctagon, Check, AlertCircle, BrainCircuit, Share2 } from 'lucide-react';

// Modules & Hooks
import { THEME, I18N } from './constants';
import { Trade, ViewMode, TimeRange, Frequency } from './types';
import { getLocalDateStr, formatDecimal, formatCompactNumber } from './utils/format';
import { calculateMetrics } from './utils/calculations';
import { pingBackend } from './services/brokerService';

// Components & Pages
import { Layout } from './components/Layout';
import { StatsPage } from './pages/StatsPage';
import { JournalPage } from './pages/JournalPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';

// Global Modals
import { TradeModal } from './features/trade/TradeModal';
import { StrategyDetailModal } from './features/analytics/StrategyDetailModal';
import { CustomDateRangeModal } from './components/modals/CustomDateRangeModal';
import { SyncConflictModal } from './components/modals/SyncConflictModal';
import { ShareModal } from './components/modals/ShareCardModal';
import { useTradeContext, TradeProvider } from './context/TradeContext';

function MainApp() {
    // 0. Wake up backend on start (Fire and forget)
    useEffect(() => {
        pingBackend().catch(err => console.debug('Background warmup failed', err));
    }, []);

    // 1. Consume Context
    const {
        metrics, 
        portfolios, 
        activePortfolioIds,
        setActivePortfolioIds,
        frequency,
        setFrequency,
        lang,
        setLang,
        hideAmounts,
        setHideAmounts,
        chartHeight,
        setChartHeight,
        timeRange,
        setTimeRange,
        customRange,
        setCustomRange,
        setIsDatePickerOpen,
        isDatePickerOpen,
        setIsFilterOpen,
        isFilterOpen,
        availableStrategies,
        availableEmotions,
        filterStrategy,
        setFilterStrategy,
        filterEmotion,
        setFilterEmotion,
        ddThreshold,
        setDdThreshold,
        syncStatus,
        authStatus,
        user,
        t,
        actions,
        filteredTrades,
        riskStreaks,
        trades,
        strategies,
        emotions,
        dailyPnlMap,
        streaks,
        maxLossStreak,
        setMaxLossStreak,
        isSyncModalOpen,
        isSyncing,
        login,
        logout,
        lastBackupTime,
        currentMonth,
        setCurrentMonth,
        lossColor,
        setLossColor,
        triggerCloudBackup,
        onResolveSyncConflict
    } = useTradeContext();

    // 2. UI-Only local state
    const [showFullEquity, setShowFullEquity] = useState(false);
    const [showPurePnl, setShowPurePnl] = useState(false);
    const [stratView, setStratView] = useState<'list' | 'chart'>('list');
    
    // Modals & Forms
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [form, setForm] = useState<Trade>({ id: '', pnl: 0, date: getLocalDateStr(), amount: '', type: 'profit', strategy: '', note: '', emotion: '', image: '', portfolioId: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [detailStrategy, setDetailStrategy] = useState<string | null>(null);
    
    // Derived state
    const isDDAlert = Math.abs(metrics.currentDD) >= ddThreshold;
    const isStreakAlert = riskStreaks.currentLoss >= maxLossStreak;
    const isRiskAlert = isDDAlert || isStreakAlert;
    const hasActiveFilters = filteredTrades.length !== trades.length;

    const monthlyStats = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0, 23, 59, 59);
        
        const monthlyTrades = trades.filter(t => {
            const d = new Date(t.date);
            return d >= start && d <= end;
        });
        
        const pnl = monthlyTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
        const wins = monthlyTrades.filter(t => (Number(t.pnl) || 0) > 0).length;
        const winRate = monthlyTrades.length > 0 ? (wins / monthlyTrades.length) * 100 : 0;
        
        return { pnl, winRate, count: monthlyTrades.length };
    }, [trades, currentMonth]);

    const moodGradient = useMemo(() => {
        if (isRiskAlert) return 'radial-gradient(circle at 50% -20%, rgba(208, 90, 90, 0.15), transparent 70%)';
        if (metrics.winRate > 60) return 'radial-gradient(circle at 50% -20%, rgba(74, 222, 128, 0.1), transparent 70%)';
        if (metrics.winRate < 40) return 'radial-gradient(circle at 50% -20%, rgba(148, 163, 184, 0.1), transparent 70%)';
        return 'radial-gradient(circle at 50% -20%, rgba(200, 176, 133, 0.08), transparent 70%)';
    }, [isRiskAlert, metrics.winRate]);

    return (
        <div className={`min-h-[100dvh] bg-[#000000] text-[#E0E0E0] font-sans flex flex-col max-w-md mx-auto relative shadow-2xl transition-all duration-700 overflow-hidden ${isRiskAlert ? 'shadow-[0_0_50px_rgba(208,90,90,0.3)] border-x border-red-500/20' : ''}`}>
            
            {/* <div className="fixed inset-0 pointer-events-none z-0 transition-all duration-1000 ease-in-out" style={{ background: moodGradient }} /> */}

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

            <Routes>
                <Route path="/" element={<Layout lang={lang} onFabClick={() => { setEditingId(null); setForm({ id: '', pnl: 0, date: getLocalDateStr(), amount: '', type: 'profit', strategy: '', note: '', emotion: '', image: '', portfolioId: activePortfolioIds[0] || '' }); setIsModalOpen(true); }} />}>
                    <Route index element={
                        <StatsPage 
                            metrics={metrics}
                            portfolios={portfolios}
                            activePortfolioIds={activePortfolioIds}
                            setActivePortfolioIds={setActivePortfolioIds}
                            frequency={frequency}
                            setFrequency={setFrequency}
                            lang={lang}
                            hideAmounts={hideAmounts}
                            setHideAmounts={setHideAmounts}
                            chartHeight={chartHeight}
                            setChartHeight={setChartHeight}
                            timeRange={timeRange}
                            setTimeRange={setTimeRange}
                            customRange={customRange}
                            setCustomRange={setCustomRange}
                            setIsDatePickerOpen={setIsDatePickerOpen}
                            setIsFilterOpen={setIsFilterOpen}
                            isFilterOpen={isFilterOpen}
                            hasActiveFilters={hasActiveFilters}
                            availableStrategies={availableStrategies}
                            availableEmotions={availableEmotions}
                            filterStrategy={filterStrategy}
                            setFilterStrategy={setFilterStrategy}
                            filterEmotion={filterEmotion}
                            setFilterEmotion={setFilterEmotion}
                            stratView={stratView}
                            setStratView={setStratView}
                            detailStrategy={detailStrategy}
                            setDetailStrategy={setDetailStrategy}
                            ddThreshold={ddThreshold}
                            showFullEquity={showFullEquity}
                            setShowFullEquity={setShowFullEquity}
                            setIsShareModalOpen={setIsShareModalOpen}
                            syncStatus={syncStatus}
                            authStatus={authStatus}
                            user={user}
                            t={t}
                            retrySync={triggerCloudBackup}
                            showPurePnl={showPurePnl}
                            setShowPurePnl={setShowPurePnl}
                        />
                    } />
                    
                    <Route path="journal" element={
                        <JournalPage 
                            dailyPnlMap={dailyPnlMap}
                            currentMonth={currentMonth}
                            setCurrentMonth={setCurrentMonth}
                            onDateClick={(d: string) => { setForm({ id: '', pnl: 0, date: d, amount: '', type: 'profit', strategy: '', note: '', emotion: '', image: '', portfolioId: activePortfolioIds[0] || '' }); setEditingId(null); setIsModalOpen(true); }}
                            monthlyStats={monthlyStats}
                            hideAmounts={hideAmounts}
                            setHideAmounts={setHideAmounts}
                            lang={lang}
                            streaks={streaks}
                            availableStrategies={availableStrategies}
                            availableEmotions={availableEmotions}
                            filterStrategy={filterStrategy}
                            setFilterStrategy={setFilterStrategy}
                            filterEmotion={filterEmotion}
                            setFilterEmotion={setFilterEmotion}
                            metrics={metrics}
                            portfolios={portfolios}
                            activePortfolioIds={activePortfolioIds}
                            setActivePortfolioIds={setActivePortfolioIds}
                            frequency={frequency}
                            setFrequency={setFrequency}
                            chartHeight={chartHeight}
                            setChartHeight={setChartHeight}
                            timeRange={timeRange}
                            setTimeRange={setTimeRange}
                            customRange={customRange}
                            setCustomRange={setCustomRange}
                            setIsDatePickerOpen={setIsDatePickerOpen}
                            setIsFilterOpen={setIsFilterOpen}
                            isFilterOpen={isFilterOpen}
                            hasActiveFilters={hasActiveFilters}
                            showFullEquity={showFullEquity}
                            setShowFullEquity={setShowFullEquity}
                            setIsShareModalOpen={setIsShareModalOpen}
                            syncStatus={syncStatus}
                            authStatus={authStatus}
                            user={user}
                            t={t}
                            retrySync={triggerCloudBackup}
                        />
                    } />
                    
                    <Route path="logs" element={
                        <LogsPage 
                            trades={filteredTrades}
                            lang={lang}
                            hideAmounts={hideAmounts}
                            portfolios={portfolios}
                            onEdit={(t: Trade) => { setForm({...t, amount: String(Math.abs(t.pnl)), type: t.pnl >= 0 ? 'profit' : 'loss', portfolioId: t.portfolioId || ''}); setEditingId(t.id); setIsModalOpen(true); }} 
                            onDelete={actions.deleteTrade}
                            availableStrategies={availableStrategies}
                            availableEmotions={availableEmotions}
                            filterStrategy={filterStrategy}
                            setFilterStrategy={setFilterStrategy}
                            filterEmotion={filterEmotion}
                            setFilterEmotion={setFilterEmotion}
                        />
                    } />
                    
                    <Route path="settings" element={
                        <SettingsPage onBack={() => {}} />
                    } />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>

            {/* MODALS */}
            <TradeModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                form={form} 
                setForm={setForm} 
                onSubmit={(e: React.FormEvent) => { e.preventDefault(); actions.saveTrade(form, editingId); setIsModalOpen(false); }} 
                isEditing={!!editingId} 
            />

            <StrategyDetailModal 
                strategy={detailStrategy} 
                onClose={() => setDetailStrategy(null)} 
                lang={lang} 
                metrics={metrics}
                hideAmounts={hideAmounts}
                ddThreshold={ddThreshold}
            />

            <CustomDateRangeModal 
                isOpen={isDatePickerOpen} 
                onClose={() => setIsDatePickerOpen(false)} 
                initialRange={customRange} 
                onApply={(s, e) => { setCustomRange({start: s, end: e}); setTimeRange('CUSTOM'); setIsDatePickerOpen(false); }} 
                lang={lang}
            />

            <SyncConflictModal 
                isOpen={isSyncModalOpen} 
                onResolve={onResolveSyncConflict} 
                lang={lang}
                isSyncing={isSyncing}
            />

            <ShareModal 
                isOpen={isShareModalOpen} 
                onClose={() => setIsShareModalOpen(false)} 
                metrics={metrics} 
                lang={lang} 
            />
        </div>
    );
}

export default function App() {
    return (
        <TradeProvider>
            <BrowserRouter>
                <MainApp />
            </BrowserRouter>
        </TradeProvider>
    );
}
