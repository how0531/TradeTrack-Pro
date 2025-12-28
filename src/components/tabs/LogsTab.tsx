// [Manage] Last Updated: 2024-05-22
import React from 'react';
import { Filter, BrainCircuit, Activity } from 'lucide-react';
import { MultiSelectDropdown } from '../selectors/MultiSelectDropdown';
import { LogsView } from '../../features/logs/LogsView';
import { I18N } from '../../constants';
import { LogsViewProps } from '../../types';

interface LogsTabProps extends LogsViewProps {
    strategies: string[];
    emotions: string[];
    filterStrategy: string[];
    setFilterStrategy: (s: string[]) => void;
    filterEmotion: string[];
    setFilterEmotion: (e: string[]) => void;
}

export const LogsTab = ({
    trades, lang, hideAmounts, portfolios, onEdit, onDelete,
    strategies, emotions, filterStrategy, setFilterStrategy, filterEmotion, setFilterEmotion
}: LogsTabProps) => {
    const t = I18N[lang] || I18N['zh'];

    return (
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-2 mb-2 relative z-40">
                <MultiSelectDropdown options={strategies} selected={filterStrategy} onChange={setFilterStrategy} icon={Activity} defaultLabel={t.allStrategies} lang={lang} />
                <MultiSelectDropdown options={emotions} selected={filterEmotion} onChange={setFilterEmotion} icon={BrainCircuit} defaultLabel={t.allEmotions} lang={lang} />
            </div>
            <LogsView 
                trades={trades} 
                lang={lang} 
                hideAmounts={hideAmounts} 
                portfolios={portfolios} 
                onEdit={onEdit} 
                onDelete={onDelete} 
            />
        </div>
    );
};