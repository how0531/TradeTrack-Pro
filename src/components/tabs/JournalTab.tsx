
import React, { useMemo } from 'react';
import { Filter, BrainCircuit, Activity } from 'lucide-react';
import { MultiSelectDropdown } from '../selectors/MultiSelectDropdown';
import { CalendarView } from '../../features/calendar/CalendarView';
import { I18N } from '../../constants';
import { useTradeContext } from '../../context/TradeContext';

interface JournalTabProps {
    onDateClick: (d: string) => void;
}

export const JournalTab = ({ onDateClick }: JournalTabProps) => {
    const { 
        dailyPnlMap, currentMonth, setCurrentMonth, lang, hideAmounts, streaks, 
        availableStrategies, availableEmotions, filterStrategy, setFilterStrategy, 
        filterEmotion, setFilterEmotion, filteredTrades
    } = useTradeContext();
    
    const t = I18N[lang] || I18N['zh'];

    const monthlyStats = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const tradesInMonth = filteredTrades.filter(t => { if (!t.date) return false; const [tY, tM] = t.date.split('-').map(Number); return tY === year && (tM - 1) === month; });
        const pnl = tradesInMonth.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
        const wins = tradesInMonth.filter(t => (Number(t.pnl) || 0) > 0).length;
        const count = tradesInMonth.length;
        const winRate = count > 0 ? (wins / count) * 100 : 0;
        return { pnl, count, winRate };
    }, [filteredTrades, currentMonth]);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-2 mb-2 relative z-40">
                <MultiSelectDropdown options={availableStrategies} selected={filterStrategy} onChange={setFilterStrategy} icon={Activity} defaultLabel={t.allStrategies} lang={lang} />
                <MultiSelectDropdown options={availableEmotions} selected={filterEmotion} onChange={setFilterEmotion} icon={BrainCircuit} defaultLabel={t.allEmotions} lang={lang} />
            </div>
            <CalendarView 
                dailyPnlMap={dailyPnlMap} 
                currentMonth={currentMonth} 
                setCurrentMonth={setCurrentMonth} 
                onDateClick={onDateClick} 
                monthlyStats={monthlyStats} 
                hideAmounts={hideAmounts} 
                lang={lang} 
                streaks={streaks} 
                strategies={availableStrategies} 
                emotions={availableEmotions} 
                filterStrategy={filterStrategy} 
                setFilterStrategy={setFilterStrategy} 
                filterEmotion={filterEmotion} 
                setFilterEmotion={setFilterEmotion} 
            />
        </div>
    );
};
