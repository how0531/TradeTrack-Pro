
// [Manage] Last Updated: 2024-05-22
import React, { useState, useRef } from 'react';
import { X, Share2, Loader2, Eye, EyeOff, Layers, Download, ArrowLeftRight } from 'lucide-react';
import { ComposedChart, Line, Bar, Cell, ResponsiveContainer, YAxis } from 'recharts';
import { TradeModalProps, Trade } from '../../types';
import { I18N, THEME } from '../../constants';
import { StrategyChipsInput, EmotionChipsInput, PortfolioChipsInput } from '../../components/form/ChipInputs';
import html2canvas from 'html2canvas';
import { formatCompactNumber, formatDecimal } from '../../utils/format';

type DisplayMode = 'amount' | 'percent' | 'hidden';

export const TradeModal = ({ isOpen, onClose, form, setForm, onSubmit, isEditing, strategies, emotions, portfolios, lang, metrics }: TradeModalProps) => {
    if (!isOpen) return null;
    const t = I18N[lang] || I18N['zh'];
    
    // Share State
    const [showSharePreview, setShowSharePreview] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    
    // Share Customization
    const [shareDisplayMode, setShareDisplayMode] = useState<DisplayMode>('amount');
    const [shareShowChart, setShareShowChart] = useState(true);

    const updateForm = (key: keyof Trade, value: any) => setForm({ ...form, [key]: value });
    
    // Default to first portfolio if not set
    if (!form.portfolioId && portfolios.length > 0) {
        updateForm('portfolioId', portfolios[0].id);
    }

    // --- SHARE CARD LOGIC ---
    const handleSaveImage = async () => {
        const element = document.getElementById('share-card-capture');
        if (!element || isSharing) return;

        setIsSharing(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // Render wait
            const canvas = await html2canvas(element, {
                backgroundColor: null, // Set to null for transparency
                scale: 3, // High Res
                useCORS: true,
                logging: false,
            });

            const link = document.createElement('a');
            link.download = `tradetrack_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            // Optional: Close after save
            // setShowSharePreview(false);
        } catch (error) {
            console.error('Share failed', error);
            alert('Failed to generate image');
        } finally {
            setIsSharing(false);
        }
    };

    // Calculate PnL for the card
    const currentPnl = form.type === 'profit' 
        ? Math.abs(parseFloat(form.amount || '0')) 
        : -Math.abs(parseFloat(form.amount || '0'));
    
    // Determine Color Theme based on PnL
    const isProfit = currentPnl >= 0;
    const themeColor = isProfit ? '#D05A5A' : '#5B9A8B'; // Red/Green
    const bgGradient = isProfit 
        ? 'radial-gradient(circle at 50% 0%, rgba(208, 90, 90, 0.15), transparent 70%)'
        : 'radial-gradient(circle at 50% 0%, rgba(91, 154, 139, 0.15), transparent 70%)';

    // Chart Data (Mocking current trade impact or using general curve)
    // If metrics exist, use the last 30 points for a nice curve
    const chartData = metrics?.curve ? metrics.curve.slice(-30) : [];
    
    const toggleDisplayMode = () => {
        if (shareDisplayMode === 'amount') setShareDisplayMode('percent');
        else if (shareDisplayMode === 'percent') setShareDisplayMode('hidden');
        else setShareDisplayMode('amount');
    };

    const getDisplayModeLabel = () => {
        if (shareDisplayMode === 'amount') return '顯示: 金額';
        if (shareDisplayMode === 'percent') return '顯示: %';
        return '顯示: 隱藏';
    };

    const SharePreview = () => (
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
                            <p className="text-[#333] font-mono text-[10px] mt-1 tracking-wide">
                                {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} - {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#C8B085]"></div>
                            <span className="text-[#C8B085] font-bold text-xs tracking-wide">TradeTrack</span>
                        </div>
                    </div>

                    {/* Main Stats (Top Aligned) */}
                    <div className="w-full px-6 z-10 relative flex flex-col items-start min-h-[60px]">
                        {shareDisplayMode !== 'hidden' && (
                            <div 
                                className="text-5xl font-bold font-barlow-numeric tracking-tighter leading-none drop-shadow-2xl mt-1"
                                style={{ color: themeColor }}
                            >
                                {shareDisplayMode === 'amount' 
                                    ? formatCompactNumber(currentPnl, false).replace('+', '')
                                    : (metrics ? `${formatDecimal(metrics.eqChangePct)}%` : '0.00%')
                                }
                            </div>
                        )}
                    </div>

                    {/* Background Chart - EXACT REPLICA OF MAIN APP STYLE */}
                    {shareShowChart && chartData.length > 0 && (
                        <div className="absolute inset-x-0 bottom-[20%] top-[30%] opacity-100 pointer-events-none">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <defs>
                                        <filter id="glow-line-share-trade" height="200%">
                                            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                                            {/* Blue Glow Matrix */}
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

                                    {/* Equity Line (Foreground) */}
                                    <Line 
                                        yAxisId="equity"
                                        type="monotone" 
                                        dataKey="equity" 
                                        stroke="#526D82" 
                                        strokeWidth={2} 
                                        dot={({cx, cy, payload}) => {
                                            if (payload.isNewPeak) return <circle cx={cx} cy={cy} r={3} fill="#C8B085" stroke="none" />;
                                            return <></>;
                                        }}
                                        isAnimationActive={false}
                                        filter="url(#glow-line-share-trade)"
                                    />

                                    {/* Dual Axis Hidden */}
                                    <YAxis yAxisId="pnl" hide domain={['auto', 'auto']} />
                                    <YAxis yAxisId="equity" orientation="right" hide domain={['auto', 'auto']} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Footer Grid Stats */}
                    <div className="mt-auto border-t border-white/10 bg-white/[0.02] backdrop-blur-sm z-10 grid grid-cols-3 divide-x divide-white/10">
                        <div className="py-5 flex flex-col items-center justify-center">
                             <span className="text-[#555] text-[9px] font-bold uppercase tracking-widest mb-1">勝率</span>
                             <span className="text-white font-bold font-barlow-numeric text-lg">
                                 {metrics ? formatDecimal(metrics.winRate) : '0.00'}%
                             </span>
                        </div>
                        <div className="py-5 flex flex-col items-center justify-center">
                             <span className="text-[#555] text-[9px] font-bold uppercase tracking-widest mb-1">交易筆數</span>
                             <span className="text-white font-bold font-barlow-numeric text-lg">
                                 {metrics ? metrics.totalTrades : '0'}
                             </span>
                        </div>
                        <div className="py-5 flex flex-col items-center justify-center">
                             <span className="text-[#555] text-[9px] font-bold uppercase tracking-widest mb-1">賺賠比</span>
                             <span className="text-white font-bold font-barlow-numeric text-lg">
                                 {metrics ? formatDecimal(metrics.riskReward) : '0.00'}
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
                            {shareDisplayMode === 'hidden' ? <Eye size={16}/> : <ArrowLeftRight size={16}/>}
                            <span>{getDisplayModeLabel()}</span>
                        </button>
                        <button 
                            onClick={() => setShareShowChart(!shareShowChart)}
                            className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-slate-400 font-bold text-xs uppercase hover:bg-white/10 transition-colors"
                        >
                            <Layers size={16} className={shareShowChart ? 'text-[#C8B085]' : ''}/>
                            <span>{shareShowChart ? '顯示圖表' : '隱藏圖表'}</span>
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowSharePreview(false)}
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

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in duration-200 backdrop-blur-sm">
                <div 
                    id="trade-modal-content"
                    className="w-full sm:max-w-sm bg-black/60 backdrop-blur-xl rounded-t-2xl sm:rounded-2xl border-t sm:border border-white/10 shadow-2xl shadow-black/50 overflow-hidden flex flex-col max-h-[95vh]"
                >
                    <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-white/5">
                        <h2 className="font-bold text-sm text-white">{isEditing ? t.editTrade : t.addTrade}</h2>
                        
                        <div id="modal-header-controls" className="flex items-center gap-2">
                            <button 
                                onClick={() => setShowSharePreview(true)} 
                                className="text-slate-500 hover:text-[#C8B085] transition-colors p-1"
                            >
                                <Share2 size={20}/>
                            </button>
                            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
                                <X size={20}/>
                            </button>
                        </div>
                    </div>
                    <form onSubmit={onSubmit} className="p-4 space-y-4 overflow-y-auto flex-1 no-scrollbar pb-8">
                        
                        {/* GLASS CHIPS: PORTFOLIO SELECTOR */}
                        <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500 mb-1.5 ml-1 block">{t.portfolio}</label>
                            <PortfolioChipsInput portfolios={portfolios} value={form.portfolioId || (portfolios[0]?.id || '')} onChange={(val) => updateForm('portfolioId', val)} />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 ml-1 block">Date</label>
                            <input 
                                type="date" 
                                required 
                                value={form.date} 
                                onChange={e => updateForm('date', e.target.value)} 
                                className="w-full h-[40px] px-3 rounded-lg bg-white/5 border border-white/10 text-base text-white font-barlow-numeric outline-none focus:border-white/20 focus:bg-white/10 transition-colors backdrop-blur-sm text-center appearance-none"
                                style={{ WebkitAppearance: 'none' }} // Fix for iOS Safari appearance
                            />
                        </div>

                        <div className="flex gap-2 items-center bg-white/5 p-1 rounded-xl border border-white/5">
                            <div className="flex bg-black/20 p-0.5 rounded-lg h-[40px] flex-shrink-0">
                                {/* GLASS BUTTONS: PROFIT / LOSS */}
                                <button type="button" onClick={() => updateForm('type', 'profit')} className={`px-4 rounded-md text-[10px] font-bold uppercase transition-all ${form.type === 'profit' ? 'bg-[#D05A5A]/20 text-[#D05A5A] shadow-[0_0_10px_rgba(208,90,90,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}>{t.profit}</button>
                                <button type="button" onClick={() => updateForm('type', 'loss')} className={`px-4 rounded-md text-[10px] font-bold uppercase transition-all ${form.type === 'loss' ? 'bg-[#5B9A8B]/20 text-[#5B9A8B] shadow-[0_0_10px_rgba(91,154,139,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}>{t.loss}</button>
                            </div>
                            <input type="number" step="0.1" inputMode="decimal" required value={form.amount} onChange={e => updateForm('amount', e.target.value)} className="w-full h-[40px] px-2 text-2xl font-barlow-numeric font-bold bg-transparent border-none text-white placeholder-slate-600 outline-none text-right" placeholder="0.0" autoFocus />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">{t.strategyList}</label>
                            <StrategyChipsInput strategies={strategies} value={form.strategy || ''} onChange={(val) => updateForm('strategy', val)} lang={lang} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">{t.mindsetList}</label>
                            <EmotionChipsInput emotions={emotions} value={form.emotion || ''} onChange={(val) => updateForm('emotion', val)} lang={lang} />
                        </div>
                        <textarea 
                            rows={3} 
                            value={form.note || ''} 
                            onChange={e => updateForm('note', e.target.value)} 
                            className="w-full p-3 rounded-xl text-xs bg-white/5 border border-white/10 text-slate-300 placeholder-slate-600 outline-none focus:border-white/20 focus:bg-white/10 resize-y min-h-[60px] leading-relaxed backdrop-blur-sm" 
                            placeholder={t.notePlaceholder} 
                        />
                        
                        {/* GLASS BUTTON: SUBMIT */}
                        <button type="submit" className={`w-full py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg transition-all active:scale-[0.98] backdrop-blur-md border ${form.type === 'profit' ? 'bg-[#D05A5A]/20 text-[#D05A5A] border-[#D05A5A]/50 shadow-[0_0_20px_rgba(208,90,90,0.15)] hover:bg-[#D05A5A]/30' : 'bg-[#5B9A8B]/20 text-[#5B9A8B] border-[#5B9A8B]/50 shadow-[0_0_20px_rgba(91,154,139,0.15)] hover:bg-[#5B9A8B]/30'}`}>
                            {isEditing ? t.update : t.save}
                        </button>
                    </form>
                </div>
            </div>
            
            {/* SHARE PREVIEW OVERLAY */}
            {showSharePreview && <SharePreview />}
        </>
    );
};
