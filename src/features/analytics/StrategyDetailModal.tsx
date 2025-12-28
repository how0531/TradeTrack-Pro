
// [Manage] Last Updated: 2024-05-22
import React from 'react';
import { X, Target, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { StrategyDetailModalProps } from '../../types';
import { I18N, THEME } from '../../constants';
import { formatCurrency, formatDecimal, getPnlColor } from '../../utils/format';

const GlassStat = ({ label, value, subValue, color, icon: Icon, size = "normal" }: any) => (
    <div className={`relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] backdrop-blur-sm flex flex-col justify-center transition-all hover:bg-white/[0.06] ${size === 'large' ? 'p-3 aspect-[1.6/1]' : 'p-3'}`}>
        <div className="flex justify-between items-start mb-1.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            {Icon && <Icon size={12} className="text-slate-500 opacity-60" />}
        </div>
        <div className={`font-barlow-numeric font-bold tracking-tight ${size === 'large' ? 'text-xl' : 'text-base'}`} style={{ color: color || '#FFF' }}>
            {value}
        </div>
        {subValue && (
            <div className="text-[9px] font-medium text-slate-500 mt-0.5">{subValue}</div>
        )}
    </div>
);

const EquityCurveTooltip = ({ active, payload, hideAmounts }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-2 rounded-lg border border-white/10 shadow-xl bg-black/20 backdrop-blur-md text-[10px] z-50 min-w-[100px]">
                <div className="text-slate-400 mb-1 font-medium">{payload[0].payload.date || 'Date'}</div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C8B085]"></div>
                    <span className="text-[#C8B085] font-bold font-barlow-numeric text-xs">{formatCurrency(payload[0].value, hideAmounts)}</span>
                </div>
            </div>
        );
    }
    return null;
};

export const StrategyDetailModal = ({ strategy, metrics, onClose, lang, hideAmounts, ddThreshold }: StrategyDetailModalProps) => {
    if (!strategy || !metrics) return null;
    const t = I18N[lang] || I18N['zh'];

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    const pieData = [
        { name: 'Win', value: metrics.winRate, color: THEME.RED },
        { name: 'Loss', value: 100 - metrics.winRate, color: '#333' }
    ];

    const pnlColor = getPnlColor(metrics.netProfit);

    return (
        <div 
            onClick={handleBackdropClick}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-300 backdrop-blur-sm"
        >
            {/* Main Card - Reduced Width to 320px for compactness */}
            <div className="w-full max-w-[320px] bg-black/40 rounded-[24px] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative animate-in zoom-in-95 duration-300 backdrop-blur-xl ring-1 ring-white/5">
                
                {/* Decorative Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-20 bg-[#C8B085]/10 blur-[50px] pointer-events-none"></div>

                {/* Header - More Compact */}
                <div className="px-5 pt-5 pb-2 flex justify-between items-start relative z-10">
                    <div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <Target size={10} /> {t.strategyAnalysis}
                        </div>
                        <h2 className="font-bold text-xl text-white tracking-tight leading-none text-shadow-sm">{strategy}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 -mr-1 -mt-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="overflow-y-auto no-scrollbar p-4 space-y-3 relative z-10">
                    
                    {/* Top Stats Row: Net Profit & Profit Factor */}
                    <div className="grid grid-cols-2 gap-2">
                        <GlassStat 
                            label={t.netProfit} 
                            value={formatCurrency(metrics.netProfit, hideAmounts)} 
                            color={pnlColor}
                            size="large"
                        />
                        <GlassStat 
                            label={t.profitFactor} 
                            value={formatDecimal(metrics.pf)} 
                            size="large"
                            icon={Zap}
                        />
                    </div>

                    {/* Middle Section: Win Rate Donut & List Stats */}
                    <div className="flex gap-2 h-28">
                        {/* Win Rate Circle */}
                        <div className="w-[100px] shrink-0 rounded-xl border border-white/5 bg-white/[0.03] backdrop-blur-sm flex flex-col items-center justify-center relative p-1">
                            <div className="absolute top-2 left-2 text-[8px] font-bold text-slate-500 uppercase tracking-widest">{t.winRate}</div>
                            <div className="relative w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            innerRadius={28}
                                            outerRadius={34}
                                            startAngle={90}
                                            endAngle={-270}
                                            dataKey="value"
                                            stroke="none"
                                            cornerRadius={3}
                                            paddingAngle={4}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center mt-1">
                                    <span className="text-base font-bold font-barlow-numeric text-white">{formatDecimal(metrics.winRate)}%</span>
                                    <span className="text-[8px] font-bold text-slate-500 uppercase">WIN</span>
                                </div>
                            </div>
                        </div>

                        {/* List Stats - Compact Grid */}
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="flex-1 rounded-xl border border-white/5 bg-white/[0.03] backdrop-blur-sm px-3 py-1 flex items-center justify-between">
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t.trades}</div>
                                <div className="text-sm font-bold font-barlow-numeric text-white">{metrics.totalTrades}</div>
                            </div>
                            <div className="flex-1 rounded-xl border border-white/5 bg-white/[0.03] backdrop-blur-sm px-3 py-1 flex items-center justify-between">
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t.sharpe}</div>
                                <div className="text-sm font-bold font-barlow-numeric text-white">{formatDecimal(metrics.sharpe)}</div>
                            </div>
                            <div className="flex-1 rounded-xl border border-white/5 bg-white/[0.03] backdrop-blur-sm px-3 py-1 flex items-center justify-between">
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t.avgWin}</div>
                                <div className="text-sm font-bold font-barlow-numeric text-[#D05A5A]">{formatCurrency(metrics.avgWin, hideAmounts)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Equity Curve (Golden) - Reduced Height */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.03] backdrop-blur-sm p-3 pb-0 space-y-1">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex justify-between">
                            <span>{t.currentEquity}</span>
                            <span className="text-slate-600 opacity-50">Curve</span>
                        </div>
                        <div className="h-20 w-full -ml-1">
                             <ResponsiveContainer width="100%" height="100%">
                                 <AreaChart data={metrics.curve}>
                                    <defs>
                                        <linearGradient id="gradStratGold" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#C8B085" stopOpacity={0.4}/>
                                            <stop offset="100%" stopColor="#C8B085" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <Area 
                                        type="monotone" 
                                        dataKey="cumulativePnl" 
                                        stroke="#C8B085" 
                                        strokeWidth={1.5} 
                                        fill="url(#gradStratGold)" 
                                        isAnimationActive={true}
                                    />
                                    <Tooltip content={<EquityCurveTooltip hideAmounts={hideAmounts} />} cursor={{stroke: 'white', strokeOpacity: 0.1, strokeDasharray: '3 3'}} />
                                 </AreaChart>
                             </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Bottom Row: MDD & RR */}
                    <div className="grid grid-cols-2 gap-2">
                         <GlassStat 
                            label={t.maxDD} 
                            value={`${formatDecimal(metrics.maxDD)}%`}
                            color={Math.abs(metrics.maxDD) > ddThreshold ? '#D05A5A' : '#5B9A8B'}
                            icon={TrendingDown}
                         />
                         <GlassStat 
                            label={t.riskReward} 
                            value={formatDecimal(metrics.riskReward)}
                            icon={TrendingUp}
                         />
                    </div>
                </div>
            </div>
        </div>
    );
};
