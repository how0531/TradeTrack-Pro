import React, { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { I18N, FREQUENCIES } from '../../constants';
import { useClickOutside } from '../../hooks/useClickOutside';

export const FrequencySelector = ({ currentFreq, setFreq, lang }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const t = I18N[lang] || I18N['zh'];
    const options = FREQUENCIES;

    useClickOutside(menuRef, () => setIsOpen(false));

    const labelMap: Record<string, string> = {
        'daily': t.short_daily,
        'weekly': t.short_weekly,
        'monthly': t.short_monthly,
        'quarterly': t.short_quarterly,
        'yearly': t.short_yearly
    };

    const fullLabelMap: Record<string, string> = {
        'daily': t.freq_daily,
        'weekly': t.freq_weekly,
        'monthly': t.freq_monthly,
        'quarterly': t.freq_quarterly,
        'yearly': t.freq_yearly
    };

    return (
        <div className="relative z-40 shrink-0" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    relative z-[60] flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-300 backdrop-blur-md h-[28px]
                    ${isOpen 
                        ? 'bg-white/10 border-white/20 text-white' 
                        : 'bg-[#25282C] border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                    }
                `}
            >
                <span className="text-[9px] font-bold uppercase tracking-wider">{labelMap[currentFreq] || currentFreq}</span>
                <ChevronDown size={10} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-32 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col ring-1 ring-white/10 z-[100]">
                    {options.map((f: string) => (
                        <div
                            key={f}
                            onClick={() => { setFreq(f); setIsOpen(false); }}
                            className={`px-3 py-2.5 text-[10px] font-bold cursor-pointer transition-colors flex items-center justify-between
                                ${currentFreq === f ? 'bg-white/10 text-[#C8B085]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                            `}
                        >
                            {fullLabelMap[f] || f}
                            {currentFreq === f && <Check size={10} />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};