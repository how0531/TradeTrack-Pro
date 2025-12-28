
// [Manage] Last Updated: 2024-05-22
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { CalendarViewProps, CalendarDay } from '../../types';
import { I18N } from '../../constants';
import { formatCurrency, formatDecimal, formatCompactNumber } from '../../utils/format';

export const CalendarView = ({ dailyPnlMap, currentMonth, setCurrentMonth, onDateClick, monthlyStats, hideAmounts, lang }: CalendarViewProps) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth(); 
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const t = I18N[lang] || I18N['zh'];
    
    // UI Interaction State
    const [showFullPnl, setShowFullPnl] = useState(false);

    // Dropdown State
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);
    const [pickerYear, setPickerYear] = useState(year);

    useEffect(() => {
        setPickerYear(year);
    }, [year]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // FIX: Explicitly type the array to avoid 'implicitly has an any[] type' error
    const calendarDays: CalendarDay[] = [];
    // Padding days
    for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push({ key: `pad-${i}`, day: '', pnl: 0 });
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        calendarDays.push({ key: dateKey, day: i, pnl: dailyPnlMap[dateKey] || 0 }); 
    }

    const maxAbsPnl = useMemo(() => {
        let max = 0;
        calendarDays.forEach(d => { if (Math.abs(d.pnl) > max) max = Math.abs(d.pnl); });
        return max > 0 ? max : 1;
    }, [calendarDays]);

    // Enhanced Bubble Style with Rose/Emerald and Depth
    const getBubbleStyle = (pnl: number, day: string | number) => {
        if (!day) return { size: '0%', bg: 'transparent', text: 'transparent', shadow: 'none', border: 'none', radius: '0' };
        
        // Empty State: Subtle Circle
        if (pnl === 0) {
            return {
                size: '50%', // Smaller for empty days
                bg: 'transparent',
                text: '#555',
                shadow: 'none',
                border: '1px solid rgba(255,255,255,0.08)',
                radius: '50%', // Always circle
                opacity: 1,
                ring: 'none'
            };
        }

        const intensity = Math.abs(pnl) / maxAbsPnl; // 0 to 1
        const sizePct = 65 + (intensity * 30); // 65% to 95%
        const isWin = pnl > 0;
        const opacity = 0.5 + (intensity * 0.5);

        // Rose (Win) / Emerald (Loss) - Gradient for depth
        const bg = isWin 
            ? `radial-gradient(circle at 35% 35%, rgba(208, 90, 90, ${opacity}), rgba(150, 50, 50, ${opacity}))` // Using Theme Red #D05A5Aish
            : `radial-gradient(circle at 35% 35%, rgba(91, 154, 139, ${opacity}), rgba(44, 95, 84, ${opacity}))`; // Using Theme Green #5B9A8Bish

        const border = isWin
            ? `1px solid rgba(208, 90, 90, 0.4)`
            : `1px solid rgba(91, 154, 139, 0.4)`;

        const shadow = intensity > 0.15
            ? `0 4px 12px ${isWin ? 'rgba(208, 90, 90, 0.2)' : 'rgba(91, 154, 139, 0.2)'}` // Low key shadow
            : 'none';

        const textColor = '#FFF';

        return {
            size: `${sizePct}%`,
            bg,
            text: textColor,
            shadow,
            border,
            radius: '50%', // Strict Circle
            opacity: 1,
            ring: '1px solid rgba(0,0,0,0.6)' // Inner shadow ring simulation
        };
    };

    // Logic to separate Number and Unit for styling
    const getFormattedPnl = () => {
        if (showFullPnl) {
            return { val: formatCurrency(monthlyStats.pnl, hideAmounts), unit: '' };
        }

        const raw = hideAmounts ? '****' : formatCompactNumber(monthlyStats.pnl, false);
        // Regex to separate numeric part from string part (e.g. "2.72" and "萬")
        const match = raw.match(/^([0-9.,+-]+)(.*)$/);
        return {
            val: match ? match[1] : raw,
            unit: match ? match[2] : ''
        };
    };

    const pnlDisplay = getFormattedPnl();

    // --- Dynamic Font Size Logic ---
    // Calculate total character length (value + unit)
    const valLength = (pnlDisplay.val?.length || 0) + (pnlDisplay.unit?.length || 0);
    // Determine font size based on length
    // > 13 chars (e.g. -123,456,789): text-3xl
    // > 9 chars  (e.g. 12,345,678): text-4xl
    // <= 9 chars : text-5xl (Default)
    const fontSizeClass = valLength > 13 ? 'text-3xl' : valLength > 9 ? 'text-4xl' : 'text-5xl';

    return (
        <div className="w-full rounded-[32px] border border-white/[0.08] bg-black/10 backdrop-blur-xl relative overflow-hidden shadow-2xl ring-1 ring-white/5">
             {/* Top Light Gradient */}
             <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

             <div className="p-6 relative z-10">
                {/* Header with Dropdown */}
                <div className="flex justify-between items-center mb-8 px-1 relative z-20">
                    <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-2 rounded-full hover:bg-white/5 transition-colors text-zinc-500 hover:text-white group"><ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform"/></button>
                    
                    <div className="relative" ref={pickerRef}>
                        <button 
                            onClick={() => setIsPickerOpen(!isPickerOpen)}
                            className="text-xl font-bold font-barlow-numeric tracking-[0.1em] text-white uppercase flex items-center gap-3 select-none hover:bg-white/5 px-4 py-2 rounded-xl transition-colors"
                        >
                            <span className="opacity-90">{year}</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                            <span className="text-[#C8B085]">{String(month + 1).padStart(2, '0')}</span>
                            <ChevronDown size={14} className={`text-zinc-600 transition-transform duration-300 ${isPickerOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isPickerOpen && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
                                {/* Year Navigator */}
                                <div className="flex justify-between items-center p-3 border-b border-white/5 bg-white/5">
                                    <button onClick={() => setPickerYear(p => p - 1)} className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white"><ChevronLeft size={16}/></button>
                                    <span className="font-barlow-numeric font-bold text-white text-lg">{pickerYear}</span>
                                    <button onClick={() => setPickerYear(p => p + 1)} className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white"><ChevronRight size={16}/></button>
                                </div>
                                {/* Month Grid */}
                                <div className="grid grid-cols-4 gap-1 p-2">
                                    {Array.from({length: 12}).map((_, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => {
                                                setCurrentMonth(new Date(pickerYear, i, 1));
                                                setIsPickerOpen(false);
                                            }}
                                            className={`py-3 rounded-lg text-xs font-bold font-barlow-numeric transition-all ${
                                                year === pickerYear && month === i 
                                                ? 'bg-[#C8B085] text-black shadow-lg shadow-[#C8B085]/20' 
                                                : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-2 rounded-full hover:bg-white/5 transition-colors text-zinc-500 hover:text-white group"><ChevronRight size={20} className="group-hover:translate-x-0.5 transition-transform"/></button>
                </div>

                {/* Days Header */}
                <div className="grid grid-cols-7 text-center mb-4">
                    {daysOfWeek.map((d,i) => <div key={i} className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest select-none">{d}</div>)}
                </div>

                {/* Grid & Bubbles */}
                <div className="relative mb-2">
                    <div className="grid grid-cols-7 gap-y-3 gap-x-1">
                        {calendarDays.map((item) => {
                            const style = getBubbleStyle(item.pnl, item.day);
                            return (
                                <div 
                                    key={item.key} 
                                    className="aspect-square flex items-center justify-center relative"
                                    onClick={() => { if (item.day && onDateClick) onDateClick(item.key); }}
                                >
                                    {item.day && (
                                        <div 
                                            className={`flex flex-col items-center justify-center transition-all duration-500 cursor-pointer group hover:scale-110`}
                                            style={{ 
                                                width: style.size,
                                                height: style.size,
                                                background: style.bg, 
                                                boxShadow: style.shadow,
                                                border: style.border,
                                                borderRadius: '50%',
                                                opacity: style.opacity,
                                            }}
                                        >
                                            {/* Inner Ring for Depth */}
                                            {style.ring !== 'none' && (
                                                <div className="absolute inset-0 rounded-full border border-black/40 pointer-events-none"></div>
                                            )}

                                            <div 
                                                className={`text-[10px] font-bold font-barlow-numeric leading-none transition-colors select-none ${item.pnl !== 0 && !hideAmounts ? 'mb-0.5' : ''}`} 
                                                style={{ color: style.text }}
                                            >
                                                {item.day}
                                            </div>
                                            
                                            {item.pnl !== 0 && !hideAmounts && (
                                                <div className="text-[8px] font-bold font-barlow-numeric tracking-tight leading-none whitespace-nowrap px-0.5 scale-90 opacity-90 group-hover:opacity-100 select-none drop-shadow-md" style={{ color: '#FFF' }}>
                                                    {formatCompactNumber(item.pnl, true)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Monthly Summary Footer (Refined Low Key) */}
            <div className="px-8 py-6 border-t border-dashed border-white/10 bg-[#050505]/20 backdrop-blur-md relative z-10">
                <div className="flex justify-between items-end gap-2">
                    <div 
                        className="flex flex-col cursor-pointer active:opacity-80 transition-opacity select-none min-w-0 flex-1"
                        onClick={() => setShowFullPnl(!showFullPnl)}
                        title="Click to toggle full number"
                    >
                        {/* Number on Top with Responsive Layout */}
                        <span 
                            className={`${fontSizeClass} font-barlow-numeric font-bold tracking-tight flex items-baseline leading-none whitespace-nowrap ${monthlyStats.pnl >= 0 ? 'text-[#D05A5A]' : 'text-[#5B9A8B]'}`}
                        >
                            {pnlDisplay.val}
                            {pnlDisplay.unit && <span className="text-2xl ml-1 font-bold opacity-90">{pnlDisplay.unit}</span>}
                        </span>
                        {/* Label on Bottom */}
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                            {t.monthlyPnl} 
                            {monthlyStats.pnl !== 0 && (
                                <span className={`w-1.5 h-1.5 rounded-full ${monthlyStats.pnl > 0 ? 'bg-[#D05A5A]' : 'bg-[#5B9A8B]'}`}></span>
                            )}
                        </span>
                    </div>
                    {/* Stats Group: Added shrink-0 to prevent compression */}
                    <div className="flex gap-6 pb-0.5 shrink-0">
                        <div className="flex flex-col items-end">
                            <span className="text-xl font-bold text-white font-barlow-numeric">{formatDecimal(monthlyStats.winRate)}%</span>
                            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider mt-1">{t.winRate}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-xl font-bold text-white font-barlow-numeric">{monthlyStats.count}</span>
                            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider mt-1">{t.trades}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
