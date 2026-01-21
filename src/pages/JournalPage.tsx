
import { JournalTab } from '../components/tabs/JournalTab'; // Fixed import
import { DashboardHeader } from '../components/DashboardHeader';
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
}

export const JournalPage: React.FC<JournalPageProps> = (props) => {
    return (
        <div className="flex flex-col h-full w-full">
            <DashboardHeader setIsShareModalOpen={props.setIsShareModalOpen} />

            {/* MAIN CONTENT AREA */}
            <div className="relative w-full bg-transparent flex-1 min-h-[57dvh]">
                <div className="px-4 py-5 pb-32 space-y-5 min-h-full">
                    <JournalTab 
                        onDateClick={props.onDateClick}
                    />
                </div>
            </div>
        </div>
    );
};
