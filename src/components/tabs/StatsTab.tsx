
// [Manage] Last Updated: 2024-05-22
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, List, ScatterChart as ScatterIcon, X, Calendar } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ScatterChart, Scatter, ZAxis, BarChart, ReferenceArea } from 'recharts';
import { StrategyListView } from '../../features/analytics/StrategyListView';
import { THEME, I18N } from '../../constants';
import { getPnlColor, formatCurrency, formatDecimal, formatChartAxisDate, formatCompactNumber, formatDate } from '../../utils/format';
import { Metrics, StrategyStat, StatsChartProps, Lang } from '../../types';

interface StatsCommonProps {
    metrics: Metrics;
    lang: Lang;
    hideAmounts: boolean;
}

interface StatsContentProps extends StatsCommonProps {
    stratView: 'list' | 'chart';
    setStratView: (v: 'list' | 'chart') => void;
    detailStrategy: string | null;
    setDetailStrategy: (s: string | null) => void;
    hasActiveFilters: boolean;
    setFilterStrategy: (s: string[]) => void;
    setFilterEmotion: (e: string[]) => void;
    ddThreshold: number;
}

// --- INTERNAL COMPONENT: StatCard ---
const StatCard = ({ label, value, valueColor, subLabel, className, valueClassName }: any) => (
    <div className={`p-3 rounded-xl border flex flex-col items-center justify-center min-h-[72px] relative overflow-hidden group transition-colors shadow-lg shadow-black/20 backdrop-blur-md ${className || 'border-white/5 bg-[#1A1C20]/40 hover:bg-[#1A1C20]/60'}`}>
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <span 
            className={`text-lg font-bold font-barlow-numeric tracking-tight mb-0.5 ${valueClassName || ''}`} 
            style={{ color: valueColor || '#E0E0E0' }}
        >
            {value}
        </span>
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            {label}
            {subLabel && <span className="opacity-50 text-[8px]">({subLabel})</span>}
        </span>
    </div>
);

