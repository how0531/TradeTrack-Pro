
import React, { useState, useMemo } from 'react';
import { TrendingUp, Activity, Settings, Plus, List, ChevronRight, Eye, EyeOff, Filter, BrainCircuit, ShieldAlert, Cloud, CloudOff, RefreshCw, X, AlertOctagon, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ReferenceLine, BarChart, ScatterChart, Scatter, ZAxis, Cell } from 'recharts';

// Modules & Hooks
import { THEME, I18N } from './constants';
import { Trade, ViewMode, TimeRange, Frequency, StrategyStat, Lang, Portfolio } from './types';
import { getLocalDateStr, formatCurrency, formatDecimal, formatPnlK, getPnlColor, calculateMetrics } from './utils';
import { useAuth, useTradeData, useMetrics, useLocalStorage } from './hooks';

// Components
import { StatCard, PortfolioSelector, FrequencySelector, TimeRangeSelector, MultiSelectDropdown } from './components/UI';
import { CalendarView, LogsView, SettingsView } from './components/Views';
import { TradeModal, StrategyDetailModal, CustomDateRangeModal } from './components/Modals';
import { DashboardSkeleton } from './components/Skeletons';

// Custom Tooltip for Equity Chart
const CustomTooltip = ({ active, payload, hideAmounts, lang, portfolios }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const t = I18N[lang] || I18N['zh'];
        const systemKeys = ['date', 'equity', 'peak', 'pnl', 'isNewPeak', 'ddAmt', 'ddPct', 'fullDate', 'label', 'cumulativePnl'];
        const activePidsInPoint = Object.keys(data).filter(key => !systemKeys.includes(key) && !key.endsWith('_pos') && !key.endsWith('_neg') && data[key] !== 0);
        return (
            <div className="p-3 rounded-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] bg-[#1A1C20]/70 backdrop-blur-xl text-xs min-w-[160px] z-50">
                <div className="text-slate-300 mb-2 font-medium flex items-center gap-2 border-b border-white/10 pb-2">{data.label || data.date}</div>
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center gap-4"><span className="text-slate-300 font-bold">{t.currentEquity}</span><span className="font-barlow-numeric text-white font-bold text-sm">{formatCurrency(data.equity, hideAmounts)}</span></div>
                    {activePidsInPoint.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                            {activePidsInPoint.map((pid) => {
                                const portfolio = portfolios.find((p: any) => p.id === pid);
                                const isProfit = data[pid] >= 0;
                                const color = isProfit ? (portfolio?.profitColor || THEME.RED) : (portfolio?.lossColor || THEME.DEFAULT_LOSS);
                                return (
                                    <div key={pid} className="flex justify-between items-center">
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div><span className="text-slate-300 text-[10px]">{portfolio?.name || pid}</span></div>
                                        <span className="font-barlow-numeric text-[10px]" style={{ color }}>{isProfit ? '+' : ''}{formatCurrency(data[pid], hideAmounts)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-white/10">
                        {data.isNewPeak ? <div className="flex items-center justify-center gap-1.5 text-[#C8B085] font-bold"><TrendingUp size={12} /><span>{t.newPeak}</span></div> : <div className="flex justify-between items-center gap-4"><span className="text-slate-400">{t.drawdown}</span><span className="font-barlow-numeric font-medium" style={{ color: THEME.GREEN }}>{formatDecimal(data.ddPct)}%</span></div>}
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

// Custom Tooltip for Bubble Chart
const BubbleTooltip = ({ active, payload, hideAmounts, lang }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="p-3 rounded-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] bg-[#1A1C20]/70 backdrop-blur-xl text-xs z-50">
                 <div className="text-slate-300 mb-2 font-bold">{data.name}</div>
                 <div className="space-y-1">
                    <div className="flex justify-between gap-4"><span className="text-slate-400">Win Rate</span><span className="text-white font-mono">{formatDecimal(data.winRate)}%</span></div>
                    <div className="flex justify-between gap-4"><span className="text-slate-400">Risk/Reward</span><span className="text-white font-mono">{formatDecimal(data.riskReward)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-slate-400">Trades</span><span className="text-white font-mono">{data.trades}</span></div>
                    <div className="flex justify-between gap-4 pt-1 border-t border-white/5 mt-1"><span className="text-slate-400">Net PnL</span><span className="font-mono font-bold" style={{color: getPnlColor(data.pnl)}}>{formatCurrency(data.pnl, hideAmounts)}</span></div>
                 </div>
            </div>
        );
    }
    return null;
};

const CustomPeakDot = ({ cx, cy, payload }: any) => {
    if (payload?.isNewPeak) return <g><circle cx={cx} cy={cy} r={3} fill={THEME.GOLD} stroke={THEME.BG_DARK} strokeWidth={1.5} /><circle cx={cx} cy={cy} r={6} fill={THEME.GOLD} opacity={0.2} /></g>;
    return null;
};

export default function App() {
    const { user, status: authStatus, db, config, login, logout } = useAuth();
    const { trades, strategies, emotions, portfolios, activePortfolioIds, setActivePortfolioIds, lossColor, setLossColor, isSyncing, actions } = useTradeData(user, authStatus, db, config);
    const [view, setView] = useState<ViewMode>('stats');
    const [stratView, setStratView] = useState<'list' | 'chart'>('list');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [form, setForm] = useState<Trade>({ id: '', pnl: 0, date: getLocalDateStr(), amount: '', type: 'profit', strategy: '', note: '', emotion: '', image: '', portfolioId: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [detailStrategy, setDetailStrategy] = useState<string | null>(null);
    const [filterStrategy, setFilterStrategy] = useState<string[]>([]);
    const [filterEmotion, setFilterEmotion] = useState<string[]>([]);
    const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
    const [frequency, setFrequency] = useState<Frequency>('daily');
    const [customRange, setCustomRange] = useState<{start: string | null, end: string | null}>({ start: null, end: null });
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false); 
    const [lang, setLang] = useLocalStorage<Lang>('app_lang', 'zh');
    const [hideAmounts, setHideAmounts] = useLocalStorage<boolean>('app_hide_amounts', false);
    const [ddThreshold, setDdThreshold] = useLocalStorage<number>('app_dd_threshold', 20);
    const [maxLossStreak, setMaxLossStreak] = useLocalStorage<number>('app_max_loss_streak', 3);
    const t = I18N[lang] || I18N['zh'];
    
    const { filteredTrades, metrics, streaks, dailyPnlMap } = useMetrics(trades, portfolios, activePortfolioIds, frequency, lang, customRange, filterStrategy, filterEmotion);
    
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

    const bubbleData = useMemo(() => {
        return Object.entries(metrics.stratStats).map(([name, stat]) => ({
            name,
            x: stat.winRate,
            y: stat.riskReward > 10 ? 10 : stat.riskReward, // Cap Y for better visuals
            z: stat.trades,
            ...stat
        }));
    }, [metrics.stratStats]);

    const isRiskAlert = streaks.currentLoss >= maxLossStreak;
    const hasActiveFilters = filterStrategy.length > 0 || filterEmotion.length > 0;

    if (authStatus === 'loading') return <DashboardSkeleton />;

    const chartMargin = { top: 10, right: 10, left: 10, bottom: 5 };
    
    const SyncIndicator = () => {
        const isOnline = authStatus === 'online' && user && !user.isAnonymous;
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/5">
                {isSyncing ? (
                    <>
                        <RefreshCw size={10} className="text-gold animate-spin" />
                        <span className="text-[9px] font-bold text-gold uppercase tracking-tighter">{t.syncing}</span>
                    </>
                ) : isOnline ? (
                    <>
                        <Cloud size={10} className="text-[#5B9A8B]" />
                        <span className="text-[9px] font-bold text-[#5B9A8B] uppercase tracking-tighter">{t.synced}</span>
                    </>
                ) : (
                    <>
                        <CloudOff size={10} className="text-slate-500" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{t.offline}</span>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className={`min-h-[100dvh] bg-[#0B0C10] text-[#E0E0E0] font-sans flex flex-col max-w-md mx-auto relative shadow-2xl transition-all duration-700 ${isRiskAlert ? 'shadow-[0_0_50px_rgba(208,90,90,0.3)] border-x border-red-500/20' : ''}`}>
            
            {/* Risk Alert Banner */}
            {isRiskAlert && (
                <div className="bg-[#D05A5A]/10 border-b border-[#D05A5A]/30 backdrop-blur-md px-4 py-2 flex items-center justify-between sticky top-0 z-50 animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-2">
                        <AlertOctagon size={16} className="text-[#D05A5A] animate-pulse" />
                        <span className="text-xs font-bold text-[#D05A5A] uppercase tracking-wide">
                             {lang === 'zh' ? `連敗 ${streaks.currentLoss} 次，建議暫停交易` : `Lost ${streaks.currentLoss} in a row. Take a break.`}
                        </span>
                    </div>
                    <button onClick={() => setMaxLossStreak(99)} className="text-[10px] text-[#D05A5A] underline opacity-80 hover:opacity-100">{lang === 'zh' ? '忽略' : 'Dismiss'}</button>
                </div>
            )}

            {/* Top Section - Chart & Metrics - 3/7 (approx 43dvh) */}
            {view !== 'settings' && (
                <div 
                    className="flex flex-col bg-[#141619] rounded-b-[32px] border-b border-white/5 shadow-2xl z-20 relative overflow-hidden h-[43dvh]"
                >
                    <div className="px-5 pt-6 pb-2 flex flex-col h-full w-full">
                        {/* Header Row */}
                        <div className="flex justify-between items-center mb-2 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-1 rounded bg-[#25282C]"><Activity size={14} color={THEME.BLUE} /></div>
                                <SyncIndicator />
                            </div>
                            <div className="flex items-center gap-3">
                                <PortfolioSelector portfolios={portfolios} activeIds={activePortfolioIds} onChange={setActivePortfolioIds} lang={lang} />
                                <button onClick={() => setHideAmounts(!hideAmounts)} className="text-slate-500 hover:text-white transition-colors p-1">{hideAmounts ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                            </div>
                        </div>

                        {/* Equity & Metrics Row */}
                        <div className="flex flex-col mb-3 shrink-0">
                            <div className="flex justify-between items-baseline mb-1">
                                <h1 className="text-3xl font-medium font-barlow-numeric text-white tracking-tight">{formatCurrency(metrics.currentEq, hideAmounts)}</h1>
                                <div className="text-right">
                                    {metrics.isPeak ? (
                                        <div className="flex items-center justify-end gap-1 text-[#C8B085]">
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
                                <div className={`flex items-center gap-1 text-xs font-bold font-barlow-numeric ${metrics.eqChange >= 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                    {metrics.eqChange >= 0 ? '+' : ''}{formatCurrency(metrics.eqChange, hideAmounts)}
                                    <span className="opacity-60">({metrics.eqChangePct >= 0 ? '+' : ''}{formatDecimal(metrics.eqChangePct)}%)</span>
                                </div>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2 mb-3 shrink-0">
                            <FrequencySelector currentFreq={frequency} setFreq={setFrequency} lang={lang} />
                            <TimeRangeSelector currentRange={timeRange} setRange={(r: any) => { if(r === 'CUSTOM') setIsDatePickerOpen(true); else { setTimeRange(r); setCustomRange({start: null, end: null}); }}} lang={lang} customRangeLabel={customRange.start ? `${customRange.start.slice(5)}...` : undefined} />
                            <button 
                                onClick={() => setIsFilterOpen(!isFilterOpen)} 
                                className={`h-[28px] w-[28px] flex items-center justify-center rounded-lg border transition-all ${isFilterOpen || hasActiveFilters ? 'bg-[#C8B085] text-black border-[#C8B085] shadow-[0_0_10px_rgba(200,176,133,0.3)]' : 'bg-[#25282C] border-white/5 text-slate-400 hover:text-white'}`}
                            >
                                <Filter size={14} />
                            </button>
                        </div>
                        {isFilterOpen && (
                            <div className="grid grid-cols-2 gap-2 mb-3 shrink-0 animate-in fade-in slide-in-from-top-2">
                                <MultiSelectDropdown options={strategies} selected={filterStrategy} onChange={setFilterStrategy} icon={Activity} defaultLabel={t.allStrategies} lang={lang} />
                                <MultiSelectDropdown options={emotions} selected={filterEmotion} onChange={setFilterEmotion} icon={BrainCircuit} defaultLabel={t.allEmotions} lang={lang} />
                            </div>
                        )}

                        {/* Charts Area - Fills remaining space */}
                        <div className="flex-1 min-h-0 w-full flex flex-col gap-1 -mx-2 relative">
                            {/* Main Equity Chart */}
                            <div className="flex-1 min-h-0 relative w-full">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <ComposedChart data={metrics.curve} margin={chartMargin}>
                                        <defs>
                                            <linearGradient id="gradEq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={THEME.BLUE} stopOpacity={0.3}/><stop offset="100%" stopColor={THEME.BLUE} stopOpacity={0}/></linearGradient>
                                            {activePortfolioIds.map((pid) => { 
                                                const p = portfolios.find(x => x.id === pid); 
                                                return (
                                                    <React.Fragment key={`grads-${pid}`}>
                                                        <linearGradient id={`gradP-pos-${pid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={p?.profitColor || THEME.RED} stopOpacity={0.8}/><stop offset="100%" stopColor={p?.profitColor || THEME.RED} stopOpacity={0.1}/></linearGradient>
                                                        <linearGradient id={`gradP-neg-${pid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={p?.lossColor || THEME.DEFAULT_LOSS} stopOpacity={0.1}/><stop offset="100%" stopColor={p?.lossColor || THEME.DEFAULT_LOSS} stopOpacity={0.8}/></linearGradient>
                                                    </React.Fragment>
                                                )
                                            })}
                                        </defs>
                                        <XAxis dataKey="date" hide padding={{ left: 0, right: 0 }} />
                                        <Tooltip content={<CustomTooltip hideAmounts={hideAmounts} lang={lang} portfolios={portfolios} />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                                        <ReferenceLine y={0} yAxisId="pnl" stroke="#FFFFFF" strokeOpacity={0.1} />
                                        {activePortfolioIds.map((pid) => (
                                            <React.Fragment key={pid}>
                                                <Bar dataKey={`${pid}_pos`} stackId="a" fill={`url(#gradP-pos-${pid})`} radius={[2, 2, 0, 0]} barSize={8} yAxisId="pnl" />
                                                <Bar dataKey={`${pid}_neg`} stackId="a" fill={`url(#gradP-neg-${pid})`} radius={[4, 4, 0, 0]} barSize={8} yAxisId="pnl" />
                                            </React.Fragment>
                                        ))}
                                        <Line type="monotone" dataKey="equity" stroke={THEME.BLUE} strokeWidth={2} dot={<CustomPeakDot />} activeDot={{ r: 4, strokeWidth: 0 }} yAxisId="equity" isAnimationActive={false} />
                                        <YAxis yAxisId="pnl" hide domain={['auto', 'auto']} />
                                        <YAxis yAxisId="equity" orientation="right" hide domain={['auto', 'auto']} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            {/* Drawdown Chart - Small Fixed Portion */}
                            <div className="h-[15%] min-h-[30px] w-full relative opacity-60">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <BarChart data={metrics.drawdown} margin={{ ...chartMargin, top: 0 }}>
                                        <defs><linearGradient id="gradDDMain" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={THEME.DD_GRADIENT_TOP} stopOpacity={1}/><stop offset="100%" stopColor={THEME.DD_GRADIENT_BOTTOM} stopOpacity={0.7}/></linearGradient></defs>
                                        <XAxis dataKey="date" hide padding={{ left: 0, right: 0 }} />
                                        <YAxis hide domain={['dataMin', 0]} />
                                        <Tooltip cursor={{fill: 'transparent'}} content={() => null} />
                                        <Bar dataKey="ddPct" radius={[4, 4, 0, 0]} fill="url(#gradDDMain)" barSize={8} isAnimationActive={false} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Section - Content - 4/7 (approx 57dvh+) */}
            <div 
                className="relative w-full bg-[#0B0C10] flex-1 min-h-[57dvh]" 
            >
                <div className="px-4 py-5 pb-24 space-y-5 min-h-full">
                    {view === 'stats' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-3">
                            {hasActiveFilters && (
                                <div className="flex items-center justify-between bg-[#C8B085]/10 border border-[#C8B085]/30 p-2 rounded-lg">
                                    <span className="text-[10px] text-[#C8B085] font-bold uppercase flex items-center gap-2"><Filter size={10} /> {lang === 'zh' ? '篩選模式開啟中' : 'Filtering Active'}</span>
                                    <button onClick={() => { setFilterStrategy([]); setFilterEmotion([]); }} className="text-[10px] text-slate-400 underline hover:text-white">{lang === 'zh' ? '清除篩選' : 'Clear'}</button>
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                                <StatCard label={t.profitFactor} value={formatDecimal(metrics.pf)} />
                                <StatCard label={t.sharpe} value={formatDecimal(metrics.sharpe)} />
                                <StatCard label={t.riskReward} value={formatDecimal(metrics.riskReward)} />
                                <StatCard label={t.trades} value={metrics.totalTrades} />
                                <StatCard label={t.winRate} value={`${formatDecimal(metrics.winRate)}%`} />
                                <StatCard label={t.maxDD} value={`${formatDecimal(metrics.maxDD)}%`} valueColor={THEME.GREEN} />
                            </div>
                            <div className="p-4 rounded-xl bg-[#141619] border border-white/5 space-y-3">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2"><List size={12}/> {t.strategies}</h3>
                                    <div className="flex bg-[#0B0C10] rounded-lg p-0.5 border border-white/5">
                                        <button onClick={() => setStratView('list')} className={`p-1.5 rounded-md transition-all ${stratView === 'list' ? 'bg-[#25282C] text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}><List size={12}/></button>
                                        <button onClick={() => setStratView('chart')} className={`p-1.5 rounded-md transition-all ${stratView === 'chart' ? 'bg-[#25282C] text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}><BarChart2 size={12}/></button>
                                    </div>
                                </div>
                                
                                {stratView === 'list' ? (
                                    <div className="space-y-2 animate-in fade-in">
                                        {Object.entries(metrics.stratStats).map(([name, item]) => {
                                            const s = item as StrategyStat;
                                            const ddAbs = Math.abs(s.curDDPct);
                                            const isDanger = ddAbs >= ddThreshold;
                                            const isWarning = ddAbs >= Math.max(0, ddThreshold - 5) && ddAbs < ddThreshold;
                                            let style = { backgroundColor: '#1C1E22', border: '1px solid rgba(255,255,255,0.05)' };
                                            if (isDanger) style = { backgroundColor: 'rgba(91,154,139,0.1)', border: `1px solid ${THEME.GREEN}` };
                                            else if (isWarning) style = { backgroundColor: 'rgba(44,95,84,0.1)', border: `1px solid ${THEME.GREEN_DARK}` };
                                            return (
                                                <div key={name} onClick={() => setDetailStrategy(name)} className="p-3 rounded-lg flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] relative overflow-hidden group" style={style}>
                                                    {isDanger && <div className="absolute top-0 right-0 p-1"><ShieldAlert size={12} color={THEME.GREEN} className="opacity-90"/></div>}
                                                    <div><div className="text-xs font-bold text-slate-300 mb-0.5 flex items-center gap-1.5">{name}</div><div className="text-[10px] text-slate-500">WR {formatDecimal(s.winRate)}% • {s.trades} T</div></div>
                                                    <div className="text-right flex items-center gap-2">
                                                        <div><div className="text-sm font-bold font-barlow-numeric" style={{ color: getPnlColor(s.pnl) }}>{formatPnlK(s.pnl, hideAmounts)}</div><div className="text-[10px] font-barlow-numeric" style={{ color: isDanger ? THEME.GREEN : (isWarning ? THEME.GREEN : '#757575') }}>DD {formatDecimal(s.curDDPct)}%</div></div><ChevronRight size={14} className="text-slate-700 group-hover:text-white transition-colors" />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {Object.keys(metrics.stratStats).length === 0 && <div className="text-center py-4 text-slate-700 text-xs">{t.noData}</div>}
                                    </div>
                                ) : (
                                    <div className="h-[250px] w-full animate-in fade-in">
                                         {Object.keys(metrics.stratStats).length > 0 ? (
                                             <ResponsiveContainer width="100%" height="100%">
                                                <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                                                    <XAxis type="number" dataKey="x" name="Win Rate" unit="%" domain={[0, 100]} tick={{fontSize: 10, fill: '#555'}} tickLine={false} axisLine={{stroke: '#333'}} label={{ value: 'Win Rate', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#555' }} />
                                                    <YAxis type="number" dataKey="y" name="Risk/Reward" unit="" domain={[0, 'auto']} tick={{fontSize: 10, fill: '#555'}} tickLine={false} axisLine={{stroke: '#333'}} label={{ value: 'R/R', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#555' }} />
                                                    <ZAxis type="number" dataKey="z" range={[50, 400]} name="Trades" />
                                                    <Tooltip content={<BubbleTooltip hideAmounts={hideAmounts} lang={lang} />} cursor={{ strokeDasharray: '3 3', stroke: '#333' }} />
                                                    <ReferenceLine x={50} stroke="#333" strokeDasharray="3 3" />
                                                    <ReferenceLine y={1} stroke="#333" strokeDasharray="3 3" />
                                                    <Scatter data={bubbleData} fill={THEME.GOLD}>
                                                        {bubbleData.map((entry, index) => {
                                                            const isUnderperforming = entry.winRate < 50 && entry.riskReward < 1;
                                                            return (
                                                                <Cell 
                                                                    key={`cell-${index}`} 
                                                                    fill={entry.pnl >= 0 ? THEME.RED : THEME.GREEN} 
                                                                    fillOpacity={isUnderperforming ? 0.9 : 0.6} 
                                                                    stroke={entry.pnl >= 0 ? THEME.RED : THEME.GREEN} 
                                                                    strokeWidth={isUnderperforming ? 2 : 1}
                                                                    style={isUnderperforming ? { filter: `drop-shadow(0 0 6px ${THEME.GREEN})` } : {}}
                                                                />
                                                            );
                                                        })}
                                                    </Scatter>
                                                </ScatterChart>
                                             </ResponsiveContainer>
                                         ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-slate-700 text-xs">{t.noData}</div>
                                         )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {view === 'calendar' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <MultiSelectDropdown options={strategies} selected={filterStrategy} onChange={setFilterStrategy} icon={Filter} defaultLabel={t.allStrategies} lang={lang} />
                                <MultiSelectDropdown options={emotions} selected={filterEmotion} onChange={setFilterEmotion} icon={BrainCircuit} defaultLabel={t.allEmotions} lang={lang} />
                            </div>
                            <CalendarView dailyPnlMap={dailyPnlMap} currentMonth={currentMonth} setCurrentMonth={setCurrentMonth} onDateClick={(d: string) => { setForm({ id: '', pnl: 0, date: d, amount: '', type: 'profit', strategy: '', note: '', emotion: '', image: '', portfolioId: activePortfolioIds[0] || '' }); setEditingId(null); setIsModalOpen(true); }} monthlyStats={monthlyStats.count > 0 ? monthlyStats : { pnl: 0, count: 0, winRate: 0 }} hideAmounts={hideAmounts} lang={lang} streaks={streaks} strategies={strategies} emotions={emotions} filterStrategy={filterStrategy} setFilterStrategy={setFilterStrategy} filterEmotion={filterEmotion} setFilterEmotion={setFilterEmotion} />
                        </div>
                    )}
                    {view === 'logs' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <MultiSelectDropdown options={strategies} selected={filterStrategy} onChange={setFilterStrategy} icon={Filter} defaultLabel={t.allStrategies} lang={lang} />
                                <MultiSelectDropdown options={emotions} selected={filterEmotion} onChange={setFilterEmotion} icon={BrainCircuit} defaultLabel={t.allEmotions} lang={lang} />
                            </div>
                            <LogsView trades={filteredTrades} lang={lang} hideAmounts={hideAmounts} portfolios={portfolios} onEdit={(t: Trade) => { setForm({...t, amount: String(Math.abs(t.pnl)), type: t.pnl >= 0 ? 'profit' : 'loss', portfolioId: t.portfolioId || ''}); setEditingId(t.id); setIsModalOpen(true); }} onDelete={(id: string) => { if(window.confirm(t.deleteConfirm)) actions.deleteTrade(id); }} />
                        </div>
                    )}
                    {view === 'settings' && (
                        <SettingsView lang={lang} setLang={setLang} trades={trades} actions={actions} ddThreshold={ddThreshold} setDdThreshold={setDdThreshold} maxLossStreak={maxLossStreak} setMaxLossStreak={setMaxLossStreak} lossColor={lossColor} setLossColor={setLossColor} strategies={strategies} emotions={emotions} portfolios={portfolios} activePortfolioIds={activePortfolioIds} setActivePortfolioIds={setActivePortfolioIds} onBack={() => setView('stats')} currentUser={user} onLogin={login} onLogout={logout} />
                    )}
                </div>
            </div>

            <TradeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} form={form} setForm={setForm} onSubmit={(e: React.FormEvent) => { e.preventDefault(); actions.saveTrade({ id: form.id, date: form.date, pnl: form.type === 'profit' ? Math.abs(parseFloat(form.amount || '0')) : -Math.abs(parseFloat(form.amount || '0')), strategy: form.strategy, note: form.note, emotion: form.emotion, image: form.image, portfolioId: form.portfolioId }, editingId); setIsModalOpen(false); }} isEditing={!!editingId} strategies={strategies} emotions={emotions} portfolios={portfolios} lang={lang} />
            <StrategyDetailModal strategy={detailStrategy} metrics={strategyMetrics ? {...strategyMetrics, netProfit: strategyMetrics.eqChange} : null} onClose={() => setDetailStrategy(null)} lang={lang} hideAmounts={hideAmounts} ddThreshold={ddThreshold} />
            <CustomDateRangeModal isOpen={isDatePickerOpen} onClose={() => setIsDatePickerOpen(false)} onApply={(s: string, e: string) => { setCustomRange({ start: s, end: e }); setTimeRange('CUSTOM'); setIsDatePickerOpen(false); }} initialRange={customRange} lang={lang} />
            
            {!isModalOpen && !detailStrategy && !isDatePickerOpen && view !== 'settings' && (
                <button onClick={() => { setEditingId(null); setForm({ id: '', pnl: 0, date: getLocalDateStr(), amount: '', type: 'profit', strategy: '', note: '', emotion: '', image: '', portfolioId: activePortfolioIds[0] || '' }); setIsModalOpen(true); }} className="fixed bottom-20 right-6 w-14 h-14 rounded-full z-40 flex items-center justify-center transition-all hover:scale-105 active:scale-95 group shadow-lg bg-[#25282C] border border-white/10 text-white">
                    <Plus size={28} className="transition-transform duration-300 group-hover:rotate-90" strokeWidth={2} />
                </button>
            )}

            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-[#0B0C10] pb-[env(safe-area-inset-bottom,10px)] pt-2">
                <div className="flex justify-center items-center h-11 gap-6 max-w-md mx-auto px-4">
                    {[{ id: 'stats', label: t.stats }, { id: 'calendar', label: t.journal }, { id: 'logs', label: t.logs }, { id: 'settings', label: t.settings }].map(tab => (
                        <button key={tab.id} onClick={() => setView(tab.id as any)} className={`px-5 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all ${view === tab.id ? 'bg-[#C8B085]/10 border border-[#C8B085]/40 text-[#C8B085]' : 'bg-transparent border border-transparent text-slate-500 hover:text-slate-300'}`}>{tab.label}</button>
                    ))}
                </div>
            </div>
        </div>
    );
}
