
import React, { useState, useMemo } from 'react';
import { X, Loader2, Download, Eye, Layers, Share2, ArrowLeftRight } from 'lucide-react';
import { ComposedChart, Line, Bar, Cell, ResponsiveContainer, YAxis } from 'recharts';
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
    if (!isOpen) return null;

    const [isSharing, setIsSharing] = useState(false);
    const [displayMode, setDisplayMode] = useState<DisplayMode>('amount');
    const [showChart, setShowChart] = useState(true);
    const [showDD, setShowDD] = useState(false);

    const t = I18N[lang] || I18N['zh'];
    const isProfit = metrics.netProfit >= 0;
    
    // Smart R:R Display
    const rrDisplay = useMemo(() => {
        if (metrics.avgLoss === 0) return { val: 'WIN', sub: 'ONLY' };
        if (metrics.riskReward > 100) return { val: '??, sub: 'R:R' };
        return { val: formatDecimal(metrics.riskReward), sub: '' };
    }, [metrics.riskReward, metrics.avgLoss]);

    // Background Gradient based on performance
    const bgGradient = isProfit 
        ? 'radial-gradient(circle at 50% 0%, rgba(208, 90, 90, 0.25), transparent 70%)'
        : 'radial-gradient(circle at 50% 0%, rgba(91, 154, 139, 0.25), transparent 70%)';

    // Date Range Logic - Intelligence to skip "Start" point
    const curve = metrics.curve;
    const firstDatePoint = curve.length > 0 ? (curve[0].fullDate === 'Start' || curve[0].fullDate === 'Initial' ? (curve[1] ? curve[1].fullDate : curve[0].fullDate) : curve[0].fullDate) : '';
    const lastDatePoint = curve.length > 0 ? curve[curve.length - 1].fullDate : '';
    
    const formatDatePretty = (dateStr: string) => {
        if (!dateStr || dateStr === 'Start' || dateStr === 'Initial') return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}.${mm}.${dd}`;
        } catch { return ''; }
    };

    const dateRangeStr = firstDatePoint && lastDatePoint 
        ? `${formatDatePretty(firstDatePoint)} - ${formatDatePretty(lastDatePoint)}`
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
            await new Promise(resolve => setTimeout(resolve, 200)); // Slight Render wait
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
        if (displayMode === 'amount') return 'È°ØÁ§∫: ?ëÈ?';
        if (displayMode === 'percent') return 'È°ØÁ§∫: %';
        return 'È°ØÁ§∫: ?±Ë?';
    };

    const mainNumberGradient = isProfit 
        ? 'linear-gradient(180deg, #FFD1D1 0%, #D05A5A 60%, #A33A3A 100%)' // Richer Red
        : 'linear-gradient(180deg, #ABEFDC 0%, #5B9A8B 60%, #2C5F54 100%)'; // Richer Green
        : 'linear-gradient(135deg, #7FFFD4 0%, #5B9A8B 50%, #2C5F54 100%)'; // Richer Green

    // Calculate Period Return % (based on start equity of the period)
    const startEquity = metrics.currentEq - metrics.netProfit;
    const periodReturnPct = startEquity !== 0 ? (metrics.netProfit / startEquity) * 100 : 0;

    return (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-sm flex flex-col animate-in fade-in duration-300">
            {/* Main Preview Area */}
            <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: bgGradient, opacity: 0.3 }}></div>

                {/* THE CARD TO CAPTURE */}
                <div 
                    id="share-card-capture" 
                    className="w-full max-w-[340px] aspect-[4/5] bg-[#09090b] rounded-[32px] border border-white/10 relative overflow-hidden flex flex-col shadow-2xl"
                    style={{
                        boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 20px 60px -15px ${isProfit ? 'rgba(208, 90, 90, 0.25)' : 'rgba(91, 154, 139, 0.25)'}`
                    style={{
                        boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 20px 50px -10px ${isProfit ? 'rgba(208, 90, 90, 0.3)' : 'rgba(91, 154, 139, 0.3)'}`
                    }}
                >
                    {/* Noise Texture */}
                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none z-0 mix-blend-overlay" 
                         style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
                    </div>

                    {/* Header */}
                    <div className="p-7 pb-4 flex justify-between items-start z-10">
                        <div>
                            <h3 className="text-white/90 font-bold text-sm tracking-[0.2em] uppercase">‰∫§Ê??çÁ?</h3>
                            <p className="text-white/40 font-mono text-[11px] mt-2 tracking-wider font-medium uppercase min-h-[1em]">
                                {dateRangeStr}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-90">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#C8B085] shadow-[0_0_8px_#C8B085]"></div>
                            <span className="text-[#C8B085] font-black text-[10px] tracking-[0.25em] uppercase">TradeTrack</span>
                        <div>
                            <h3 className="text-white/80 font-bold text-sm tracking-widest uppercase">Â∏≥Êà∂?≤Âà©</h3>
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
                    <div className="w-full px-7 z-10 relative flex flex-col items-start min-h-[100px] justify-center mt-1">
                        {(displayMode === 'amount' || displayMode === 'hidden') && (
                            <div className="flex items-baseline gap-4">
                                {(() => {
                                    const abs = Math.abs(metrics.netProfit);
                                    const isNegative = metrics.netProfit < 0;
                                    
                                    let val = '';
                                    let unit = '';

                                    if (abs < 10000) {
                                        val = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(abs);
                                    } else if (abs < 100000000) {
                                        val = parseFloat((abs / 10000).toFixed(2)).toString();
                                        unit = '??;
                                    } else {
                                        val = parseFloat((abs / 100000000).toFixed(2)).toString();
                                        unit = '??;
                                    }

                                    const displayVal = (isNegative ? '-' : '') + val;

                                    return (
                                        <div className={`flex items-baseline ${displayMode === 'hidden' ? 'blur-md opacity-50 select-none' : ''}`}>
                                            <span 
                                                className="text-[40px] font-black font-barlow-numeric tracking-tighter leading-none drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] bg-clip-text text-transparent"
                                                style={{ 
                                                    backgroundImage: mainNumberGradient,
                                                    filter: `drop-shadow(0 0 30px ${isProfit ? 'rgba(208, 90, 90, 0.15)' : 'rgba(91, 154, 139, 0.15)'})`
                                                }}
                                            >
                                                {displayVal}
                                            </span>
                                            {unit && (
                                                <span 
                                                    className="text-2xl ml-1.5 font-bold font-sans bg-clip-text text-transparent -translate-y-1"
                                                    style={{ 
                                                        backgroundImage: mainNumberGradient,
                                                        filter: `drop-shadow(0 0 30px ${isProfit ? 'rgba(208, 90, 90, 0.15)' : 'rgba(91, 154, 139, 0.15)'})`
                                                    }}
                                                >
                                                    {unit}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })()}
                                {showDD && (
                                    <div className="flex flex-col items-start gap-0.5 self-end pb-1">
                                        <span className="text-white/30 text-[8px] font-bold uppercase tracking-wider">{t.maxDD}</span>
                                        <span className="text-[#5B9A8B] font-black font-barlow-numeric text-lg tracking-tight">
                                            {formatDecimal(metrics.maxDD)}<span className="text-xs ml-0.5 opacity-60">%</span>
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                        {displayMode === 'percent' && (
                            <span 
                                className="text-[40px] font-black font-barlow-numeric tracking-tighter leading-none drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] bg-clip-text text-transparent"
                                style={{ 
                                    backgroundImage: mainNumberGradient,
                                    filter: `drop-shadow(0 0 30px ${isProfit ? 'rgba(208, 90, 90, 0.15)' : 'rgba(91, 154, 139, 0.15)'})`
                                }}
                            >
                                {formatDecimal(periodReturnPct)}%
                            </span>
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
                        <div className="absolute inset-x-0 bottom-[28%] top-[40%] opacity-100 pointer-events-none z-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <defs>
                                        <filter id="glow-line-share" height="200%">
                                            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                                            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0" result="coloredBlur" />
                                            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                        </filter>
                                        <linearGradient id="equityLineGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#fff" stopOpacity={0.2}/>
                                            <stop offset="50%" stopColor="#fff" stopOpacity={0.8}/>
                                            <stop offset="100%" stopColor="#fff" stopOpacity={0.2}/>
                                        </linearGradient>
                                    </defs>
                                    
                                    <Bar dataKey="pnl" yAxisId="pnl" radius={[2, 2, 0, 0]} barSize={6}>
                                        {chartData.map((entry, index) => {
                                            const opacity = Math.max(0.15, Math.min(0.6, Math.abs(entry.pnl) / (Math.max(1, Math.abs(metrics.avgWin)) * 2)));
                                            return (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    fill={entry.pnl >= 0 ? '#D05A5A' : '#5B9A8B'} 
                                                    fillOpacity={opacity} 
                                                    strokeWidth={0}
                                                />
                                            );
                                        })}
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
                                            if (payload.isNewPeak) return (
                                                <g>
                                                    <circle cx={cx} cy={cy} r={6} fill="#C8B085" fillOpacity={0.2} />
                                                    <circle cx={cx} cy={cy} r={3} fill="#C8B085" stroke="rgba(0,0,0,0.8)" strokeWidth={1} />
                                                </g>
                                            );
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
                    <div className={`mt-auto border-t border-white/5 bg-white/[0.02] backdrop-blur-md z-10 grid ${showDD ? 'grid-cols-4' : 'grid-cols-3'} divide-x divide-white/5`}>
                        <div className="py-7 flex flex-col items-center justify-center gap-1.5">
                             <span className="text-white/30 text-[9px] font-bold uppercase tracking-[0.2em]">{t.winRate}</span>
                             <span className="text-white/90 font-black font-barlow-numeric text-xl tracking-tight">
                                 {formatDecimal(metrics.winRate)}<span className="text-sm ml-0.5 text-white/40">%</span>
                             </span>
                        </div>
                        <div className="py-7 flex flex-col items-center justify-center gap-1.5">
                             <span className="text-white/30 text-[9px] font-bold uppercase tracking-[0.2em]">‰∫§Ê?Á≠ÜÊï∏</span>
                             <span className="text-white/90 font-black font-barlow-numeric text-xl tracking-tight">
                        <div className="py-6 flex flex-col items-center justify-center gap-1">
                             <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{t.winRate}</span>
                             <span className="text-white font-black font-barlow-numeric text-xl tracking-tight">
                                 {formatDecimal(metrics.winRate)}%
                             </span>
                        </div>
                        <div className="py-6 flex flex-col items-center justify-center gap-1">
                             <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">‰∫§Ê?Á≠ÜÊï∏</span>
                             <span className="text-white font-black font-barlow-numeric text-xl tracking-tight">
                                 {metrics.totalTrades}
                             </span>
                        </div>
                        {showDD && (
                            <div className="py-7 flex flex-col items-center justify-center gap-1.5">
                                <span className="text-white/30 text-[9px] font-bold uppercase tracking-[0.2em]">{t.maxDD}</span>
                                <span className="text-[#5B9A8B] font-black font-barlow-numeric text-xl tracking-tight">
                                    {formatDecimal(metrics.maxDD)}<span className="text-sm ml-0.5 opacity-60">%</span>
                                </span>
                            </div>
                        )}
                        <div className="py-7 flex flex-col items-center justify-center gap-1.5">
                             <span className="text-white/30 text-[9px] font-bold uppercase tracking-[0.2em]">{t.riskReward}</span>
                             <div className="flex items-baseline">
                                 <span className="text-white/90 font-black font-barlow-numeric text-xl tracking-tight">
                                     {rrDisplay.val}
                                 </span>
                                 {rrDisplay.sub && <span className="text-[9px] ml-1 text-white/40 font-bold uppercase">{rrDisplay.sub}</span>}
                             </div>
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
                            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-slate-400 font-bold text-xs uppercase hover:bg-white/10 transition-colors active:scale-95"
                        >
                            {displayMode === 'hidden' ? <Eye size={16}/> : <ArrowLeftRight size={16}/>}
                            <span>{getDisplayModeLabel()}</span>
                        </button>
                    </div>
                    {/* Toggles Row 2 */}
                    <div className="flex gap-3">
                         <button 
                            onClick={() => setShowChart(!showChart)}
                            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-slate-400 font-bold text-xs uppercase hover:bg-white/10 transition-colors active:scale-95"
                        >
                            <Layers size={16} className={showChart ? 'text-[#C8B085]' : ''}/>
                            <span>{showChart ? 'È°ØÁ§∫?ñË°®' : '?±Ë??ñË°®'}</span>
                        </button>
                        <button 
                            onClick={() => setShowDD(!showDD)}
                            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-slate-400 font-bold text-xs uppercase hover:bg-white/10 transition-colors active:scale-95"
                        >
                            <Share2 size={16} className={showDD ? 'text-[#D05A5A]' : ''}/>
                            <span>{showDD ? '?±Ë??ûÊí§' : 'È°ØÁ§∫?ûÊí§'}</span>
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button 
                            onClick={onClose}
                            className="w-14 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 active:scale-95"
                        >
                            <X size={20} />
                        </button>
                        <button 
                            onClick={handleSaveImage}
                            disabled={isSharing}
                            className="flex-1 py-4 rounded-xl bg-[#C8B085] text-black font-bold text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(200,176,133,0.3)] hover:bg-[#D9C298] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {isSharing ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                            ?≤Â??ñÁ?
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