// --- TOOLTIPS ---
const CustomTooltip = ({ active, payload, hideAmounts, lang, portfolios }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const t = I18N[lang] || I18N['zh'];
        const systemKeys = ['date', 'equity', 'peak', 'pnl', 'isNewPeak', 'ddAmt', 'ddPct', 'fullDate', 'label', 'cumulativePnl', 'timestamp', 'crowding', 'escapeAngle', 'isCrowded'];
        const activePidsInPoint = Object.keys(data).filter(key => !systemKeys.includes(key) && !key.endsWith('_pos') && !key.endsWith('_neg') && data[key] !== 0);
        
        const isAllTimeHigh = data.isNewPeak || Math.abs(data.ddPct) < 0.01;

        return (
            <div className="p-3 rounded-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] bg-[#050505]/40 backdrop-blur-md text-xs min-w-[160px] z-[60] ring-1 ring-white/5">
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
                        {isAllTimeHigh ? (
                            <div className="flex items-center justify-center gap-1.5 text-[#C8B085] font-bold animate-pulse">
                                <TrendingUp size={12} />
                                <span>{t.newPeak}</span>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center gap-4">
                                <span className="text-slate-400">{t.drawdown}</span>
                                <span className="font-barlow-numeric font-medium" style={{ color: THEME.GREEN }}>{formatDecimal(data.ddPct)}%</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const BubbleTooltip = ({ active, payload, hideAmounts, lang }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="p-3 rounded-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] bg-black/40 backdrop-blur-md text-xs z-50 pointer-events-none ring-1 ring-white/10">
                 <div className="text-white mb-2 font-bold flex items-center gap-2 border-b border-white/10 pb-2">
                    {data.name}
                 </div>
                 <div className="space-y-1.5">
                    <div className="flex justify-between gap-6"><span className="text-slate-400">Net PnL</span><span className="font-mono font-bold" style={{color: getPnlColor(data.pnl)}}>{formatCurrency(data.pnl, hideAmounts)}</span></div>
                    <div className="flex justify-between gap-6"><span className="text-slate-400">Trades</span><span className="text-white font-mono">{data.trades}</span></div>
                    <div className="flex justify-between gap-6"><span className="text-slate-400">Win Rate</span><span className="text-white font-mono">{formatDecimal(data.x)}%</span></div>
                    <div className="flex justify-between gap-6"><span className="text-slate-400">R:R</span><span className="text-white font-mono">{formatDecimal(data.y)}</span></div>
                 </div>
            </div>
        );
    }
    return null;
};

const CustomPeakDot = ({ cx, cy, payload, dataLength }: any) => {
    if (!payload?.isNewPeak) return null;
    let r = 5;
    if (dataLength > 200) r = 2;
    else if (dataLength > 100) r = 3;
    else if (dataLength > 50) r = 4;
    return <circle cx={cx} cy={cy} r={r} fill="#DEB06C" stroke="none" />;
};

const StrategyBubble = (props: any) => {
    const { cx, cy, payload, size, onSelect } = props;
    if (!cx || !cy) return null;
    const radius = Math.sqrt(size || 0) * 0.45 + 4; 
    const isProfit = payload.pnl > 0;
    const fillColor = isProfit ? THEME.RED : THEME.GREEN;
    const padding = 8;
    let textAnchor: 'start' | 'middle' | 'end' = 'middle';
    let labelX = cx;
    let labelY = cy - radius - padding;
    if (labelY < 15) {
        labelY = cy + radius + padding + 10;
    }
    if (cx < 60) {
        textAnchor = 'start';
        labelX = cx - (radius * 0.3);
    } else if (cx > 260) { 
        textAnchor = 'end';
        labelX = cx + (radius * 0.3);
    }
    const label = (payload.name || '').split('_')[0];

    return (
        <g onClick={() => onSelect && onSelect(payload.name)} style={{ cursor: 'pointer' }} className="group">
            <circle cx={cx} cy={cy} r={radius} fill={fillColor} fillOpacity={0.85} stroke={fillColor} strokeWidth={1} className="transition-all duration-300 group-hover:fill-opacity-100 group-hover:stroke-white group-hover:stroke-[2px]" />
            <text x={labelX} y={labelY} textAnchor={textAnchor} fill="#E0E0E0" fontSize={10} fontWeight="700" style={{ paintOrder: 'stroke', stroke: '#000000', strokeWidth: '3px', strokeLinecap: 'round', strokeLinejoin: 'round', pointerEvents: 'none', userSelect: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>{label}</text>
        </g>
    );
};

const StrategyBubbleChart = ({ data, onSelect, lang, hideAmounts }: { data: { name: string; stat: StrategyStat }[], onSelect: (name: string) => void, lang: Lang, hideAmounts: boolean }) => {
    const t = I18N[lang] || I18N['zh'];
    const chartData = useMemo(() => {
        return data.map((d) => ({
            name: d.name,
            x: Number(d.stat.winRate),
            y: Number(d.stat.riskReward),
            z: Math.abs(Number(d.stat.pnl)), 
            pnl: d.stat.pnl,
            trades: d.stat.trades
        })).filter(d => d.trades > 0).sort((a,b) => b.z - a.z); 
    }, [data]);

    if (chartData.length === 0) return <div className="text-center py-8 text-slate-600 text-xs">{t.noData}</div>;
    const axisMaxY = Math.max(...chartData.map(d => d.y), 2.5) * 1.2;

    return (
        <div className="w-full h-[320px] bg-black/20 rounded-3xl border border-white/5 p-4 relative overflow-hidden backdrop-blur-sm">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.03),_transparent_70%)] pointer-events-none"></div>
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <XAxis type="number" dataKey="x" name="Win Rate" unit="%" domain={[0, 100]} tick={{ fill: '#525252', fontSize: 10, fontWeight: 500 }} tickLine={false} axisLine={{ stroke: '#333', strokeWidth: 1 }} ticks={[0, 25, 50, 75, 100]} />
                    <YAxis type="number" dataKey="y" name="R:R" domain={[0, axisMaxY]} tick={{ fill: '#525252', fontSize: 10, fontWeight: 500 }} tickLine={false} axisLine={{ stroke: '#333', strokeWidth: 1 }} width={20} />
                    <ZAxis type="number" dataKey="z" range={[64, 2500]} name="PnL Volume" />
                    <Tooltip content={<BubbleTooltip hideAmounts={hideAmounts} lang={lang} />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.2)' }} />
                    <ReferenceLine x={50} stroke="#444" strokeOpacity={0.3} strokeDasharray="4 4" />
                    <ReferenceLine y={1.0} stroke="#444" strokeOpacity={0.3} strokeDasharray="4 4" />
                    <Scatter name="Strategies" data={chartData} cursor="pointer" shape={(props: any) => <StrategyBubble {...props} onSelect={onSelect} />} />
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
};

export const StatsChart = ({
    metrics, portfolios, activePortfolioIds, frequency, lang, hideAmounts, chartHeight, setChartHeight, onZoom
}: StatsChartProps) => {
    const t = I18N[lang] || I18N['zh'];
    const { barSize, barRadius } = useMemo(() => {
        switch (frequency) {
            case 'weekly': return { barSize: 12, barRadius: [3, 3, 0, 0] as [number, number, number, number] };
            case 'monthly': return { barSize: 20, barRadius: [4, 4, 0, 0] as [number, number, number, number] };
            case 'quarterly': return { barSize: 40, barRadius: [6, 6, 0, 0] as [number, number, number, number] };
            case 'yearly': return { barSize: 60, barRadius: [8, 8, 0, 0] as [number, number, number, number] };
            default: return { barSize: 6, barRadius: [2, 2, 0, 0] as [number, number, number, number] };
        }
    }, [frequency]);

    const [selection, setSelection] = useState<{ start: string; end: string; startIdx: number; endIdx: number } | null>(null);
    const [tempStart, setTempStart] = useState<string | null>(null);
    const [tempStartIdx, setTempStartIdx] = useState<number | null>(null);
    const [isLongPressing, setIsLongPressing] = useState(false);
    
    const longPressTimer = useRef<any>(null);

    const cancelLongPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        if (isLongPressing && !tempStart) {
             setIsLongPressing(false);
        }
    };

    const handleMouseDown = (state: any) => {
        if (!state || !state.activeLabel) return;
        if (selection) {
            setSelection(null);
            setIsLongPressing(false);
            setTempStart(null);
            setTempStartIdx(null);
            return;
        }
        const activeIndex = state.activeTooltipIndex;
        const activeLabel = state.activeLabel;
        longPressTimer.current = setTimeout(() => {
            setIsLongPressing(true);
            setTempStart(activeLabel);
            setTempStartIdx(activeIndex);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 1000); 
    };

    const handleMouseMove = (state: any) => {
        if (isLongPressing && tempStart && state && state.activeLabel) {
             const currentIdx = state.activeTooltipIndex;
             let sIdx = tempStartIdx!;
             let eIdx = currentIdx;
             let sLabel = tempStart;
             let eLabel = state.activeLabel;
             if (sIdx > eIdx) {
                 [sIdx, eIdx] = [eIdx, sIdx];
                 [sLabel, eLabel] = [eLabel, sLabel];
             }
             setSelection({ start: sLabel, end: eLabel, startIdx: sIdx, endIdx: eIdx });
        }
    };

    const handleMouseUp = () => {
        cancelLongPress();
    };

    const selectionStats = useMemo(() => {
        if (!selection || !metrics.curve) return null;
        const startItem = metrics.curve[selection.startIdx];
        const endItem = metrics.curve[selection.endIdx];
        if(!startItem || !endItem) return null;
        const pnlDiff = endItem.equity - startItem.equity;
        const pctDiff = startItem.equity !== 0 ? (pnlDiff / startItem.equity) * 100 : 0;
        return { pnl: pnlDiff, pct: pctDiff, startDate: startItem.fullDate, endDate: endItem.fullDate };
    }, [selection, metrics.curve]);

    const isResizing = useRef(false);
    const startY = useRef(0);
    const startHeight = useRef(0);
    const startResize = useCallback((clientY: number) => { isResizing.current = true; startY.current = clientY; startHeight.current = chartHeight; document.body.style.userSelect = 'none'; document.body.style.cursor = 'row-resize'; }, [chartHeight]);
    useEffect(() => {
        const onMove = (clientY: number) => { if (!isResizing.current) return; setChartHeight(Math.min(Math.max(startHeight.current + (clientY - startY.current), 150), 500)); };
        const onUp = () => { isResizing.current = false; document.body.style.userSelect = ''; document.body.style.cursor = ''; };
        const onMouseMove = (e: MouseEvent) => onMove(e.clientY); const onTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientY);
        window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onUp); window.addEventListener('touchmove', onTouchMove); window.addEventListener('touchend', onUp);
        return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onUp); window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onUp); };
    }, [setChartHeight]);

    const chartMarginTop = { top: 10, right: 20, left: 20, bottom: 0 };
    const chartMarginBottom = { top: 0, right: 20, left: 20, bottom: 0 };

    return (
        <div className="w-full flex flex-col relative transition-none select-none" style={{ height: chartHeight, touchAction: 'none' }}>
            {selection && selectionStats && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[80] animate-in fade-in duration-100 pointer-events-none">
                    <div className="bg-[#050505]/30 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 min-w-[200px]">
                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Calendar size={12} className="text-[#C8B085]" />
                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{formatDate(selectionStats.startDate, lang)} - {formatDate(selectionStats.endDate, lang)}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setSelection(null); setIsLongPressing(false); }} className="pointer-events-auto p-1 rounded-full hover:bg-white/10 text-slate-500 hover:text-white"><X size={14} /></button>
                        </div>
                        <div className="flex justify-between items-end">
                            <div><div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Range PnL</div><div className={`text-xl font-bold font-barlow-numeric ${selectionStats.pnl >= 0 ? 'text-[#D05A5A]' : 'text-[#5B9A8B]'}`}>{formatCompactNumber(selectionStats.pnl, true)}</div></div>
                            <div className={`text-sm font-bold font-barlow-numeric mb-0.5 ${selectionStats.pct >= 0 ? 'text-[#D05A5A]' : 'text-[#5B9A8B]'}`}>{selectionStats.pct >= 0 ? '+' : ''}{formatDecimal(selectionStats.pct)}%</div>
                        </div>
                    </div>
                </div>
            )}

            {metrics.totalTrades > 0 ? (
                <>
                    <div className="flex-1 min-h-0 relative w-full z-10">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            {/* @ts-ignore */}
                            <ComposedChart 
                                data={metrics.curve} 
                                margin={chartMarginTop} 
                                syncId="tradeTrackStats"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                            >
                                <defs>
                                    <filter id="glow-line" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" /><feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.32 0 0 0 0 0.43 0 0 0 0 0.51 0 0 0 0.5 0" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
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
                                <XAxis dataKey="timestamp" type="category" hide={false} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10, dy: 3, fontWeight: 500 }} tickFormatter={(val) => formatChartAxisDate(val, frequency)} minTickGap={30} padding={{ left: 24, right: 24 }} interval="preserveStartEnd" height={24} />
                                {!isLongPressing && !selection && (
                                    <Tooltip content={(props: any) => <CustomTooltip {...props} hideAmounts={hideAmounts} lang={lang} portfolios={portfolios} />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                                )}
                                <ReferenceLine y={0} yAxisId="pnl" stroke="#FFFFFF" strokeOpacity={0.1} />
                                {selection && <ReferenceArea x1={selection.start} x2={selection.end} yAxisId="equity" fill="#C8B085" fillOpacity={0.1} strokeOpacity={0.5} />}
                                {activePortfolioIds.map((pid) => (
                                    <React.Fragment key={pid}>
                                        <Bar dataKey={`${pid}_pos`} stackId="a" fill={`url(#gradP-pos-${pid})`} radius={barRadius} barSize={barSize} yAxisId="pnl" isAnimationActive={false} />
                                        <Bar dataKey={`${pid}_neg`} stackId="a" fill={`url(#gradP-neg-${pid})`} radius={barRadius} barSize={barSize} yAxisId="pnl" isAnimationActive={false} />
                                    </React.Fragment>
                                ))}
                                <Line type="monotone" dataKey="equity" stroke={THEME.BLUE} strokeWidth={2} dot={(props) => <CustomPeakDot {...props} dataLength={metrics.curve.length} />} activeDot={{ r: 4, strokeWidth: 0 }} yAxisId="equity" isAnimationActive={false} filter="url(#glow-line)" />
                                <YAxis yAxisId="pnl" hide domain={['auto', 'auto']} />
                                <YAxis yAxisId="equity" orientation="right" hide domain={['auto', 'auto']} />
                            </ComposedChart>
                        </ResponsiveContainer>
                        
                        {!selection && !isLongPressing && (<div className="absolute top-2 right-2 text-[8px] text-slate-600 uppercase tracking-wider opacity-0 hover:opacity-100 transition-opacity pointer-events-none">Long press to select range</div>)}
                    </div>
                    
                    <div className="h-[25%] min-h-[40px] w-full relative opacity-60 mt-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={metrics.drawdown} margin={chartMarginBottom} syncId="tradeTrackStats">
                                <defs><linearGradient id="gradDDMain" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={THEME.DD_GRADIENT_TOP} stopOpacity={1}/><stop offset="100%" stopColor={THEME.DD_GRADIENT_BOTTOM} stopOpacity={0.7}/></linearGradient></defs>
                                <XAxis dataKey="timestamp" type="category" hide padding={{ left: 24, right: 24 }} />
                                <YAxis hide domain={['dataMin', 0]} />
                                <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} content={() => null} />
                                <Bar dataKey="ddPct" radius={[4, 4, 0, 0]} fill="url(#gradDDMain)" barSize={8} isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="w-full flex items-center justify-center py-1 cursor-row-resize touch-none opacity-40 hover:opacity-100 active:opacity-100 transition-opacity absolute bottom-0 left-0 z-20" onMouseDown={(e) => startResize(e.clientY)} onTouchStart={(e) => startResize(e.touches[0].clientY)}><div className="w-12 h-1 bg-white/10 rounded-full group-hover:bg-[#C8B085] transition-colors" /></div>
                </>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-16 h-16 rounded-full bg-[#C8B085]/10 flex items-center justify-center border border-[#C8B085]/20 shadow-[0_0_20px_rgba(200,176,133,0.1)]"><TrendingUp size={32} className="text-[#C8B085] opacity-80" /></div>
                    <div><h3 className="text-sm font-bold text-[#E0E0E0]">{t.emptyStateTitle}</h3><p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed mt-1">{t.emptyStateDesc}</p></div>
                </div>
            )}
        </div>
    );
};

