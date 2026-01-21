import React, { useState, useRef } from 'react';
import { ChevronDown, Check, Briefcase, Layers } from 'lucide-react';
import { I18N } from '../../constants';
import { useClickOutside } from '../../hooks/useClickOutside';

export const PortfolioSelector = ({ portfolios, activeIds, onChange, lang }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const t = I18N[lang] || I18N['zh'];

    useClickOutside(menuRef, () => setIsOpen(false));

    const isAllSelected = activeIds.length === portfolios.length;
    
    // Determine Label
    let label = t.allAccounts;
    if (!isAllSelected) {
        if (activeIds.length === 1) {
            const active = portfolios.find((p: any) => p.id === activeIds[0]);
            if (active) label = active.name;
        } else {
            label = t.multiple;
        }
    }

    const toggleAll = () => {
        if (isAllSelected) {
            if (portfolios.length > 0) onChange([portfolios[0].id]);
        } else {
            onChange(portfolios.map((p: any) => p.id));
        }
    };

    const toggleId = (id: string) => {
        if (activeIds.includes(id)) {
            if (activeIds.length <= 1) return; 
            onChange(activeIds.filter((aid: string) => aid !== id));
        } else {
            onChange([...activeIds, id]);
        }
    };

    return (
        <div className="relative z-50" ref={menuRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`
                    relative z-[60] flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300 backdrop-blur-md
                    ${isOpen 
                        ? 'bg-[#C8B085]/10 border-[#C8B085]/40 text-[#C8B085] shadow-[0_0_15px_rgba(200,176,133,0.15)]' 
                        : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10 hover:border-white/20'
                    }
                `}
            >
                <Briefcase size={12} className={isOpen ? 'text-[#C8B085]' : 'text-slate-500'} />
                <span className="text-[10px] font-bold uppercase tracking-wider max-w-[100px] truncate">{label}</span>
                <ChevronDown size={12} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-52 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col ring-1 ring-white/10 z-[100]">
                    <div 
                        onClick={toggleAll}
                        className="px-4 py-3 border-b border-white/5 flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-colors group"
                    >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-300 ${isAllSelected ? 'bg-[#C8B085] border-[#C8B085] shadow-[0_0_8px_rgba(200,176,133,0.4)]' : 'border-white/20 group-hover:border-white/40'}`}>
                            {isAllSelected && <Check size={10} className="text-black stroke-[3]" />}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                            <Layers size={12} className="text-slate-500" />
                            {t.selectAll}
                        </div>
                    </div>

                    <div className="py-1 max-h-64 overflow-y-auto custom-scrollbar">
                        {portfolios.map((p: any) => {
                            const isSelected = activeIds.includes(p.id);
                            const isDisabled = isSelected && activeIds.length === 1;

                            return (
                                <div 
                                    key={p.id} 
                                    onClick={() => !isDisabled && toggleId(p.id)}
                                    className={`px-4 py-2.5 flex items-center gap-3 transition-colors group ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-white/10'}`}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-300 ${isSelected ? 'bg-[#C8B085] border-[#C8B085] shadow-[0_0_8px_rgba(200,176,133,0.4)]' : 'border-white/20 group-hover:border-white/40'}`}>
                                        {isSelected && <Check size={10} className="text-black stroke-[3]" />}
                                    </div>
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_5px_rgba(0,0,0,0.5)]" style={{ backgroundColor: p.profitColor }}></div>
                                        <span className={`text-xs font-medium truncate transition-colors ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{p.name}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};