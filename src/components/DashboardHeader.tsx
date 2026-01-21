
import React, { useState } from 'react';
import { StatsChart } from './tabs/StatsTab';
import { MultiSelectDropdown } from './selectors/MultiSelectDropdown';
import { FrequencySelector } from './selectors/FrequencySelector';
import { TimeRangeSelector } from './selectors/TimeRangeSelector';
import { PortfolioSelector } from './selectors/PortfolioSelector';
import { Eye, EyeOff, Filter, Activity, BrainCircuit, TrendingUp, CloudOff, RefreshCw, Check, AlertCircle, Share2 } from 'lucide-react';
import { THEME } from '../constants';
import { formatCompactNumber, formatDecimal, formatCurrency } from '../utils/format';
import { useTradeContext } from '../context/TradeContext';

interface DashboardHeaderProps {
    setIsShareModalOpen: (b: boolean) => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ setIsShareModalOpen }) => {
    
    // Global State from Context
    const { 
        metrics, portfolios, activePortfolioIds, setActivePortfolioIds, 
        frequency, setFrequency, lang, hideAmounts, setHideAmounts, 
        chartHeight, setChartHeight, timeRange, setTimeRange, 
        customRange, setCustomRange, setIsDatePickerOpen, 
        setIsFilterOpen, isFilterOpen,
        availableStrategies, availableEmotions, filterStrategy, setFilterStrategy, 
        filterEmotion, setFilterEmotion, 
        syncStatus, authStatus, user, t, triggerCloudBackup 
    } = useTradeContext();

    // Local Display State
    const [showFullEquity, setShowFullEquity] = useState(false);
    const hasActiveFilters = filterStrategy.length > 0 || filterEmotion.length > 0;

    // Derived Display Logic
    const getFormattedEquity = () => {
        if (showFullEquity) {
            return { val: formatCurrency(metrics.currentEq, hideAmounts), unit: '' };
        }
        const raw = hideAmounts ? '****' : formatCompactNumber(metrics.currentEq, false);
        const match = raw.match(/^([0-9.,+-]+)(.*)$/);
        return {
            val: match ? match[1] : raw,
            unit: match ? match[2] : ''
        };
    };

    const eqDisplay = getFormattedEquity();
    const eqLength = (eqDisplay.val?.length || 0) + (eqDisplay.unit?.length || 0);
    const eqFontSizeClass = eqLength > 12 ? 'text-2xl' : eqLength > 9 ? 'text-3xl' : 'text-4xl';

    const SyncIndicator = () => {
        const isOnline = authStatus === 'online' && user && !user.isAnonymous;
        if (!isOnline) {
            return (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/5">
                    <CloudOff size={10} className="text-slate-500" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{t.offline}</span>
                </div>
            );
        }
        if (syncStatus === 'saving') {
            return (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/5">
                    <RefreshCw size={10} className="text-gold animate-spin" />
                    <span className="text-[9px] font-bold text-gold uppercase tracking-tighter">{t.saving}</span>
                </div>
            );
        }
        if (syncStatus === 'error') {
             return (
                <button onClick={triggerCloudBackup} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors">
                    <AlertCircle size={10} className="text-red-400" />
                    <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">{t.syncError}</span>
                </button>
            );
        }
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/5 transition-all duration-500">
                <Check size={10} className="text-[#5B9A8B]" />
                <span className="text-[9px] font-bold text-[#5B9A8B] uppercase tracking-tighter">{t.saved}</span>
            </div>
        );
    };

    return (
        <div className="flex flex-col bg-transparent rounded-b-[32px] border-b border-white/5 z-40 relative overflow-visible shrink-0 transition-all duration-300">
            <div className="px-5 pt-6 flex flex-col w-full relative z-10">
                <div className="flex justify-between items-center mb-2 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-[#25282C] border border-white/5 shadow-sm"><Activity size={14} color={THEME.BLUE} /></div>
                        <SyncIndicator />
                    </div>
                    <div className="flex items-center gap-3">
                        <PortfolioSelector portfolios={portfolios} activeIds={activePortfolioIds} onChange={setActivePortfolioIds} lang={lang} />
                        <button onClick={() => setHideAmounts(!hideAmounts)} className="text-slate-500 hover:text-white transition-colors p-1">{hideAmounts ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                    </div>
                </div>

                <div className="flex flex-col mb-3 shrink-0">
                    <div className="flex justify-between items-baseline mb-1 gap-2">
                        {/* MAIN EQUITY */}
                        <div className="flex-1 min-w-0">
                            <h1 
                                onClick={() => setShowFullEquity(!showFullEquity)}
                                className={`${eqFontSizeClass} font-bold font-barlow-numeric tracking-tight text-[#C8B085] flex items-baseline gap-1 cursor-pointer select-none active:opacity-80 transition-opacity whitespace-nowrap overflow-hidden`}
                            >
                                <span>{eqDisplay.val}</span>
                                {eqDisplay.unit && <span className="text-base font-bold translate-y-[-1px] opacity-90">{eqDisplay.unit}</span>}
                            </h1>
                        </div>
                        <div className="text-right shrink-0">
                            {metrics.isPeak ? (
                                <div className="flex items-center justify-end gap-1 text-[#C8B085] animate-pulse">
                                    <TrendingUp size={12} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{t.newPeak}</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-end gap-1 text-slate-500">
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{t.currentDD}</span>
                                    <span className="text-xs font-bold font-barlow-numeric" style={{ color: THEME.GREEN }}>{formatDecimal(metrics.currentDD)}%</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-1 text-xs font-bold font-barlow-numeric ${metrics.eqChange >= 0 ? 'text-red-400' : 'text-slate-400'}`}>
                            {formatCompactNumber(metrics.eqChange, true)}
                            <span className="opacity-60">({metrics.eqChangePct >= 0 ? '+' : ''}{formatDecimal(metrics.eqChangePct)}%)</span>
                        </div>
                    </div>
                </div>

                {/* FREQUENCY + TIME RANGE + FILTER CONTROLS */}
                <div className="flex items-center gap-1.5 mb-3 shrink-0 h-[28px] relative z-[70]">
                    <FrequencySelector currentFreq={frequency} setFreq={setFrequency} lang={lang} />
                    
                    <TimeRangeSelector 
                        currentRange={timeRange} 
                        setRange={(r: any) => { 
                            if(r === 'CUSTOM') setIsDatePickerOpen(true); 
                            else { setTimeRange(r); setCustomRange({start: null, end: null}); }
                        }} 
                        lang={lang} 
                        customRangeLabel={
                            customRange.start && customRange.end ? (
                                <div className="flex flex-col items-center justify-center leading-none -space-y-0.5">
                                    <span className="text-[8px] font-barlow-numeric font-bold tracking-tighter">{customRange.start.slice(5).replace('-','/')}</span>
                                    <span className="text-[8px] font-barlow-numeric font-bold tracking-tighter opacity-80">{customRange.end.slice(5).replace('-','/')}</span>
                                </div>
                            ) : (customRange.start ? customRange.start.slice(5).replace('-','/') : undefined)
                        } 
                    />

                    <button 
                        onClick={() => setIsShareModalOpen(true)}
                        className="h-[28px] w-[28px] flex items-center justify-center rounded-lg border bg-[#C8B085]/10 border-[#C8B085]/20 text-[#C8B085] hover:bg-[#C8B085]/20 shrink-0 transition-colors"
                    >
                        <Share2 size={12} />
                    </button>

                    <button 
                        onClick={() => setIsFilterOpen(!isFilterOpen)} 
                        className={`
                            h-[28px] w-[28px] flex items-center justify-center rounded-lg border transition-all shrink-0
                            ${isFilterOpen || hasActiveFilters 
                                ? 'bg-[#C8B085] text-black border-[#C8B085] shadow-[0_0_10px_rgba(200,176,133,0.3)]' 
                                : 'bg-[#C8B085]/10 border-[#C8B085]/20 text-[#C8B085] hover:bg-[#C8B085]/20'
                            }
                        `}
                    >
                        <Filter size={12} />
                    </button>
                </div>

                {isFilterOpen && (
                    <div className="grid grid-cols-2 gap-2 mb-3 shrink-0 animate-in fade-in slide-in-from-top-2 relative z-[60]">
                        <MultiSelectDropdown options={availableStrategies} selected={filterStrategy} onChange={setFilterStrategy} icon={Activity} defaultLabel={t.allStrategies} lang={lang} />
                        <MultiSelectDropdown options={availableEmotions} selected={filterEmotion} onChange={setFilterEmotion} icon={BrainCircuit} defaultLabel={t.allEmotions} lang={lang} />
                    </div>
                )}

                <StatsChart 
                    onZoom={(s, e) => { 
                        setCustomRange({ start: s, end: e }); 
                        setTimeRange('CUSTOM'); 
                    }}
                />
            </div>
        </div>
    );
};
