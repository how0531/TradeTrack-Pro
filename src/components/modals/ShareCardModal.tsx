
import React, { useState, useRef, useId } from 'react';
import { X, Loader2, Download, Eye, Layers, ArrowLeftRight } from 'lucide-react';
import { ComposedChart, Area, Bar, Cell, ResponsiveContainer, YAxis } from 'recharts';
import html2canvas from 'html2canvas';
import { Metrics, Lang } from '../../types';
import { I18N, THEME } from '../../constants';
import { formatCompactNumber, formatDecimal } from '../../utils/format';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    metrics: Metrics;
    lang: Lang;
}

type DisplayMode = 'amount' | 'percent' | 'hidden';

export const ShareModal = ({ isOpen, onClose, metrics, lang }: ShareModalProps) => {
    // 1. Always call hooks at the top level, even if !isOpen (though standard pattern often returns null early)
    // To be safe with hooks like useId, we should render hooks first or conditionally render the whole component from parent.
    // Assuming parent renders conditionally or we accept `useId` calls potentially changing if we return early.
    // Best practice: Standard hooks first.
    
    // We'll keep the early return for performance if that's the pattern, but `useId` is safe to call.
    const uniqueId = useId(); 
    const cardRef = useRef<HTMLDivElement>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [displayMode, setDisplayMode] = useState<DisplayMode>('amount');
    const [showChart, setShowChart] = useState(true);

    if (!isOpen) return null;

    const t = I18N[lang] || I18N['zh']; // Fallback to zh if undefined
    
    // Use netProfit for accurate period PnL
    const isProfit = metrics.netProfit >= 0;
    const themeColor = isProfit ? '#D05A5A' : '#5B9A8B';
    const drawdownColor = '#5B9A8B'; // Green color for Drawdown "loss" representation
    
    // Background Gradient based on performance
    const bgGradient = isProfit 
        ? 'radial-gradient(circle at 50% 0%, rgba(208, 90, 90, 0.15), transparent 70%)'
        : 'radial-gradient(circle at 50% 0%, rgba(91, 154, 139, 0.15), transparent 70%)';

    // Date Range Logic
    const formatRangeDate = (d: string) => {
        if (!d || d === 'Start' || d === 'Initial') return 'Start'; // Internal flag
        // Assume YYYY-MM-DD
        if (d.length >= 10) {
            return d.replace(/-/g, '.');
        }
        return d;
    };

    // Find first meaningful date (skip 'Start' anchor point)
    const firstRealPoint = metrics.curve.find(p => p.fullDate !== 'Start' && p.fullDate !== 'Initial');
    const startDateRaw = firstRealPoint ? firstRealPoint.fullDate : (metrics.curve[0]?.fullDate || '');
    const endDateRaw = metrics.curve.length > 0 ? metrics.curve[metrics.curve.length - 1].fullDate : '';
    
    let dateRangeStr = 'No Data';
    if (startDateRaw && endDateRaw) {
        const start = formatRangeDate(startDateRaw);
        const end = formatRangeDate(endDateRaw);
        
        if (start === 'Start' && end === 'Start') {
            dateRangeStr = 'New Account';
        } else if (start === 'Start') {
             // Only end date valid
             dateRangeStr = end; 
        } else {
             // Both valid
             dateRangeStr = `${start} - ${end.substring(5)}`;
        }
    }

    // Chart Data (Last 50 points for cleaner look or all if less)
    const chartData = metrics.curve.length > 50 ? metrics.curve.slice(-50) : metrics.curve;
    
    // SVG Filter IDs scoped to this instance to prevent collisions
    const glowId = `glow-line-share-${uniqueId}`;
    const gradientId = `areaGradient-${uniqueId}`;

    const handleSaveImage = async () => {
        if (!cardRef.current || isSharing) return;

        setIsSharing(true);
        try {
            // Short Render wait to ensure any repaints are finished
            await new Promise(resolve => setTimeout(resolve, 100)); 
            
            const canvas = await html2canvas(cardRef.current, {
                backgroundColor: null, // Transparent background outside border-radius
                scale: 3, // High Resolution
                useCORS: true,
                logging: false,
                // Attempt to fix potential DOM interaction issues:
                ignoreElements: (element) => {
                     // Ignore any elements that might cause issues if necessary, 
                     // usually not needed unless specific plugins interfere
                     return false;
                }
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

    // Helper to split number and unit for styling
    const getFormattedValueParts = () => {
        if (displayMode === 'hidden') return { value: '****', unit: '' };
        
        let fullStr = '';
        if (displayMode === 'amount') {
            fullStr = formatCompactNumber(metrics.netProfit, false).replace('+', '');
        } else {
            fullStr = `${formatDecimal(metrics.netProfitPct)}%`;
        }

        // Match number part and non-number suffix (unit)
        const match = fullStr.match(/^([-\d.,]+)(.*)$/);
        if (match) {
            return { value: match[1], unit: match[2] };
        }
        return { value: fullStr, unit: '' };
    };

    const { value, unit } = getFormattedValueParts();

    return (
        <div className="fixed inset-0 z-[150] bg-black flex flex-col animate-in fade-in duration-300">
            {/* Main Preview Area */}
            <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: bgGradient }}></div>

                {/* THE CARD TO CAPTURE */}
                <div 
                    ref={cardRef}
                    className="w-full max-w-[340px] aspect-[4/5] bg-black rounded-3xl border border-white/10 relative overflow-hidden flex flex-col shadow-2xl"
                >
                    {/* Header */}
                    <div className="p-6 pb-2 flex justify-between items-start z-10">
                        <div>
                            <h3 className="text-white font-bold text-lg tracking-wider">交易損益</h3>
                            <p className="text-[#666] font-barlow-numeric text-[11px] mt-0.5 tracking-wide font-medium">
                                {dateRangeStr}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-80">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#C8B085]"></div>
                            <span className="text-[#C8B085] font-bold text-[10px] tracking-widest uppercase">TradeTrack</span>
                        </div>
                    </div>

                    {/* Main Stats Area - REVISED LAYOUT */}
                    <div className="w-full px-6 z-10 relative flex flex-col items-start min-h-[80px] mt-4">
                        {/* Changed to flex-row and whitespace-nowrap to FORCE side-by-side */}
                        <div className="flex flex-row items-baseline gap-3 whitespace-nowrap">
                             {/* Main Number */}
                             <div className="flex items-baseline">
                                <span 
                                    className={`font-bold font-barlow-numeric tracking-tighter leading-none drop-shadow-2xl transition-all duration-300 ${displayMode === 'hidden' ? 'blur-md opacity-50 select-none' : ''}`}
                                    style={{ color: themeColor, fontSize: '40px' }}
                                >
                                    {displayMode === 'hidden' ? '888.88' : value}
                                </span>
                                {unit && displayMode !== 'hidden' && (
                                    <span className="text-xl font-bold opacity-80 ml-1" style={{ color: themeColor }}>
                                        {unit}
                                    </span>
                                )}
                             </div>

                             {/* Max Drawdown - Right Aligned, aligned to baseline */}
                             <div className="flex items-center gap-1.5">
                                <span className={`font-barlow-numeric text-lg font-bold ${displayMode === 'hidden' ? 'blur-sm opacity-50' : ''}`} style={{ color: drawdownColor }}>
                                    {displayMode === 'hidden' ? '00.00' : formatDecimal(Math.abs(metrics.maxDD))}%
                                </span>
                                <span className="text-[#555] text-[10px] font-bold uppercase tracking-wider translate-y-[1px]">回撤</span>
                            </div>
                        </div>
                    </div>

                    {/* Background Chart - Area Chart for smoother look */}
                    {showChart && chartData.length > 0 && (
                        <div className="absolute inset-x-0 bottom-[25%] top-[40%] opacity-100 pointer-events-none">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <defs>
                                        <filter id={glowId} height="200%">
                                            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                                            {/* Blue Glow Matrix matching THEME.BLUE */}
                                            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.32 0 0 0 0 0.43 0 0 0 0 0.51 0 0 0 0.5 0" result="coloredBlur" />
                                            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                        </filter>
                                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#526D82" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#526D82" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    
                                    {/* PnL Bars (Subtle Background) */}
                                    <Bar dataKey="pnl" yAxisId="pnl" radius={[1, 1, 0, 0]} barSize={3}>
                                        {chartData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={entry.pnl >= 0 ? '#D05A5A' : '#5B9A8B'} 
                                                fillOpacity={0.3} 
                                            />
                                        ))}
                                    </Bar>

                                    {/* Equity Area (Prominent Foreground) */}
                                    <Area
                                        yAxisId="equity"
                                        type="monotone"
                                        dataKey="equity"
                                        stroke="#526D82"
                                        strokeWidth={2}
                                        fill={`url(#${gradientId})`}
                                        fillOpacity={1}
                                        filter={`url(#${glowId})`}
                                        isAnimationActive={false}
                                        dot={({cx, cy, payload, index}) => {
                                            // Only show dots for peaks or ends to reduce clutter
                                            const isLast = index === chartData.length - 1;
                                            if (payload.isNewPeak || isLast) {
                                                return <circle cx={cx} cy={cy} r={3} fill="#C8B085" stroke="#1A1B23" strokeWidth={1} />;
                                            }
                                            return <></>;
                                        }}
                                    />

                                    {/* Hidden Axes */}
                                    <YAxis yAxisId="pnl" hide domain={['auto', 'auto']} />
                                    <YAxis yAxisId="equity" orientation="right" hide domain={['auto', 'auto']} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Footer Grid Stats */}
                    <div className="mt-auto border-t border-white/10 bg-white/[0.02] backdrop-blur-sm z-10 grid grid-cols-3 divide-x divide-white/10">
                        <div className="py-5 flex flex-col items-center justify-center">
                             <span className="text-[#555] text-[9px] font-bold uppercase tracking-widest mb-1">
                                {t.winRate || '勝率'}
                             </span>
                             <span className="text-white font-bold font-barlow-numeric text-lg tracking-wide">
                                 {formatDecimal(metrics.winRate)}<span className="text-xs opacity-60 ml-0.5">%</span>
                             </span>
                        </div>
                        <div className="py-5 flex flex-col items-center justify-center">
                             <span className="text-[#555] text-[9px] font-bold uppercase tracking-widest mb-1">
                                {t.totalTrades || '交易筆數'}
                             </span>
                             <span className="text-white font-bold font-barlow-numeric text-lg tracking-wide">
                                 {metrics.totalTrades}
                             </span>
                        </div>
                        <div className="py-5 flex flex-col items-center justify-center">
                             <span className="text-[#555] text-[9px] font-bold uppercase tracking-widest mb-1">
                                {t.riskReward || '賺賠比'}
                             </span>
                             <span className="text-white font-bold font-barlow-numeric text-lg tracking-wide">
                                 {metrics.riskReward === Infinity ? '∞' : formatDecimal(metrics.riskReward)}
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
