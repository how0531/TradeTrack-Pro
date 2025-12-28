import React from 'react';

// Shared container style for scrollable capsules
const ScrollContainer = ({ children }: { children: React.ReactNode }) => (
    <div className="flex overflow-x-auto gap-2 pb-2 -mx-1 px-1 no-scrollbar mask-gradient-right items-center">
        {children}
    </div>
);

export const StrategyChipsInput = ({ strategies, value, onChange }: any) => (
    <ScrollContainer>
        {strategies.map((s: string) => (
            <button 
                type="button"
                key={s} 
                onClick={() => onChange(s === value ? '' : s)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all border whitespace-nowrap ${value === s ? 'bg-[#C8B085] text-black border-[#C8B085] shadow-[0_0_10px_rgba(200,176,133,0.4)]' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:border-white/20'}`}
            >
                {s}
            </button>
        ))}
    </ScrollContainer>
);

export const EmotionChipsInput = ({ emotions, value, onChange }: any) => (
    <ScrollContainer>
        {emotions.map((e: string) => (
            <button 
                type="button"
                key={e} 
                onClick={() => onChange(e === value ? '' : e)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all border whitespace-nowrap ${value === e ? 'bg-[#526D82] text-white border-[#526D82] shadow-[0_0_10px_rgba(82,109,130,0.4)]' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:border-white/20'}`}
            >
                {e}
            </button>
        ))}
    </ScrollContainer>
);

export const PortfolioChipsInput = ({ portfolios, value, onChange }: any) => (
    <ScrollContainer>
        {portfolios.map((p: any) => (
            <button 
                type="button"
                key={p.id} 
                onClick={() => onChange(p.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all border flex items-center gap-1.5 whitespace-nowrap ${value === p.id ? 'bg-white/10 text-white border-white/30 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'bg-transparent text-slate-500 border-white/5 hover:border-white/10'}`}
            >
                <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_rgba(0,0,0,0.8)]" style={{ backgroundColor: p.profitColor }}></div>
                {p.name}
            </button>
        ))}
    </ScrollContainer>
);