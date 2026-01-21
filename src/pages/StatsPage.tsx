
import React from 'react';
import { StatsContent } from '../components/tabs/StatsTab';
import { DashboardHeader } from '../components/DashboardHeader';
import { Metrics, Portfolio, Frequency, TimeRange, SyncStatus, User } from '../types';

interface StatsPageProps {
    metrics: Metrics;
    portfolios: Portfolio[];
    activePortfolioIds: string[];
    setActivePortfolioIds: (ids: string[]) => void;
    frequency: Frequency;
    setFrequency: (f: Frequency) => void;
    lang: 'zh' | 'en';
    hideAmounts: boolean;
    setHideAmounts: (b: boolean) => void;
    chartHeight: number;
    setChartHeight: (h: number) => void;
    timeRange: TimeRange;
    setTimeRange: (t: TimeRange) => void;
    customRange: { start: string | null, end: string | null };
    setCustomRange: (r: { start: string | null, end: string | null }) => void;
    setIsDatePickerOpen: (b: boolean) => void;
    setIsFilterOpen: (b: boolean) => void;
    isFilterOpen: boolean;
    hasActiveFilters: boolean;
    availableStrategies: string[];
    availableEmotions: string[];
    filterStrategy: string[];
    setFilterStrategy: (s: string[]) => void;
    filterEmotion: string[];
    setFilterEmotion: (e: string[]) => void;
    stratView: 'list' | 'chart';
    setStratView: (v: 'list' | 'chart') => void;
    detailStrategy: string | null;
    setDetailStrategy: (s: string | null) => void;
    ddThreshold: number;
    showFullEquity: boolean;
    setShowFullEquity: (b: boolean) => void;
    setIsShareModalOpen: (b: boolean) => void;
    syncStatus: SyncStatus;
    authStatus: string;
    user: User | null;
    t: any;
    retrySync: () => void;
}

export const StatsPage: React.FC<StatsPageProps> = (props) => {
    return (
        <div className="flex flex-col h-full w-full">
            <DashboardHeader 
                metrics={props.metrics}
                portfolios={props.portfolios}
                activePortfolioIds={props.activePortfolioIds}
                setActivePortfolioIds={props.setActivePortfolioIds}
                frequency={props.frequency}
                setFrequency={props.setFrequency}
                lang={props.lang}
                hideAmounts={props.hideAmounts}
                setHideAmounts={props.setHideAmounts}
                chartHeight={props.chartHeight}
                setChartHeight={props.setChartHeight}
                timeRange={props.timeRange}
                setTimeRange={props.setTimeRange}
                customRange={props.customRange}
                setCustomRange={props.setCustomRange}
                setIsDatePickerOpen={props.setIsDatePickerOpen}
                setIsFilterOpen={props.setIsFilterOpen}
                isFilterOpen={props.isFilterOpen}
                hasActiveFilters={props.hasActiveFilters}
                availableStrategies={props.availableStrategies}
                availableEmotions={props.availableEmotions}
                filterStrategy={props.filterStrategy}
                setFilterStrategy={props.setFilterStrategy}
                filterEmotion={props.filterEmotion}
                setFilterEmotion={props.setFilterEmotion}
                showFullEquity={props.showFullEquity}
                setShowFullEquity={props.setShowFullEquity}
                setIsShareModalOpen={props.setIsShareModalOpen}
                syncStatus={props.syncStatus}
                authStatus={props.authStatus}
                user={props.user}
                t={props.t}
                retrySync={props.retrySync}
            />

            {/* MAIN CONTENT AREA */}
            <div className="relative w-full bg-transparent flex-1 min-h-[57dvh]">
                <div className="px-4 py-5 pb-32 space-y-5 min-h-full">
                    <StatsContent 
                        metrics={props.metrics} 
                        lang={props.lang} 
                        hideAmounts={props.hideAmounts}
                        stratView={props.stratView}
                        setStratView={props.setStratView}
                        detailStrategy={props.detailStrategy}
                        setDetailStrategy={props.setDetailStrategy}
                        hasActiveFilters={props.hasActiveFilters}
                        setFilterStrategy={props.setFilterStrategy}
                        setFilterEmotion={props.setFilterEmotion}
                        ddThreshold={props.ddThreshold}
                    />
                </div>
            </div>
        </div>
    );
};
