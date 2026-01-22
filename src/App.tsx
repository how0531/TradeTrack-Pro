
// [Manage] Last Updated: 2024-05-22
import React, { useState, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { TrendingUp, Activity, Eye, EyeOff, Filter, Cloud, CloudOff, RefreshCw, AlertOctagon, Check, AlertCircle, BrainCircuit, Share2 } from 'lucide-react';

// Modules & Hooks
import { THEME, I18N } from './constants';
import { Trade, ViewMode, TimeRange, Frequency } from './types';
import { getLocalDateStr, formatDecimal, formatCompactNumber } from './utils/format';
import { calculateMetrics } from './utils/calculations';

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
import { useTradeContext } from './context/TradeContext';

export default function App() {
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

    // 2. UI-Only local state (Not in context yet)
    const [showFullEquity, setShowFullEquity] = useState(false);
    // stratView moved to StatsPage
    
    // Modals & Forms
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [form, setForm] = useState<Trade>({ id: '', pnl: 0, date: getLocalDateStr(), amount: '', type: 'profit', strategy: '', note: '', emotion: '', image: '', portfolioId: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [detailStrategy, setDetailStrategy] = useState<string | null>(null);
    
    // Derived state that depends on specific local modal choices
    const strategyMetrics = useMemo(() => {
        if (!detailStrategy) return null;
        const sTrades = trades.filter(t => t.strategy === detailStrategy).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return calculateMetrics(sTrades, portfolios, activePortfolioIds, 'daily', lang, null, null);
    }, [detailStrategy, trades, portfolios, activePortfolioIds, lang]);
    
    // monthlyStats Logic moved to JournalPage


    const isStreakAlert = riskStreaks.currentLoss >= maxLossStreak;
    const isDDAlert = Math.abs(metrics.currentDD) >= ddThreshold;
    const isRiskAlert = isStreakAlert || isDDAlert;
    const hasActiveFilters = filterStrategy.length > 0 || filterEmotion.length > 0;

    const moodGradient = useMemo(() => {
        if (metrics.isPeak && metrics.totalTrades > 0) return `radial-gradient(circle at 50% -20%, ${THEME.GOLD}22, transparent 60%)`; 
        if (metrics.eqChange >= 0) return `radial-gradient(circle at 50% -20%, ${THEME.GREEN}22, transparent 60%)`; 
        return `radial-gradient(circle at 50% -20%, ${THEME.RED}22, transparent 60%)`; 
    }, [metrics.isPeak, metrics.eqChange, metrics.totalTrades]);

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

            <Routes>
                <Route path="/" element={<Layout lang={lang} onFabClick={() => { setEditingId(null); setForm({ id: '', pnl: 0, date: getLocalDateStr(), amount: '', type: 'profit', strategy: '', note: '', emotion: '', image: '', portfolioId: activePortfolioIds[0] || '' }); setIsModalOpen(true); }} />}>
                    <Route index element={
                        <StatsPage 
                            setIsShareModalOpen={setIsShareModalOpen}
                            detailStrategy={detailStrategy}
                            setDetailStrategy={setDetailStrategy}
                        />
                    } />
                    
                    <Route path="journal" element={
                        <JournalPage 
                            setIsShareModalOpen={setIsShareModalOpen}
                            onDateClick={(d: string) => { setForm({ id: '', pnl: 0, date: d, amount: '', type: 'profit', strategy: '', note: '', emotion: '', image: '', portfolioId: activePortfolioIds[0] || '' }); setEditingId(null); setIsModalOpen(true); }} 
                        />
                    } />
                    
                    <Route path="logs" element={
                        <LogsPage 
                            onEdit={(t: Trade) => { setForm({...t, amount: String(Math.abs(t.pnl)), type: t.pnl >= 0 ? 'profit' : 'loss', portfolioId: t.portfolioId || ''}); setEditingId(t.id); setIsModalOpen(true); }} 
                            onDelete={actions.deleteTrade} 
                        />
                    } />
                    
                    <Route path="settings" element={
                        <SettingsPage 
                            onBack={() => {}} // Not needed with Router
                        />
                    } />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* MODALS OUTSIDE ROUTES */}
            <TradeModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                form={form} 
                setForm={setForm} 
                onSubmit={(e: React.FormEvent) => { e.preventDefault(); actions.saveTrade({ id: form.id, date: form.date, pnl: form.type === 'profit' ? Math.abs(parseFloat(form.amount || '0')) : -Math.abs(parseFloat(form.amount || '0')), strategy: form.strategy, note: form.note, emotion: form.emotion, image: form.image, portfolioId: form.portfolioId }, editingId); setIsModalOpen(false); }} 
                isEditing={!!editingId} 
            />
            <StrategyDetailModal strategy={detailStrategy} metrics={strategyMetrics} onClose={() => setDetailStrategy(null)} lang={lang} hideAmounts={hideAmounts} ddThreshold={ddThreshold} />
            <CustomDateRangeModal isOpen={isDatePickerOpen} onClose={() => setIsDatePickerOpen(false)} onApply={(s: string | null, e: string | null) => { setCustomRange({ start: s, end: e }); setTimeRange('CUSTOM'); setIsDatePickerOpen(false); }} initialRange={customRange} lang={lang} />
            <SyncConflictModal isOpen={isSyncModalOpen} onResolve={onResolveSyncConflict} lang={lang} isSyncing={isSyncing} />
            <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} metrics={metrics} lang={lang} />
        </div>
    );
}
