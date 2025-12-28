
// [Manage] Last Updated: 2024-05-22
import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { StrategyStat } from '../../types';
import { I18N } from '../../constants';
import { formatDecimal } from '../../utils/format';

export const StrategyListView = ({ data, onSelect, lang }: { data: { name: string; stat: StrategyStat }[], onSelect: (name: string) => void, lang: 'zh' | 'en' }) => {
    const t = I18N[lang] || I18N['zh'];
    const [sortType, setSortType] = useState<'pnl' | 'trades'>('pnl');
    const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

    // 1. Calculate Max Absolute PnL for normalization
    const maxAbsPnl = useMemo(() => {
        if (data.length === 0) return 1;
        const values = data.map(d => Math.abs(d.stat.pnl));
        return Math.max(...values, 1);
    }, [data]);

    // 2. Sorting Logic
    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => {
            let valA, valB;
            if (sortType === 'pnl') {
                valA = a.stat.pnl;
                valB = b.stat.pnl;
            } else {
                valA = a.stat.trades;
                valB = b.stat.trades;
            }
            return sortDir === 'desc' ? valB - valA : valA - valB;
        });
    }, [data, sortType, sortDir]);

    const handleSort = (type: 'pnl' | 'trades') => {
        if (sortType === type) {
            setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortType(type);
            setSortDir('desc');
        }
    };

    if (data.length === 0) {
        return <div className="text-center py-8 text-zinc-600 text-xs font-mono">{t.noData}</div>;
    }

    // Custom formatter: Mono style, clean
    const formatStealthPnl = (val: number) => {
        if (val === 0) return '0.00';
        const abs = Math.abs(val);
        const sign = val < 0 ? '-' : '';
        
        let valStr = '';
        if (abs >= 1000000) valStr = `${(abs / 1000000).toFixed(2)}m`;
        else if (abs >= 1000) valStr = `${(abs / 1000).toFixed(1)}k`;
        else valStr = `${abs.toFixed(0)}`;

        return `${sign}${valStr}`; 
    };

    const SortIcon = ({ active, dir }: { active: boolean, dir: 'asc' | 'desc' }) => (
        <span className={`transition-opacity ${active ? 'opacity-100 text-[#C8B085]' : 'opacity-20'}`}>
            {dir === 'desc' ? <ArrowDown size={10} strokeWidth={3} /> : <ArrowUp size={10} strokeWidth={3} />}
        </span>
    );

    return (
        <div className="bg-black rounded-xl overflow-hidden border border-zinc-800 select-none shadow-2xl flex flex-col">
            {/* Header with Sort Controls */}
            <div className="flex justify-between px-5 py-3 bg-black border-b border-zinc-900/50 shrink-0">
                <button 
                    onClick={() => handleSort('trades')}
                    className={`text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-1 hover:text-white transition-colors ${sortType === 'trades' ? 'text-white' : 'text-zinc-600'}`}
                >
                    Strategy / Trades <SortIcon active={sortType === 'trades'} dir={sortDir} />
                </button>
                <button 
                    onClick={() => handleSort('pnl')}
                    className={`text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-1 hover:text-white transition-colors ${sortType === 'pnl' ? 'text-white' : 'text-zinc-600'}`}
                >
                    Net PnL <SortIcon active={sortType === 'pnl'} dir={sortDir} />
                </button>
            </div>

            {/* Rows - Scrollable Container Removed (Unlimited Height) */}
            <div className="divide-y divide-zinc-900/30">
                {sortedData.map(({ name, stat }) => {
                    const pnl = stat.pnl;
                    // Calculate width relative to 50% of the container
                    const barWidthPct = Math.max((Math.abs(pnl) / maxAbsPnl) * 50, 2); 
                    const isProfit = pnl > 0;
                    const isLoss = pnl < 0;
                    const isZero = pnl === 0;

                    const textColor = isProfit 
                        ? 'text-[#ff9e9e]' // Soft Red Text
                        : (isLoss ? 'text-[#7ee8d2]' : 'text-zinc-600'); // Soft Teal Text

                    // Using gradients to simulate the "Sphere/Bubble" look from the image
                    // Profit: Deep Red
                    const profitGradient = 'bg-gradient-to-b from-[#823c3c] to-[#451818] border-t border-white/10 shadow-[0_2px_4px_rgba(0,0,0,0.3)]';
                    // Loss: Deep Green/Teal
                    const lossGradient = 'bg-gradient-to-b from-[#3b6e63] to-[#1a332d] border-t border-white/10 shadow-[0_2px_4px_rgba(0,0,0,0.3)]';

                    const barClass = isProfit ? profitGradient : lossGradient;

                    return (
                        <div 
                            key={name}
                            onClick={() => onSelect(name)}
                            className="group w-full px-5 py-3 hover:bg-zinc-900/20 transition-all cursor-pointer border-l-2 border-transparent hover:border-zinc-700 relative overflow-hidden"
                        >
                            {/* Row 1: Info */}
                            <div className="flex justify-between items-end mb-2 relative z-10">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors tracking-wide flex items-baseline">
                                        {name.includes('_') ? (
                                            <>
                                                {name.split('_')[0]}
                                                <span className="text-[10px] text-zinc-600 font-medium ml-1">{name.split('_').slice(1).join(' ')}</span>
                                            </>
                                        ) : name}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-zinc-600 font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800/50">{stat.trades}T</span>
                                        <span className="text-[9px] text-zinc-700 font-mono">WR {formatDecimal(stat.winRate)}%</span>
                                    </div>
                                </div>
                                <span className={`font-mono text-sm font-bold tracking-tight ${textColor} drop-shadow-sm`}>
                                    {formatStealthPnl(pnl)}
                                </span>
                            </div>

                            {/* Row 2: Center Axis Bar (Deep Matte Style) */}
                            <div className="w-full h-2 relative bg-[#0a0a0a] rounded-full overflow-hidden flex items-center border border-white/[0.03]">
                                {/* Center Axis Line */}
                                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-zinc-800 z-0"></div>

                                {isZero ? (
                                    <div className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
                                ) : (
                                    <div 
                                        className={`absolute h-full rounded-full transition-all duration-700 ease-out z-10 ${barClass}`}
                                        style={{ 
                                            width: `${barWidthPct}%`,
                                            left: isProfit ? '50%' : 'auto',
                                            right: isLoss ? '50%' : 'auto',
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
