
import React, { useState, useRef } from 'react';
import { X, Download, Eye, EyeOff, Layers, Share2 } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import html2canvas from 'html2canvas';
import { Trade, Metrics, Lang } from '../../types';
import { I18N, THEME } from '../../constants';
import { formatCurrency, formatDecimal, formatDate } from '../../utils/format';

interface ShareCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: { type: 'TRADE' | 'STATS'; trade?: Trade; metrics?: Metrics };
    lang: Lang;
}

export const ShareCardModal = ({ isOpen, onClose, data, lang }: ShareCardModalProps) => {
    if (!isOpen) return null;
    
    const [hideAmounts, setHideAmounts] = useState(true);
    const [showChart, setShowChart] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const t = I18N[lang] || I18N['zh'];

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsGenerating(true);
        try {
            // Wait a bit for chart to render fully if needed
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const canvas = await html2canvas(cardRef.current, {
                useCORS: true,
                scale: 2, // Retina quality
                backgroundColor: '#000000',
            });
            
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            link.download = `tradetrack_share_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Image generation failed", err);
            alert("Failed to generate image.");
        } finally {
            setIsGenerating(false);
        }
    };

    // --- RENDER LOGIC ---
    const isTrade = data.type === 'TRADE';
    const trade = data.trade;
    const metrics = data.metrics;

    // Determine Colors & Values
    const pnl = isTrade ? (trade?.pnl || 0) : (metrics?.eqChange || 0);
    const isWin = pnl >= 0;
    const color = isWin ? THEME.RED : THEME.GREEN;
    const bgGradient = isWin 
        ? 'radial-gradient(circle at 50% 0%, rgba(208, 90, 90, 0.15), transparent 70%)' 
        : 'radial-gradient(circle at 50% 0%, rgba(91, 154, 139, 0.15), transparent 70%)';

    const mainValue = hideAmounts ? (isWin ? '+****' : '-****') : formatCurrency(pnl);
    
    // For Stats: Calculate percentage change
    const pctChange = !isTrade && metrics ? metrics.eqChangePct : 0;
    
    // Chart Data Construction
    const chartData = !isTrade && metrics ? metrics.curve : [];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm flex flex-col gap-4">
                
                {/* 1. PREVIEW CONTAINER (THE CARD) */}
                <div className="relative w-full aspect-square rounded-[32px] overflow-hidden border border-white/10 shadow-2xl bg-[#050505] flex flex-col items-center justify-between p-8 select-none" ref={cardRef}>
                    
                    {/* Background Effects */}
                    <div className="absolute inset-0 pointer-events-none" style={{ background: bgGradient }}></div>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none mix-blend-overlay"></div>
                    
                    {/* Header */}
                    <div className="relative z-10 w-full flex justify-between items-start">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{isTrade ? 'TRADE RESULT' : 'PERFORMANCE'}</span>
                            <span className="text-[9px] text-slate-600 font-mono mt-0.5">
                                {isTrade && trade ? formatDate(trade.date, lang) : formatDate(new Date().toISOString(), lang)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-80">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#C8B085]"></div>
                            <span className="text-[10px] font-bold text-[#C8B085] tracking-wider">TradeTrack</span>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="relative z-10 flex flex-col items-center justify-center w-full flex-1">
                        
                        {/* CHART (If enabled & Stats mode) */}
                        {!isTrade && showChart && chartData.length > 0 && (
                            <div className="absolute inset-0 top-10 bottom-16 opacity-30 pointer-events-none">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="shareGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={color} stopOpacity={0.4}/>
                                                <stop offset="100%" stopColor={color} stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <Area 
                                            type="monotone" 
                                            dataKey="cumulativePnl" 
                                            stroke={color} 
                                            strokeWidth={3} 
                                            fill="url(#shareGrad)" 
                                            isAnimationActive={false} 
                                        />
                                        <YAxis domain={['dataMin', 'dataMax']} hide />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        <div className="flex flex-col items-center gap-2 drop-shadow-2xl">
                             <h1 className="text-6xl font-black font-barlow-numeric tracking-tighter" style={{ color: color }}>
                                {mainValue}
                             </h1>
                             
                             {/* Sub-label */}
                             {isTrade ? (
                                <div className="flex gap-2">
                                    {trade?.strategy && <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300 uppercase">{trade.strategy}</span>}
                                    {trade?.emotion && <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300 uppercase">#{trade.emotion}</span>}
                                </div>
                             ) : (
                                <div className={`text-2xl font-bold font-barlow-numeric ${isWin ? 'text-white' : 'text-slate-400'}`}>
                                    {pctChange > 0 ? '+' : ''}{formatDecimal(pctChange)}%
                                </div>
                             )}
                        </div>
                    </div>

                    {/* Footer Stats Grid */}
                    <div className="relative z-10 w-full grid grid-cols-3 gap-2 pt-4 border-t border-white/5">
                        {!isTrade && metrics ? (
                            <>
                                <div className="flex flex-col items-center">
                                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">WIN RATE</span>
                                    <span className="text-sm font-bold text-white font-barlow-numeric">{formatDecimal(metrics.winRate)}%</span>
                                </div>
                                <div className="flex flex-col items-center border-l border-white/5">
                                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">TRADES</span>
                                    <span className="text-sm font-bold text-white font-barlow-numeric">{metrics.totalTrades}</span>
                                </div>
                                <div className="flex flex-col items-center border-l border-white/5">
                                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">PROFIT FACTOR</span>
                                    <span className="text-sm font-bold text-white font-barlow-numeric">{formatDecimal(metrics.pf)}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-col items-center col-span-3">
                                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">RESULT</span>
                                    <span className={`text-lg font-bold font-barlow-numeric ${isWin ? 'text-[#D05A5A]' : 'text-[#5B9A8B]'}`}>
                                        {isWin ? 'WIN' : 'LOSS'}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* 2. CONTROLS */}
                <div className="bg-[#141619] rounded-2xl border border-white/10 p-4 flex flex-col gap-4">
                    {/* Toggles */}
                    <div className="flex justify-center gap-4">
                        <button 
                            onClick={() => setHideAmounts(!hideAmounts)} 
                            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-all border ${hideAmounts ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-slate-500 border-white/5 hover:bg-white/5'}`}
                        >
                            {hideAmounts ? <EyeOff size={14} /> : <Eye size={14} />}
                            {hideAmounts ? 'Amounts Hidden' : 'Amounts Visible'}
                        </button>
                        
                        {!isTrade && (
                             <button 
                                onClick={() => setShowChart(!showChart)} 
                                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-all border ${showChart ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-slate-500 border-white/5 hover:bg-white/5'}`}
                            >
                                <Layers size={14} />
                                {showChart ? 'Chart On' : 'Chart Off'}
                            </button>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button onClick={onClose} className="p-3 rounded-xl bg-[#25282C] text-slate-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                        <button 
                            onClick={handleDownload}
                            disabled={isGenerating}
                            className="flex-1 py-3 rounded-xl bg-[#C8B085] text-black font-bold text-xs uppercase hover:bg-[#D9C298] hover:shadow-[0_0_20px_rgba(200,176,133,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isGenerating ? 'Generating...' : (
                                <>
                                    <Download size={16} /> Save Image
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
