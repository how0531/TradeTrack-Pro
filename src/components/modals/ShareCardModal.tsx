
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
    const [showDD, setShowDD] = useState(false);

    const t = I18N[lang] || I18N['zh'];
    const isProfit = metrics.netProfit >= 0;
    const themeColor = isProfit ? '#D05A5A' : '#5B9A8B';
    
    // Background Gradient based on performance
    const bgGradient = isProfit 
        ? 'radial-gradient(circle at 50% 0%, rgba(208, 90, 90, 0.15), transparent 70%)'
        : 'radial-gradient(circle at 50% 0%, rgba(91, 154, 139, 0.15), transparent 70%)';

    // Date Range Logic - Intelligence to skip "Start" point
    const curve = metrics.curve;
    const firstDatePoint = curve.length > 0 ? (curve[0].date === 'Start' || curve[0].date === 'Initial' ? (curve[1] ? curve[1].date : curve[0].date) : curve[0].date) : '';
    const lastDatePoint = curve.length > 0 ? curve[curve.length - 1].date : '';
    
    const formatDateDot = (dateStr: string, full: boolean) => {
        if (!dateStr || dateStr === 'Start' || dateStr === 'Initial') return dateStr;
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;

            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return full ? `${yyyy}.${mm}.${dd}` : `.${mm}.${dd}`;
        } catch { return dateStr; }
    };

    const dateRangeStr = firstDatePoint && lastDatePoint 
        ? `${formatDateDot(firstDatePoint, true)}-${formatDateDot(lastDatePoint, false)}`
        : 'No Data';

    // Chart Data
    const chartData = metrics.curve.length > 50 ? metrics.curve.slice(-50) : metrics.curve;

    const handleSaveImage = async () => {
        const element = document.getElementById('share-card-capture');
        if (!element || isSharing) return;

        setIsSharing(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // Render wait
            const canvas = await html2canvas(element, {
                backgroundColor: null,
                scale: 3,
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

    const mainNumberGradient = isProfit 
        ? 'linear-gradient(135deg, #FF8F8F 0%, #D05A5A 50%, #A33A3A 100%)' // Richer Red
        : 'linear-gradient(135deg, #7FFFD4 0%, #5B9A8B 50%, #2C5F54 100%)'; // Richer Green

    // Calculate Period Return % (based on start equity of the period)
    const startEquity = metrics.currentEq - metrics.netProfit;
    const periodReturnPct = startEquity !== 0 ? (metrics.netProfit / startEquity) * 100 : 0;

    return (
        <div className="fixed inset-0 z-[150] bg-black flex flex-col animate-in fade-in duration-300">
            {/* Main Preview Area */}
            <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: bgGradient, opacity: 0.2 }}></div>

                {/* THE CARD TO CAPTURE */}
                <div 
                    id="share-card-capture" 
                    className="w-full max-w-[340px] aspect-[4/5] bg-black rounded-[32px] border border-white/20 relative overflow-hidden flex flex-col shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)]"
                    style={{
                        boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 20px 50px -10px ${isProfit ? 'rgba(208, 90, 90, 0.3)' : 'rgba(91, 154, 139, 0.3)'}`
                    }}
                >
                    {/* Header */}
                    <div className="p-7 pb-2 flex justify-between items-start z-10">
                        <div>
                            <h3 className="text-white/80 font-bold text-sm tracking-widest uppercase">帳戶獲利</h3>
                            <p className="text-[#888] font-mono text-xs mt-1.5 tracking-wide font-medium">
                                {dateRangeStr}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-80">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#C8B085]"></div>
                            <span className="text-[#C8B085] font-bold text-[10px] tracking-widest uppercase">TradeTrack</span>
                        </div>
                    </div>

                    {/* Main Stats (Top Aligned) */}
                    <div className="w-full px-7 z-10 relative flex flex-col items-start min-h-[80px] justify-center">
                        {displayMode !== 'hidden' && (
                            <div 
                                className="text-[42px] font-black font-barlow-numeric tracking-tighter leading-none drop-shadow-2xl mt-2 bg-clip-text text-transparent"
                                style={{ backgroundImage: mainNumberGradient }}
                            >
                                {displayMode === 'amount' 
                                    ? formatCompactNumber(metrics.netProfit, false).replace('+', '') 
                                    : `${formatDecimal(periodReturnPct)}%`
                                }
                            </div>
                        )}
                        {displayMode === 'hidden' && (
                             <div className="text-3xl font-bold text-white/20 mt-4 tracking-widest opacity-0">HIDDEN</div>
                        )}
                    </div>

                    {/* Background Chart */}
                    {showChart && chartData.length > 0 && (
                        <div className="absolute inset-x-0 bottom-[25%] top-[25%] opacity-100 pointer-events-none">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <defs>
                                        <filter id="glow-line-share" height="200%">
                                            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                                            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.32 0 0 0 0 0.43 0 0 0 0 0.51 0 0 0 0.5 0" result="coloredBlur" />
                                            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                        </filter>
                                        <linearGradient id="equityLineGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#87A6C1" stopOpacity={0.4}/>
                                            <stop offset="50%" stopColor="#A9D0F5" stopOpacity={1}/>
                                            <stop offset="100%" stopColor="#87A6C1" stopOpacity={0.4}/>
                                        </linearGradient>
                                    </defs>
                                    
                                    <Bar dataKey="pnl" yAxisId="pnl" radius={[2, 2, 0, 0]} barSize={4}>
                                        {chartData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={entry.pnl >= 0 ? '#D05A5A' : '#5B9A8B'} 
                                                fillOpacity={0.3} 
                                            />
                                        ))}
                                    </Bar>

                                    <Line 
                                        yAxisId="equity"
                                        type="monotone" 
                                        dataKey="equity" 
                                        stroke="url(#equityLineGradient)" 
                                        strokeWidth={3} 
                                        dot={({cx, cy, payload}) => {
                                            if (payload.isNewPeak) return <circle cx={cx} cy={cy} r={4} fill="#C8B085" stroke="rgba(0,0,0,0.5)" strokeWidth={2} />;
                                            return <></>;
                                        }}
                                        isAnimationActive={false}
                                        filter="url(#glow-line-share)"
                                    />

                                    <YAxis yAxisId="pnl" hide domain={['auto', 'auto']} />
                                    <YAxis yAxisId="equity" orientation="right" hide domain={['auto', 'auto']} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Footer Grid Stats */}
                    <div className={`mt-auto border-t border-white/10 bg-white/[0.03] backdrop-blur-md z-10 grid ${showDD ? 'grid-cols-4' : 'grid-cols-3'} divide-x divide-white/10`}>
                        <div className="py-6 flex flex-col items-center justify-center gap-1">
                             <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{t.winRate}</span>
                             <span className="text-white font-black font-barlow-numeric text-xl tracking-tight">
                                 {formatDecimal(metrics.winRate)}%
                             </span>
                        </div>
                        <div className="py-6 flex flex-col items-center justify-center gap-1">
                             <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">交易筆數</span>
                             <span className="text-white font-black font-barlow-numeric text-xl tracking-tight">
                                 {metrics.totalTrades}
                             </span>
                        </div>
                        {showDD && (
                            <div className="py-6 flex flex-col items-center justify-center gap-1">
                                <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{t.maxDD}</span>
                                <span className="text-[#5B9A8B] font-black font-barlow-numeric text-xl tracking-tight">
                                    {formatDecimal(metrics.maxDD)}%
                                </span>
                            </div>
                        )}
                        <div className="py-6 flex flex-col items-center justify-center gap-1">
                             <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{t.riskReward}</span>
                             <span className="text-white font-black font-barlow-numeric text-xl tracking-tight">
                                 {formatDecimal(metrics.riskReward)}
                             </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls Bar (Fixed Bottom) */}
            <div className="bg-[#141619] border-t border-white/10 p-4 pb-8 safe-area-bottom z-50">
                <div className="max-w-md mx-auto space-y-4">
                    {/* Toggles Row 1 */}
                    <div className="flex gap-3">
                        <button 
                            onClick={toggleDisplayMode}
                            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-slate-400 font-bold text-xs uppercase hover:bg-white/10 transition-colors"
                        >
                            {displayMode === 'hidden' ? <Eye size={16}/> : <ArrowLeftRight size={16}/>}
                            <span>{getDisplayModeLabel()}</span>
                        </button>
                    </div>
                    {/* Toggles Row 2 */}
                    <div className="flex gap-3">
                         <button 
                            onClick={() => setShowChart(!showChart)}
                            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-slate-400 font-bold text-xs uppercase hover:bg-white/10 transition-colors"
                        >
                            <Layers size={16} className={showChart ? 'text-[#C8B085]' : ''}/>
                            <span>{showChart ? '顯示圖表' : '隱藏圖表'}</span>
                        </button>
                        <button 
                            onClick={() => setShowDD(!showDD)}
                            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-slate-400 font-bold text-xs uppercase hover:bg-white/10 transition-colors"
                        >
                            <Share2 size={16} className={showDD ? 'text-[#D05A5A]' : ''}/>
                            <span>{showDD ? '隱藏回撤' : '顯示回撤'}</span>
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
