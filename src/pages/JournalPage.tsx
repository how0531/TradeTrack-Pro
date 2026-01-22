
import React from 'react';
import { JournalTab } from '../components/tabs/JournalTab'; // Fixed import
import { DashboardHeader } from '../components/DashboardHeader';
import { useTradeContext } from '../context/TradeContext';

// Props reduced


// Reduced props
// interface JournalPageProps removed

export const JournalPage: React.FC<{
    setIsShareModalOpen: (b: boolean) => void;
    onDateClick: (d: string) => void;
}> = ({ setIsShareModalOpen, onDateClick }) => {
    const {
        activePortfolioIds, 
        currentMonth, setCurrentMonth,
        filteredTrades, 
        t
    } = useTradeContext();

    // Move monthlyStats calculation here (was in App.tsx)
    const monthlyStats = React.useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const tradesInMonth = filteredTrades.filter(t => { 
            if (!t.date) return false; 
            const [tY, tM] = t.date.split('-').map(Number); 
            return tY === year && (tM - 1) === month; 
        });
        const pnl = tradesInMonth.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
        const wins = tradesInMonth.filter(t => (Number(t.pnl) || 0) > 0).length;
        const count = tradesInMonth.length;
        const winRate = count > 0 ? (wins / count) * 100 : 0;
        return { pnl, count, winRate };
    }, [filteredTrades, currentMonth]);

    return (
        <div className="flex flex-col h-full w-full">
            <DashboardHeader setIsShareModalOpen={setIsShareModalOpen} />

            {/* MAIN CONTENT AREA */}
            <div className="relative w-full bg-transparent flex-1 min-h-[57dvh]">
                <div className="px-4 py-5 pb-32 space-y-5 min-h-full">
                    <JournalTab 
                        onDateClick={onDateClick}
                        monthlyStats={monthlyStats} // Computed local
                    />
                </div>
            </div>
        </div>
    );
};
