// [Manage] Last Updated: 2024-05-22
import React, { useState, useMemo, useEffect } from 'react';
import { Scroll, Trash2, Edit2, Calendar, ArrowUpDown, StickyNote } from 'lucide-react';
import { Trade, LogsViewProps, Lang } from '../../types';
import { I18N } from '../../constants';
import { formatCompactNumber, formatDate, formatPointsDisplay } from '../../utils/format';
import { safeDateParse } from '../../utils/calculations';
import { formatSymbolCode } from '../../utils/symbolNames';
import { vibrate } from '../../utils/haptics';

type SortType = 'date' | 'pnl_high' | 'pnl_low';

const SpineCard = React.memo(({ trade, onEdit, onDelete, hideAmounts }: { trade: Trade, onEdit: (t: Trade) => void, onDelete: (id: string) => void, hideAmounts: boolean }) => {
    const [deleteStatus, setDeleteStatus] = useState<'idle' | 'confirm'>('idle');
    const [isNoteExpanded, setIsNoteExpanded] = useState(false);
    
    const isProfit = trade.pnl >= 0;
    const rawStrat = trade.strategy ? trade.strategy.split('_')[0] : '';
    const stratName = (rawStrat === 'Uncategorized' || !rawStrat) ? '' : rawStrat;

    useEffect(() => {
        if (deleteStatus === 'confirm') {
            const timer = setTimeout(() => setDeleteStatus('idle'), 3000);
            return () => clearTimeout(timer);
        }
    }, [deleteStatus]);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (deleteStatus === 'idle') { setDeleteStatus('confirm'); vibrate('warning'); }
        else { onDelete(trade.id); vibrate('impactHeavy'); }
    };

    const theme = isProfit ? {
        capsuleBorder: 'border-[#500707]/60', capsuleText: 'text-[#e89595]', capsuleBg: 'bg-[#1a0505]/80',
        textName: 'text-[#e89595]', textTag: 'text-[#7f1d1d]', dotColor: 'bg-[#b91c1c]', glow: 'shadow-[0_0_10px_rgba(185,28,28,0.1)]',
        noteBg: 'bg-[#500707]/5', noteBorder: 'border-[#500707]/20', noteLabel: 'text-[#e89595]', noteHover: 'hover:bg-[#500707]/10'
    } : {
        capsuleBorder: 'border-[#1D332E]/80', capsuleText: 'text-[#5B9A8B]', capsuleBg: 'bg-[#0B1210]/90',
        textName: 'text-[#5B9A8B]', textTag: 'text-[#2C5F54]', dotColor: 'bg-[#5B9A8B]', glow: 'shadow-[0_0_10px_rgba(91,154,139,0.1)]',
        noteBg: 'bg-[#1D332E]/5', noteBorder: 'border-[#1D332E]/20', noteLabel: 'text-[#5B9A8B]', noteHover: 'hover:bg-[#1D332E]/10'
    };

    const priceDisplay = useMemo(() => {
        // 膠囊統一顯示 NTD 金額
        return Math.abs(trade.pnl).toLocaleString('en-US');
    }, [trade]);

    const { infoLine, displayNote } = useMemo(() => {
        // 1. Priority: Construct Info from Independent Fields (New Data Structure)
        // Relaxed check: Show if ANY of the structural fields exist
        if (trade.code || trade.points || (trade.quantity && trade.quantity > 0)) {
            const category = trade.category || '';
            const code = trade.code || '';
            const isFuture = (
                category === 'Futures' || category === 'Option' || category === '期貨' ||
                category.includes('Futures') || category.includes('台指') ||
                code.includes('期') || code.includes('選') ||
                code.includes('TX') || code.includes('MTX') || code.includes('TF')
            );
            const unit = isFuture ? '口' : '張';
            
            // Extract Name
            let displayName = '';
            const codeStr = String(trade.code || '');
            if (codeStr) {
                displayName = formatSymbolCode(codeStr);
            }
            
            const qtyDisplay = trade.quantity ? `${Math.abs(trade.quantity)}${unit}` : '';
            
            // 期貨/選擇權: 計算點數並顯示在 infoLine
            let ptsDisplay = '';
            if (isFuture) {
                const hasPrices = trade.entryPrice != null && trade.exitPrice != null && trade.entryPrice > 0 && trade.exitPrice > 0;
                if (hasPrices) {
                    const points = Number(Math.abs(trade.exitPrice! - trade.entryPrice!).toFixed(2));
                    const formatted = points.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                    ptsDisplay = `${formatted} pts`;
                } else if (trade.pnl !== 0) {
                    // Fallback: 從 NTD 反推點數
                    let multiplier = 200;
                    if (code.includes('MTX') || code.includes('小台')) multiplier = 50;
                    else if (code.includes('TE') || code.includes('電子')) multiplier = 4000;
                    else if (code.includes('TF') || code.includes('金融')) multiplier = 1000;
                    else if (code.includes('TXO') || code.includes('選')) multiplier = 50;
                    const guessedPts = Number((Math.abs(trade.pnl) / multiplier / Math.abs(trade.quantity || 1)).toFixed(2));
                    if (guessedPts > 0) {
                        ptsDisplay = `${guessedPts.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} pts`;
                    }
                }
            } else {
                // 台股: 顯示報酬率 (yield) 或原本的 points 欄位
                if (trade.yield !== undefined && trade.yield !== null) {
                    const prefix = trade.yield > 0 ? '+' : '';
                    ptsDisplay = `${prefix}${trade.yield}%`;
                } else if (trade.points) {
                    ptsDisplay = formatPointsDisplay(trade.points);
                }
            }
            
            // Filter out empty parts and join with pipe
            const info = [displayName, qtyDisplay, ptsDisplay].filter(Boolean).join(' | ');

            // Deduplication Logic:
            // If trade.note contains the legacy "Code | Pts | Qty" string, allow TradeModal to clean it permanently,
            // BUT for display, we dynamically strip it here to avoid showing it twice (InfoLine + NoteBox).
            let finalNote = trade.note;
            if (finalNote) {
                const parts = String(finalNote).split('|');
                if (parts.length >= 3) {
                    const legacyCode = parts[0].trim();
                    const legacyPts = parts[1].trim();
                    const legacyQty = parts[2].trim();
                    // Simple heuristic: if it looks like the legacy format, strip it
                    const isLegacyFormat = legacyCode.length < 20 && legacyPts.length < 15 && legacyQty.length < 10;
                    if (isLegacyFormat) {
                        finalNote = parts.slice(3).join('|').trim();
                    }
                }
            }
            
            return { 
                infoLine: info, 
                displayNote: finalNote && finalNote.length > 0 ? finalNote : null
            };
        }

        // 2. Legacy Fallback: Parse Note (for old trades without trade.code)
        if (!trade.note) return { infoLine: null, displayNote: null };
        
        const noteStr = String(trade.note);
        
        // CASE A: Pipe Separated Legacy "Code Name | Pts | Qty"
        const parts = noteStr.split('|');
        if (parts.length >= 3) {
            const codeRaw = parts[0].trim();
            const pts = parts[1].trim();
            const qty = parts[2].trim(); 
            
            // Check if it fits the structure
            const isAutoFormat = codeRaw.length < 30 && pts.length < 20 && qty.length < 15;
            
            if (isAutoFormat) {
                 // Clean Name using centralized logic
                 const displayName = formatSymbolCode(codeRaw);
                 
                 const info = `${displayName} | ${formatPointsDisplay(pts)} | ${qty}`;
                 const rest = parts.slice(3).join('|').trim();
                 return { infoLine: info, displayNote: rest.length > 0 ? rest : null };
            }
        }

        // CASE B: Bracketed Legacy "【商品】TXFB6 台指期 【損益】+422 pts 【部位】1口"
        // Regex to capture content inside brackets
        const bracketRegex = /【商品】(.*?)【損益】(.*?)【部位】(.*?)(?:$|\s+)/;
        const match = noteStr.match(bracketRegex);
        
        if (match) {
            const codeRaw = match[1].trim(); // "TXFB6 台指期"
            const pts = match[2].trim();     // "+422 pts"
            const qty = match[3].trim();     // "1口"
            
            // Clean Name using centralized logic
            const displayName = formatSymbolCode(codeRaw);
            
            const info = `${displayName} | ${formatPointsDisplay(pts)} | ${qty}`;
            
            // Remove the matched part from the note to get the user note
            const rest = noteStr.replace(match[0], '').trim();
            
            return { infoLine: info, displayNote: rest.length > 0 ? rest : null };
        }
        
        // Strict Mode: Any other note content goes to Note Box
        return { infoLine: null, displayNote: trade.note };
    }, [trade]);

    return (
        <div className="relative w-full mb-5 group animate-in slide-in-from-bottom-2 duration-500">
            {/* Main Row */}
            <div className="flex items-start min-h-[40px] relative z-20">
                <div className="absolute left-1/2 top-[15px] -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                    <div className={`w-2 h-2 rounded-full border border-black/50 shadow-md z-20 transition-all duration-300 group-hover:scale-110 ${theme.dotColor}`}></div>
                    <div className={`absolute w-5 h-[1px] ${isProfit ? 'bg-gradient-to-l' : 'bg-gradient-to-r'} from-transparent to-white/5`}></div>
                </div>

                <div className="flex-1 flex flex-col justify-start items-end pr-5 min-w-0">
                    {isProfit ? (
                        <div className="mt-[5px]">
                            <div className="flex flex-col justify-center py-0.5 items-end text-right">
                                {stratName && <span className={`text-[11px] font-bold tracking-wide leading-none whitespace-nowrap ${theme.textName} opacity-80 mb-1`}>{stratName}</span>}
                                <div className="flex items-center gap-1.5 justify-end">
                                    {trade.emotion && <span className={`text-[10px] font-bold font-sans tracking-wide ${theme.textTag}`}>#{trade.emotion}</span>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-end w-full">
                            <div className={`relative h-[30px] px-3.5 flex items-center justify-center rounded-full border backdrop-blur-md group/capsule overflow-hidden cursor-default transition-transform duration-300 hover:scale-105 min-w-[72px] z-20 ${theme.capsuleBorder} ${theme.capsuleBg} ${theme.capsuleText} ${theme.glow}`}>
                                <span className={`text-[14px] font-bold font-barlow-numeric tracking-tight leading-none drop-shadow-sm mt-[1px] ${hideAmounts ? 'blur-[6px] select-none opacity-60' : ''}`}>{priceDisplay}</span>
                                <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-[#080808]/95 backdrop-blur-md opacity-0 group-hover/capsule:opacity-100 transition-opacity duration-200">
                                    <button onClick={(e) => { e.stopPropagation(); onEdit(trade); }} className="p-1 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"><Edit2 size={10} /></button>
                                    <button onClick={handleDeleteClick} className={`p-1 rounded-full transition-colors ${deleteStatus === 'confirm' ? 'text-red-500 bg-red-500/10' : 'text-zinc-500 hover:text-red-500 hover:bg-red-500/10'}`}><Trash2 size={10} /></button>
                                </div>
                            </div>
                            {/* Info Line (Loss Side) */}
                            {infoLine && (
                                <span className="text-[10px] font-medium tracking-tight text-zinc-500 mt-1.5 opacity-80">{infoLine}</span>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col justify-start items-start pl-5 min-w-0">
                    {isProfit ? (
                         <div className="flex flex-col items-start w-full">
                            <div className={`relative h-[30px] px-3.5 flex items-center justify-center rounded-full border backdrop-blur-md group/capsule overflow-hidden cursor-default transition-transform duration-300 hover:scale-105 min-w-[72px] z-20 ${theme.capsuleBorder} ${theme.capsuleBg} ${theme.capsuleText} ${theme.glow}`}>
                                <span className={`text-[14px] font-bold font-barlow-numeric tracking-tight leading-none drop-shadow-sm mt-[1px] ${hideAmounts ? 'blur-[6px] select-none opacity-60' : ''}`}>{priceDisplay}</span>
                                <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-[#080808]/95 backdrop-blur-md opacity-0 group-hover/capsule:opacity-100 transition-opacity duration-200">
                                    <button onClick={(e) => { e.stopPropagation(); onEdit(trade); }} className="p-1 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"><Edit2 size={10} /></button>
                                    <button onClick={handleDeleteClick} className={`p-1 rounded-full transition-colors ${deleteStatus === 'confirm' ? 'text-red-500 bg-red-500/10' : 'text-zinc-500 hover:text-red-500 hover:bg-red-500/10'}`}><Trash2 size={10} /></button>
                                </div>
                            </div>
                            {/* Info Line (Profit Side) */}
                            {infoLine && (
                                <span className="text-[10px] font-medium tracking-tight text-zinc-500 mt-1.5 opacity-80">{infoLine}</span>
                            )}
                        </div>
                    ) : (
                        <div className="mt-[5px]">
                            <div className="flex flex-col justify-center py-0.5 items-start text-left">
                                {stratName && <span className={`text-[11px] font-bold tracking-wide leading-none whitespace-nowrap ${theme.textName} opacity-80 mb-1`}>{stratName}</span>}
                                <div className="flex items-center gap-1.5 justify-start">
                                    {trade.emotion && <span className={`text-[10px] font-bold font-sans tracking-wide ${theme.textTag}`}>#{trade.emotion}</span>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Note Section (No Image) - Only show if there is a 'displayNote' (i.e. not fully consumed by InfoLine) */}
            {displayNote && (
                <div className="w-full px-5 mt-2.5 relative z-10">
                    <div onClick={() => setIsNoteExpanded(!isNoteExpanded)} className={`relative px-3 pt-5 pb-2 rounded-lg border backdrop-blur-[2px] cursor-pointer transition-all duration-300 group/note ${theme.noteBg} ${theme.noteBorder} ${theme.noteHover}`}>
                        <div className="absolute top-1 left-3 z-20">
                             <span className={`text-[8px] font-bold tracking-widest ${theme.noteLabel} opacity-50 uppercase`}>Note</span>
                        </div>
                        <div className="w-full mt-0.5"><p className={`text-[10px] leading-relaxed font-medium text-slate-400 break-words ${isNoteExpanded ? '' : 'line-clamp-2'}`}>{displayNote}</p></div>
                    </div>
                </div>
            )}
        </div>
    );
});

export const LogsView = ({ trades, lang, hideAmounts, portfolios, onEdit, onDelete }: LogsViewProps) => {
    const t = I18N[lang] || I18N['zh'];
    const [sortType, setSortType] = useState<SortType>('date');
    const [showNotesOnly, setShowNotesOnly] = useState(false);

    const filteredTrades = useMemo(() => showNotesOnly ? trades.filter(t => t.note && t.note.trim().length > 0) : trades, [trades, showNotesOnly]);

    const sortedTrades = useMemo(() => {
        const sorted = [...filteredTrades];
        if (sortType === 'date') return sorted.sort((a, b) => safeDateParse(b.date).getTime() - safeDateParse(a.date).getTime() || (b.id || '').localeCompare(a.id || ''));
        if (sortType === 'pnl_high') return sorted.sort((a, b) => b.pnl - a.pnl);
        if (sortType === 'pnl_low') return sorted.sort((a, b) => a.pnl - b.pnl);
        return sorted;
    }, [filteredTrades, sortType]);

    const groups = useMemo(() => {
        if (sortType !== 'date') return null;
        const g: Record<string, Trade[]> = {};
        sortedTrades.forEach(trade => { if (!g[trade.date]) g[trade.date] = []; g[trade.date].push(trade); });
        return g;
    }, [sortedTrades, sortType]);

    if (!trades || trades.length === 0) return <div className="flex flex-col items-center justify-center py-32 text-slate-600 space-y-6"><div className="w-16 h-16 rounded-full bg-gradient-to-b from-white/5 to-transparent flex items-center justify-center border border-white/5"><Scroll size={24} className="opacity-30 text-white"/></div><div className="text-center"><h3 className="text-[10px] font-bold text-slate-400 mb-1">{t.emptyStateTitle}</h3><p className="text-[8px] max-w-[160px] mx-auto leading-relaxed text-zinc-600 font-medium uppercase tracking-wide">{t.emptyStateDesc}</p></div></div>;

    return (
        <div className="pb-32 min-h-screen relative overflow-hidden">
             <div className="sticky top-0 z-30 flex justify-center py-4 pointer-events-none gap-2">
                <div className="bg-[#050505]/80 backdrop-blur-xl p-0.5 rounded-full border border-white/5 shadow-xl pointer-events-auto ring-1 ring-white/5 inline-flex gap-0.5">
                    {['date', 'pnl_high', 'pnl_low'].map((type) => (
                        <button key={type} onClick={() => setSortType(type as SortType)} className={`flex items-center justify-center gap-1 rounded-full px-3 py-1 transition-all duration-300 relative overflow-hidden whitespace-nowrap ${sortType === type ? 'bg-white/10 text-white shadow-sm border border-white/10' : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'}`}>
                            {type === 'date' ? <Calendar size={9} className="shrink-0" /> : <ArrowUpDown size={9} className="shrink-0" />}
                            <span className="text-[9px] font-bold uppercase tracking-wider">{type === 'date' ? t.sort_date : (type === 'pnl_high' ? t.sort_pnl_high : t.sort_pnl_low)}</span>
                        </button>
                    ))}
                </div>
                <div className="bg-[#050505]/80 backdrop-blur-xl p-0.5 rounded-full border border-white/5 shadow-xl pointer-events-auto ring-1 ring-white/5 flex">
                    <button onClick={() => setShowNotesOnly(!showNotesOnly)} className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-1 transition-all duration-300 relative overflow-hidden whitespace-nowrap ${showNotesOnly ? 'bg-[#C8B085] text-black shadow-[0_0_10px_rgba(200,176,133,0.3)] border border-[#C8B085]' : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'}`}>
                        <StickyNote size={10} className={showNotesOnly ? 'text-black' : 'text-current'} /><span className="text-[9px] font-bold uppercase tracking-wider">{t.filter_notes}</span>
                    </button>
                </div>
            </div>

            <div className="relative px-2 mt-2">
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#C8B085]/10 to-transparent -translate-x-1/2 z-0" />
                {sortType === 'date' && groups ? Object.entries(groups).map(([date, groupTrades]) => (
                    <div key={date} className="relative mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-center mb-5 relative z-10">
                            <div className="bg-[#050505] border border-white/5 rounded-full pl-2.5 pr-3 py-1 flex items-center gap-2 shadow-lg ring-1 ring-white/5">
                                <div className="w-1 h-1 rounded-full bg-[#C8B085] shadow-[0_0_4px_#C8B085]"></div>
                                <span className="text-[10px] font-bold text-zinc-500 font-barlow-numeric tracking-widest">{formatDate(date, lang)}</span>
                            </div>
                        </div>
                        <div className="flex flex-col w-full gap-0.5">{groupTrades.map(trade => <SpineCard key={trade.id} trade={trade} onEdit={onEdit} onDelete={onDelete} hideAmounts={hideAmounts} />)}</div>
                    </div>
                )) : (
                    <div className="flex flex-col w-full mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 gap-0.5">{sortedTrades.map(trade => <SpineCard key={trade.id} trade={trade} onEdit={onEdit} onDelete={onDelete} hideAmounts={hideAmounts} />)}</div>
                )}
            </div>
        </div>
    );
};
