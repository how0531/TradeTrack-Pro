
import React from 'react';
import { StatsContent } from '../components/tabs/StatsTab';
import { DashboardHeader } from '../components/DashboardHeader';
import { useTradeContext } from '../context/TradeContext';

// Props reduced to only what's not in Context or specific local overrides from App
// interface StatsPageProps removed


export const StatsPage: React.FC<{
    setIsShareModalOpen: (b: boolean) => void;
    detailStrategy: string | null;
    setDetailStrategy: (s: string | null) => void;
}> = ({ setIsShareModalOpen, detailStrategy, setDetailStrategy }) => {
    const { 
        // Data & Filters
        availableStrategies, availableEmotions, 
        filterStrategy, setFilterStrategy,
        filterEmotion, setFilterEmotion,
        
        // UI State
        activePortfolioIds,
        frequency, setFrequency,
        hideAmounts, setHideAmounts,
        chartHeight, setChartHeight,
        timeRange, setTimeRange,
        customRange, setCustomRange,
        setIsDatePickerOpen,
        isFilterOpen, setIsFilterOpen,
        ddThreshold,
        
        // Data
        metrics, portfolios,
        authStatus, user,
        t, triggerCloudBackup: retrySync
    } = useTradeContext();

    // Local UI State (Moved from App.tsx)
    const [stratView, setStratView] = React.useState<'list' | 'chart'>('list');

    return (
        <div className="flex flex-col h-full w-full">
            <DashboardHeader setIsShareModalOpen={setIsShareModalOpen} />

            {/* MAIN CONTENT AREA */}
            <div className="relative w-full bg-transparent flex-1 min-h-[57dvh]">
                <div className="px-4 py-5 pb-32 space-y-5 min-h-full">
                    <StatsContent 
                        stratView={stratView}
                        setStratView={setStratView}
                        detailStrategy={detailStrategy}
                        setDetailStrategy={setDetailStrategy}
                        setStratView={props.setStratView}
                        detailStrategy={props.detailStrategy}
                        setDetailStrategy={props.setDetailStrategy}
                    />
                </div>
            </div>
        </div>
    );
};
