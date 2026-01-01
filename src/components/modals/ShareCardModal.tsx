
import React, { useState } from 'react';
import { X, Loader2, Download, Eye, EyeOff, Layers, Share2 } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
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

export const ShareModal = ({ isOpen, onClose, metrics, lang }: ShareModalProps) => {
    if (!isOpen) return null;

    const [isSharing, setIsSharing] = useState(false);
    const [hideAmount, setHideAmount] = useState(false);
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

    // Chart Data (Last 30 points for cleaner look or all if less)
    const chartData = metrics.curve.length > 50 ? metrics.curve.slice(-50) : metrics.curve;

    const handleSaveImage = async () => {
        const element = document.getElementById('share-card-capture');
        if (!element || isSharing) return;

        setIsSharing(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // Render wait
            const canvas = await html2canvas(element, {
                backgroundColor: '#000000',
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
                    <div className="p-6 flex justify-between items-start z-10">
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

                    {/* Main Stats (Center) */}
                    <div className="flex-1 flex flex-col items-center justify-center z-10 relative -mt-8">
                        {/* Big Number */}
                        {/* Font size reduced from text-[80px] to text-6xl (approx 60px) for better fit */}
                        <div 
                            className="text-6xl font-bold font-barlow-numeric tracking-tighter leading-none drop-shadow-2xl"
                            style={{ color: themeColor }}
                        >
                            {hideAmount ? '****' : formatCompactNumber(metrics.netProfit, false).replace('+', '')}
                        </div>
                        {/* Percentage / Label */}
                        <div className="text-3xl font-bold font-barlow-numeric text-white mt-2">
                             {hideAmount ? '**.**%' : `${formatDecimal(metrics.netProfitPct)}%`}
                        </div>
                    </div>

                    {/* Background Chart */}
                    {showChart && chartData.length > 0 && (
                        <div className="absolute inset-x-0 bottom-[20%] h-[40%] opacity-40 mix-blend-screen pointer-events-none">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="shareChartGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={themeColor} stopOpacity={0.5}/>
                                            <stop offset="100%" stopColor={themeColor} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <Area 
                                        type="monotone" 
                                        dataKey="equity" 
                                        stroke={themeColor} 
                                        strokeWidth={3} 
                                        fill="url(#shareChartGrad)" 
                                        isAnimationActive={false}
                                    />
                                </AreaChart>
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
                            onClick={() => setHideAmount(!hideAmount)}
                            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-slate-400 font-bold text-xs uppercase hover:bg-white/10 transition-colors"
                        >
                            {hideAmount ? <Eye size={16}/> : <EyeOff size={16}/>}
                            <span>{hideAmount ? '顯示金額' : '隱藏金額'}</span>
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