export const StatsContent = ({ metrics, lang, hideAmounts, setDetailStrategy, stratView, setStratView, ddThreshold }: StatsContentProps) => {
    const t = I18N[lang] || I18N['zh'];
    const strategyData = useMemo(() => {
        return Object.entries(metrics.stratStats)
            .map(([name, stat]) => ({ name, stat }))
            .sort((a,b) => b.stat.pnl - a.stat.pnl);
    }, [metrics.stratStats]);

    const absDD = Math.abs(metrics.maxDD);
    const isDDBreach = absDD >= ddThreshold;
    const isDDWarning = absDD >= (ddThreshold - 3) && !isDDBreach;
    let ddCardClass = "";
    let ddValueClass = "";
    let ddValueColor = Math.abs(metrics.maxDD) > 20 ? THEME.GREEN : '#E0E0E0';
    if (isDDBreach) { ddCardClass = "bg-[#5B9A8B]/10 border-[#5B9A8B]/30 shadow-[0_0_20px_rgba(91,154,139,0.2)]"; ddValueColor = THEME.GREEN; } 
    else if (isDDWarning) { ddValueColor = THEME.GREEN; ddValueClass = "animate-pulse"; }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex flex-col gap-2">
                 <div className="grid grid-cols-3 gap-2">
                    <StatCard label={t.winRate} value={`${formatDecimal(metrics.winRate)}%`} valueColor={metrics.winRate < 40 ? THEME.GREEN : THEME.RED} />
                    <StatCard label={t.profitFactor} value={formatDecimal(metrics.pf)} valueColor={metrics.pf >= 1.5 ? THEME.RED : '#E0E0E0'} />
                    <StatCard label={t.sharpe} value={formatDecimal(metrics.sharpe)} valueColor={metrics.sharpe >= 1 ? THEME.RED : '#E0E0E0'} />
                 </div>
                 <div className="grid grid-cols-4 gap-2">
                    <StatCard label={t.maxDD} value={`${formatDecimal(metrics.maxDD)}%`} valueColor={ddValueColor} className={ddCardClass} valueClassName={ddValueClass} />
                    <StatCard label={t.riskReward} value={formatDecimal(metrics.riskReward)} valueColor="#E0E0E0" />
                    <StatCard label={t.daysSincePeak} value={metrics.maxStagnationDays} valueColor={metrics.maxStagnationDays > 30 ? THEME.GREEN : '#E0E0E0'} />
                    <StatCard label={t.trades} value={metrics.totalTrades} valueColor="#E0E0E0" />
                 </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-2">
                         <div className="p-1 rounded bg-white/5"><List size={12} className="text-slate-400"/></div>
                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.strategies}</span>
                    </div>
                    <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/5">
                        <button onClick={() => setStratView('list')} className={`p-1.5 rounded-md transition-all ${stratView === 'list' ? 'bg-[#C8B085] text-black shadow-sm' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}><List size={12} strokeWidth={2.5} /></button>
                        <button onClick={() => setStratView('chart')} className={`p-1.5 rounded-md transition-all ${stratView === 'chart' ? 'bg-[#C8B085] text-black shadow-sm' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}><ScatterIcon size={12} strokeWidth={2.5} /></button>
                    </div>
                </div>

                {stratView === 'list' ? (
                    <StrategyListView data={strategyData} onSelect={(name) => setDetailStrategy(name)} lang={lang} />
                ) : (
                    <>
                        <StrategyBubbleChart data={strategyData} onSelect={(name) => setDetailStrategy(name)} lang={lang} hideAmounts={hideAmounts} />
                        <div className="flex overflow-x-auto gap-2 pb-2 -mx-1 px-1 no-scrollbar mask-gradient-right">
                            {strategyData.map((d, index) => {
                                const parts = d.name.split('_');
                                const name = parts[0];
                                return (
                                    <button key={d.name} onClick={() => setDetailStrategy(d.name)} className="flex-shrink-0 flex items-center gap-2 pl-1.5 pr-3 py-1.5 bg-[#1A1C20]/40 border border-white/10 rounded-full hover:bg-[#1A1C20] hover:border-white/20 transition-all group backdrop-blur-sm">
                                        <div className="w-5 h-5 rounded-full bg-[#C8B085]/10 flex items-center justify-center border border-[#C8B085]/20 text-[#C8B085] font-bold font-barlow-numeric text-[10px] group-hover:bg-[#C8B085] group-hover:text-black transition-colors">{index + 1}</div>
                                        <div className="flex flex-col items-start leading-none"><span className="text-[10px] font-bold text-slate-200 whitespace-nowrap">{name}</span></div>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
