import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { I18N } from '../../constants';
import { Lang } from '../../types';
import { getLocalDateStr } from '../../utils/format';

interface CustomDateRangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (start: string | null, end: string | null) => void;
    initialRange: { start: string | null; end: string | null };
    lang: Lang;
}

export const CustomDateRangeModal = ({ isOpen, onClose, onApply, initialRange, lang }: CustomDateRangeModalProps) => {
    const t = I18N[lang] || I18N['zh'];
    const [viewDate, setViewDate] = useState(new Date());
    const [startDate, setStartDate] = useState<string | null>(initialRange.start);
    const [endDate, setEndDate] = useState<string | null>(initialRange.end);
    const [step, setStep] = useState<'start' | 'end'>('start');

    useEffect(() => { 
        if(isOpen) { 
            setStartDate(initialRange.start); 
            setEndDate(initialRange.end); 
            setStep('start'); 
        } 
    }, [isOpen, initialRange]);

    if (!isOpen) return null;

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const days: (Date | null)[] = [];
    for(let i=0; i<firstDay; i++) days.push(null);
    for(let i=1; i<=daysInMonth; i++) days.push(new Date(year, month, i));

    const handleDateClick = (date: Date) => {
        const dateStr = getLocalDateStr(date);
        if (step === 'start') { 
            setStartDate(dateStr); 
            if (endDate && dateStr > endDate) setEndDate(null); 
            setStep('end'); 
        } else { 
            if (startDate && dateStr < startDate) { 
                setStartDate(dateStr); 
                setStep('end'); 
            } else {
                setEndDate(dateStr); 
            }
        }
    };

    const handleDirectInput = (type: 'start' | 'end', val: string) => {
        if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
            if (type === 'start') {
                setStartDate(val);
                if (endDate && val > endDate) setEndDate(null);
            } else {
                if (startDate && val < startDate) {
                    setStartDate(val);
                    setEndDate(null);
                } else {
                    setEndDate(val);
                }
            }
        }
    };

    const handleToday = (e: React.MouseEvent) => {
        e.stopPropagation();
        const today = getLocalDateStr(new Date());
        setEndDate(today);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-[#141619] rounded-[32px] border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.6)] overflow-hidden">
                {/* Header Section */}
                <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white font-bold text-sm tracking-tight flex items-center gap-2">
                            <Calendar size={16} className="text-[#C8B085]" />
                            {t.selectDateRange}
                        </h3>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-slate-500 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex gap-3">
                        {/* Start Date Box */}
                        <div 
                            onClick={() => setStep('start')} 
                            className={`flex-1 p-3 rounded-2xl border transition-all cursor-pointer group ${step === 'start' ? `border-[#C8B085] bg-[#C8B085]/5 shadow-[0_0_20px_rgba(200,176,133,0.05)]` : 'border-white/5 bg-black/40'}`}
                        >
                            <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block tracking-wider">{t.startDate}</label>
                            <input 
                                type="text"
                                value={startDate || ''}
                                placeholder="YYYY-MM-DD"
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    handleDirectInput('start', e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className={`w-full bg-transparent border-none p-0 text-sm font-barlow-numeric font-bold focus:ring-0 ${startDate ? 'text-white' : 'text-zinc-800'}`}
                            />
                        </div>

                        {/* End Date Box */}
                        <div 
                            onClick={() => setStep('end')} 
                            className={`flex-1 p-3 rounded-2xl border transition-all cursor-pointer group relative ${step === 'end' ? `border-[#C8B085] bg-[#C8B085]/5 shadow-[0_0_20px_rgba(200,176,133,0.05)]` : 'border-white/5 bg-black/40'}`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{t.endDate}</label>
                                <button 
                                    onClick={handleToday}
                                    className="text-[9px] font-bold text-[#C8B085] hover:underline px-1.5 py-0.5 rounded-md hover:bg-[#C8B085]/10"
                                >
                                    今日
                                </button>
                            </div>
                            <input 
                                type="text"
                                value={endDate || ''}
                                placeholder="YYYY-MM-DD"
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    handleDirectInput('end', e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className={`w-full bg-transparent border-none p-0 text-sm font-barlow-numeric font-bold focus:ring-0 ${endDate ? 'text-white' : 'text-zinc-800'}`}
                            />
                        </div>
                    </div>
                </div>

                {/* Calendar Body */}
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <button onClick={() => setViewDate(new Date(year, month-1, 1))} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"><ChevronLeft size={20}/></button>
                        <span className="font-bold text-white text-sm tracking-widest">{year} / {month+1}</span>
                        <button onClick={() => setViewDate(new Date(year, month+1, 1))} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"><ChevronRight size={20}/></button>
                    </div>
                    
                    <div className="grid grid-cols-7 text-center mb-3">
                        {'SMTWTFS'.split('').map((d,i) => (
                            <div key={i} className="text-[10px] font-bold text-zinc-700 tracking-tighter">{d}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-0">
                        {days.map((d, i) => {
                            const dateStr = d ? getLocalDateStr(d) : '';
                            const isStart = dateStr === startDate;
                            const isEnd = dateStr === endDate;
                            const isSel = isStart || isEnd;
                            const dInRange = d && startDate && endDate && dateStr > startDate && dateStr < endDate;
                            
                            // Calculate column position (0-6)
                            const col = i % 7;
                            
                            return (
                                <div key={i} className="relative flex justify-center items-center h-10">
                                    {/* Range Background - Seamless */}
                                    {dInRange && (
                                        <div className="absolute inset-y-1.5 inset-x-0 bg-[#C8B085]/15 z-0" />
                                    )}
                                    {isStart && endDate && (
                                        <div className="absolute inset-y-1.5 right-0 left-1/2 bg-[#C8B085]/15 z-0 rounded-l-md" />
                                    )}
                                    {isEnd && startDate && (
                                        <div className="absolute inset-y-1.5 left-0 right-1/2 bg-[#C8B085]/15 z-0 rounded-r-md" />
                                    )}
                                    
                                    <button 
                                        onClick={() => d && handleDateClick(d)} 
                                        className={`
                                            relative w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-barlow-numeric font-bold z-10 transition-all
                                            ${!d ? 'invisible' : ''} 
                                            ${isSel ? 'bg-[#C8B085] text-black shadow-lg shadow-[#C8B085]/40 scale-105' : 
                                              dInRange ? 'text-[#C8B085] hover:bg-[#C8B085]/20' : 'text-zinc-500 hover:text-white hover:bg-white/5'}
                                        `}
                                    >
                                        {d ? d.getDate() : ''}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 flex items-center justify-between bg-white/[0.01]">
                    <button 
                        onClick={() => { setStartDate(null); setEndDate(null); }} 
                        className="text-[10px] font-bold uppercase text-zinc-600 hover:text-zinc-300 transition-colors tracking-widest"
                    >
                        {t.reset}
                    </button>
                    <button 
                        onClick={() => onApply(startDate, endDate)} 
                        disabled={!startDate || !endDate} 
                        className={`
                            px-8 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all
                            ${startDate && endDate ? 'bg-[#C8B085] text-black shadow-[0_8px_16px_rgba(200,176,133,0.3)] hover:scale-[1.02] active:scale-95' : 'bg-[#25282C] text-zinc-700 cursor-not-allowed'}
                        `}
                    >
                        {t.confirm}
                    </button>
                </div>
            </div>
        </div>
    );
};