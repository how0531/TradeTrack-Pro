import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { I18N } from '../../constants';
import { Lang } from '../../types';

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
        const dateStr = date.toISOString().split('T')[0];
        if (step === 'start') { 
            setStartDate(dateStr); 
            // If new start date is after current end date, reset end date
            if (endDate && dateStr > endDate) setEndDate(null); 
            setStep('end'); 
        } else { 
            // If selected date is before start date, treat it as new start date
            if (startDate && dateStr < startDate) { 
                setStartDate(dateStr); 
                setStep('end'); 
            } else {
                setEndDate(dateStr); 
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-[#141619] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-white/5">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider">{t.selectDateRange}</h3>
                        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 text-slate-500"><X size={20} /></button>
                    </div>
                    <div className="flex gap-2">
                        <div onClick={() => setStep('start')} className={`flex-1 p-2 rounded-lg border transition-all cursor-pointer ${step === 'start' ? `border-gold bg-gold/5` : 'border-white/5 bg-[#0B0C10]'}`}>
                            <div className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">{t.startDate}</div>
                            <div className={`text-xs font-barlow-numeric font-bold ${startDate ? 'text-white' : 'text-slate-800'}`}>{startDate || 'YYYY-MM-DD'}</div>
                        </div>
                        <div onClick={() => setStep('end')} className={`flex-1 p-2 rounded-lg border transition-all cursor-pointer ${step === 'end' ? `border-gold bg-gold/5` : 'border-white/5 bg-[#0B0C10]'}`}>
                            <div className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">{t.endDate}</div>
                            <div className={`text-xs font-barlow-numeric font-bold ${endDate ? 'text-white' : 'text-slate-800'}`}>{endDate || 'YYYY-MM-DD'}</div>
                        </div>
                    </div>
                </div>
                <div className="p-4">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => setViewDate(new Date(year, month-1, 1))} className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white"><ChevronLeft size={18}/></button>
                        <span className="font-bold text-white text-xs">{year} / {month+1}</span>
                        <button onClick={() => setViewDate(new Date(year, month+1, 1))} className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white"><ChevronRight size={18}/></button>
                    </div>
                    <div className="grid grid-cols-7 text-center mb-2">{'SMTWTFS'.split('').map((d,i) => <div key={i} className="text-[9px] font-bold text-slate-700">{d}</div>)}</div>
                    <div className="grid grid-cols-7 gap-y-1">
                        {days.map((d, i) => {
                            const dateStr = d ? d.toISOString().split('T')[0] : '';
                            const isSel = dateStr === startDate || dateStr === endDate;
                            const dInRange = d && startDate && endDate && dateStr > startDate && dateStr < endDate;
                            return (
                                <div key={i} className="relative flex justify-center items-center h-8">
                                    {dInRange && <div className="absolute inset-x-0 h-full bg-gold/10" />}
                                    <button 
                                        onClick={() => d && handleDateClick(d)} 
                                        className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-barlow-numeric font-bold z-10 transition-all ${!d ? 'invisible' : ''} ${isSel ? 'bg-gold text-black shadow-lg scale-110' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        {d ? d.getDate() : ''}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="p-4 border-t border-white/5 flex justify-end gap-3">
                    <button onClick={() => { setStartDate(null); setEndDate(null); }} className="text-[10px] font-bold uppercase text-slate-600 hover:text-white transition-colors">{t.reset}</button>
                    <button onClick={() => onApply(startDate, endDate)} disabled={!startDate || !endDate} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${startDate && endDate ? 'bg-gold text-black shadow-md' : 'bg-[#25282C] text-slate-700 cursor-not-allowed'}`}>{t.confirm}</button>
                </div>
            </div>
        </div>
    );
};