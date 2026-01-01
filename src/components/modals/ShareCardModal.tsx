
import React, { useState } from 'react';
import { X, Loader2, Download, Eye, Layers, Share2, ArrowLeftRight } from 'lucide-react';
import { ComposedChart, Line, Bar, Cell, ResponsiveContainer, YAxis } from 'recharts';
import html2canvas from 'html2canvas';
import { Metrics, Lang } from '../../types';
import { I18N, THEME } from '../../constants';
import { formatCompactNumber, formatDecimal, formatDate } from '../../utils/format';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    metrics: Metrics;
    lang: Lang;
}

type DisplayMode = 'amount' | 'percent' | 'hidden';

export const ShareModal = ({ isOpen, onClose, metrics, lang }: ShareModalProps) => {
    if (!isOpen) return null;

    const [isSharing, setIsSharing] = useState(false);
    const [displayMode, setDisplayMode] = useState<DisplayMode>('amount');
    const [showChart, setShowChart] = useState(true);

    const t = I18N[lang] || I18N['zh'];
    // Use netProfit for accurate period PnL
    const isProfit = metrics.netProfit >= 0;
    const themeColor = isProfit ? '#D05A5A' : '#5B9A8B';
    
    // Background Gradient based on performance
    const bgGradient = isProfit 
        ? 'radial-gradient(circle at 50% 0%, rgba(208, 90, 90, 0.15), transparent 70%)'
        : 'radial-gradient(circle at 50% 0%, rgba(91, 154, 139, 0.15), transparent 70%)';

    // Date Range Logic
    const startDate = metrics.curve.length > 0 ? metrics.curve[0].date : '';
    const endDate = metrics.curve.length > 0 ? metrics.curve[metrics.curve.length - 1].date : '';
    const dateRangeStr = startDate && endDate ? `${startDate} - ${endDate}` : 'No Data';

    // Chart Data (Last 50 points for cleaner look or all if less)
    const chartData = metrics.curve.length > 50 ? metrics.curve.slice(-50) : metrics.curve;

    const handleSaveImage = async () => {
        const element = document.getElementById('share-card-capture');
        if (!element || isSharing) return;

        setIsSharing(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // Render wait
            const canvas = await html2canvas(element, {
                backgroundColor: null, // Transparent background outside border-radius
                scale: 3, // High Resolution
                useCORS: true,
                logging: false,
            });

            const link = document.createElement('a');
            link.download = `tradetrack_stats_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Share failed', error);
            alert('Failed to generate image');
        } finally {
            setIsSharing(false);
        }
    };

    const toggleDisplayMode = () => {
        if (displayMode === 'amount') setDisplayMode('percent');
        else if (displayMode === 'percent') setDisplayMode('hidden');
        else setDisplayMode('amount');
    };

    const getDisplayModeLabel = () => {
        if (displayMode === 'amount') return '顯示: 金額';
        if (displayMode === 'percent') return '顯示: %';
        return '顯示: 隱藏';
    };

    return (
        <div className="fixed inset-0 z-[150] bg-black flex flex-col animate-in fade-in duration-300">
            {/* Main Preview Area */}
            <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: bgGradient }}></div>

                {/* THE CARD TO CAPTURE */}
                <div 
                    id="share-card-capture" 
                    className="w-full max-w-[340px] aspect-[4/5] bg-black rounded-3xl border border-white/10 relative overflow-hidden flex flex-col shadow-2xl"
                >
                    {/* Header */}
                    <div className="p-6 pb-2 flex justify-between items-start z-10">
                        <div>
                            <h3 className="text-white/60 font-bold text-sm tracking-widest uppercase">帳戶績效</h3>
                            <p className="text-[#555] font-mono text-[10px] mt-1 tracking-wide font-bold">
                                {dateRangeStr}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#C8B085]"></div>
                            <span className="text-[#C8B085] font-bold text-xs tracking-wide">TradeTrack</span>
                        </div>
                    </div>

                    {/* Main Stats (Top Aligned) */}
                    <div className="w-full px-6 z-10 relative flex flex-col items-start min-h-[60px]">
                        {displayMode !== 'hidden' && (
                            <div 
                                className="text-5xl font-bold font-barlow-numeric tracking-tighter leading-none drop-shadow-2xl mt-1"
                                style={{ color: themeColor }}
                            >
                                {displayMode === 'amount' 
                                    ? formatCompactNumber(metrics.netProfit, false).replace('+', '') 
                                    : `${formatDecimal(metrics.netProfitPct)}%`
                                }
                            </div>
                        )}
                    </div>

                    {/* Background Chart - EXACT REPLICA OF MAIN APP STYLE */}
                    {showChart && chartData.length > 0 && (
                        <div className="absolute inset-x-0 bottom-[20%] top-[30%] opacity-100 pointer-events-none">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <defs>
                                        <filter id="glow-line-share" height="200%">
                                            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                                            {/* Blue Glow Matrix matching THEME.BLUE */}
                                            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.32 0 0 0 0 0.43 0 0 0 0 0.51 0 0 0 0.5 0" result="coloredBlur" />
                                            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                        </filter>
                                    </defs>
                                    
                                    {/* PnL Bars (Background) */}
                                    <Bar dataKey="pnl" yAxisId="pnl" radius={[2, 2, 0, 0]} barSize={4}>
                                        {chartData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={entry.pnl >= 0 ? '#D05A5A' : '#5B9A8B'} 
                                                fillOpacity={0.5} 
                                            />
                                        ))}
                                    </Bar>

                                    {/* Equity Line (Foreground with Glow) */}
                                    <Line 
                                        yAxisId="equity"
                                        type="monotone" 
                                        dataKey="equity" 
                                        stroke="#526D82" // Fixed Blue to match app theme
                                        strokeWidth={2} 
                                        dot={({cx, cy, payload}) => {
                                            if (payload.isNewPeak) return <circle cx={cx} cy={cy} r={3} fill="#C8B085" stroke="none" />;
                                            return <></>;
                                        }}
                                        isAnimationActive={false}
                                        filter="url(#glow-line-share)"
                                    />

                                    {/* Hidden Axes for Dual Scaling */}
                                    <YAxis yAxisId="pnl" hide domain={['auto', 'auto']} />
                                    <YAxis yAxisId="equity" orientation="right" hide domain={['auto', 'auto']} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Footer Grid Stats */}
                    <div className="mt-auto border-t border-white/10 bg-white/[0.02] backdrop-blur-sm z-10 grid grid-cols-3 divide-x divide-white/10">
                        <div className="py-5 flex flex-col items-center justify-center">
                             <span className="text-[#555] text-[9px] font-bold uppercase tracking-widest mb-1">{t.winRate}</span>
                             <span className="text-white font-bold font-barlow-numeric text-lg">
                                 {formatDecimal(metrics.winRate)}%
                             </span>
                        </div>
                        <div className="py-5 flex flex-col items-center justify-center">
                             <span className="text-[#555] text-[9px] font-bold uppercase tracking-widest mb-1">交易筆數</span>
                             <span className="text-white font-bold font-barlow-numeric text-lg">
                                 {metrics.totalTrades}
                             </span>
                        </div>
                        <div className="py-5 flex flex-col items-center justify-center">
                             <span className="text-[#555] text-[9px] font-bold uppercase tracking-widest mb-1">{t.riskReward}</span>
                             <span className="text-white font-bold font-barlow-numeric text-lg">
                                 {formatDecimal(metrics.riskReward)}
                             </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls Bar (Fixed Bottom) */}
            <div className="bg-[#141619] border-t border-white/10 p-4 pb-8 safe-area-bottom z-50">
                <div className="max-w-md mx-auto space-y-4">
                    {/* Toggles */}
                    <div className="flex gap-3">
                        <button 
                            onClick={toggleDisplayMode}
                            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-slate-400 font-bold text-xs uppercase hover:bg-white/10 transition-colors"
                        >
                            {displayMode === 'hidden' ? <Eye size={16}/> : <ArrowLeftRight size={16}/>}
                            <span>{getDisplayModeLabel()}</span>
                        </button>
                        <button 
                            onClick={() => setShowChart(!showChart)}
                            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-slate-400 font-bold text-xs uppercase hover:bg-white/10 transition-colors"
                        >
                            <Layers size={16} className={showChart ? 'text-[#C8B085]' : ''}/>
                            <span>{showChart ? '顯示圖表' : '隱藏圖表'}</span>
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button 
                            onClick={onClose}
                            className="w-14 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10"
                        >
                            <X size={20} />
                        </button>
                        <button 
                            onClick={handleSaveImage}
                            disabled={isSharing}
                            className="flex-1 py-4 rounded-xl bg-[#C8B085] text-black font-bold text-sm uppercase tracking-wider shadow-lg shadow-[#C8B085]/20 hover:bg-[#D9C298] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {isSharing ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                            儲存圖片
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
