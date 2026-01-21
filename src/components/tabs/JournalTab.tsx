// [Manage] Last Updated: 2024-05-22
import React from 'react';
import { Filter, BrainCircuit, Activity } from 'lucide-react';
import { MultiSelectDropdown } from '../selectors/MultiSelectDropdown';
import { CalendarView } from '../../features/calendar/CalendarView';
import { I18N } from '../../constants';
import { CalendarViewProps } from '../../types';

interface JournalTabProps extends CalendarViewProps {
    // Add extra props if CalendarViewProps doesn't cover everything needed for the container
}

export const JournalTab = ({
    dailyPnlMap, currentMonth, setCurrentMonth, onDateClick, monthlyStats, hideAmounts, lang,
    streaks, strategies, emotions, filterStrategy, setFilterStrategy, filterEmotion, setFilterEmotion
}: JournalTabProps) => {
    const t = I18N[lang] || I18N['zh'];

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-2 mb-2 relative z-40">
                <MultiSelectDropdown options={strategies} selected={filterStrategy} onChange={setFilterStrategy} icon={Activity} defaultLabel={t.allStrategies} lang={lang} />
                <MultiSelectDropdown options={emotions} selected={filterEmotion} onChange={setFilterEmotion} icon={BrainCircuit} defaultLabel={t.allEmotions} lang={lang} />
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
                strategies={strategies} 
                emotions={emotions} 
                filterStrategy={filterStrategy} 
                setFilterStrategy={setFilterStrategy} 
                filterEmotion={filterEmotion} 
                setFilterEmotion={setFilterEmotion} 
            />
        </div>
    );
};