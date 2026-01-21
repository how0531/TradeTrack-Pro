import React, { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { I18N } from '../../constants';
import { useClickOutside } from '../../hooks/useClickOutside';

export const MultiSelectDropdown = ({ options, selected, onChange, icon: Icon, defaultLabel, lang }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useClickOutside(menuRef, () => setIsOpen(false));

    return (
        <div className={`relative w-full ${isOpen ? 'z-[100]' : 'z-30'}`} ref={menuRef}>
            <button onClick={() => setIsOpen(!isOpen)} className={`relative w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all duration-300 ${selected.length > 0 ? 'bg-[#C8B085]/10 border-[#C8B085]/30 text-[#C8B085]' : 'bg-[#1A1C20] border-white/5 text-slate-400 hover:border-white/10'}`}>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase min-w-0">
                    {Icon && <Icon size={12} className="shrink-0" />}
                    <span className="truncate">{selected.length > 0 ? `${selected.length} ${I18N[lang].selected}` : defaultLabel}</span>
                </div>
                <ChevronDown size={12} className={`shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.9)] max-h-48 overflow-y-auto z-[100] ring-1 ring-white/10 custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
                    {options.map((opt: string) => (
                        <div 
                            key={opt}
                            onClick={() => {
                                if (selected.includes(opt)) onChange(selected.filter((s: string) => s !== opt));
                                else onChange([...selected, opt]);
                            }}
                            className={`px-3 py-2.5 text-[10px] font-medium cursor-pointer flex justify-between items-center transition-colors group ${selected.includes(opt) ? 'bg-[#C8B085]/10 text-[#C8B085]' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                        >
                            <span className="break-words leading-tight pr-2">{opt}</span>
                            {selected.includes(opt) && <Check size={10} className="shrink-0" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};