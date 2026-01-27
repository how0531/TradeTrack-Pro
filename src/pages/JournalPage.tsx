
import { JournalTab } from '../features/calendar/components/JournalTab'; // Fixed import
import { DashboardHeader } from '../features/dashboard/components/DashboardHeader';
import { Metrics, MonthlyStats, Streaks, Portfolio, Frequency, TimeRange, SyncStatus, User } from '../types';

interface JournalPageProps {
// ... props
    dailyPnlMap: Record<string, number>;
    currentMonth: Date;
    setCurrentMonth: (d: Date) => void;
    onDateClick: (d: string) => void;
    monthlyStats: MonthlyStats;
    hideAmounts: boolean;
    lang: 'zh' | 'en';
    streaks: Streaks;
    availableStrategies: string[];
    availableEmotions: string[];
    filterStrategy: string[];
    setFilterStrategy: (s: string[]) => void;
    filterEmotion: string[];
    setFilterEmotion: (e: string[]) => void;
    
    // Header Props
    metrics: Metrics;
    portfolios: Portfolio[];
    activePortfolioIds: string[];
    setActivePortfolioIds: (ids: string[]) => void;
    frequency: Frequency;
    setFrequency: (f: Frequency) => void;
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
    showFullEquity: boolean;
    setShowFullEquity: (b: boolean) => void;
    setIsShareModalOpen: (b: boolean) => void;
    syncStatus: SyncStatus;
    authStatus: string;
    user: User | null;
    t: any;
    retrySync: () => void;
    showPurePnl: boolean;
    setShowPurePnl: (b: boolean) => void;
}

export const JournalPage: React.FC<JournalPageProps> = (props) => {
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
                showPurePnl={props.showPurePnl}
                setShowPurePnl={props.setShowPurePnl}
                onZoom={(s, e) => {
                    props.setCustomRange({start: s, end: e});
                    props.setTimeRange('CUSTOM');
                }}
            />

            {/* MAIN CONTENT AREA */}
            <div className="relative w-full bg-transparent flex-1 min-h-[57dvh]">
                <div className="px-4 py-5 pb-32 space-y-5 min-h-full">
                    <JournalTab 
                        dailyPnlMap={props.dailyPnlMap}
                        currentMonth={props.currentMonth}
                        setCurrentMonth={props.setCurrentMonth}
                        onDateClick={props.onDateClick}
                        monthlyStats={props.monthlyStats}
                        hideAmounts={props.hideAmounts}
                        lang={props.lang}
                        streaks={props.streaks}
                        strategies={props.availableStrategies} // Changed prop name
                        emotions={props.availableEmotions}     // Changed prop name
                        filterStrategy={props.filterStrategy}
                        setFilterStrategy={props.setFilterStrategy}
                        filterEmotion={props.filterEmotion}
                        setFilterEmotion={props.setFilterEmotion}
                    />
                </div>
            </div>
        </div>
    );
};
