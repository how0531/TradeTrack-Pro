import React from 'react';
import { I18N, TIME_RANGES } from '../../constants';
import { TimeRange, Lang } from '../../types';

export const TimeRangeSelector = ({ currentRange, setRange, lang, customRangeLabel }: { currentRange: TimeRange, setRange: (r: TimeRange) => void, lang: Lang, customRangeLabel?: React.ReactNode }) => {
    const t = I18N[lang];
    
    const labelMap: Record<TimeRange, string> = {
        'ALL': t.time_all,
        '1M': t.time_1m,
        '3M': t.time_3m,
        'YTD': t.time_ytd,
        'CUSTOM': t.time_custom
    };

    return (
        <div className="relative flex-1 min-w-0 h-[28px] rounded-full border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden group">
            <div className="absolute inset-0 overflow-x-auto no-scrollbar flex items-center px-1 w-full justify-between">
                {(TIME_RANGES as readonly TimeRange[]).map((r) => {
                    const isActive = currentRange === r;
                    const label = r === 'CUSTOM' && customRangeLabel 
                        ? customRangeLabel 
                        : labelMap[r];

                    return (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`
                                flex-1 min-w-fit px-1 h-[20px] rounded-full text-[9px] font-bold uppercase transition-all duration-300 flex items-center justify-center whitespace-nowrap
                                ${isActive 
                                    ? 'bg-[#C8B085] text-[#000000] shadow-[0_1px_4px_rgba(200,176,133,0.3)] z-10' 
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }
                            `}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};