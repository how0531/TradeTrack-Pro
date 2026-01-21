
import React from 'react';
import { Activity, BrainCircuit } from 'lucide-react';
import { MultiSelectDropdown } from '../selectors/MultiSelectDropdown';
import { LogsView } from '../../features/history/LogsView'; 
import { I18N } from '../../constants';
import { Trade } from '../../types';
import { useTradeContext } from '../../context/TradeContext';

interface LogsTabProps {
    onEdit: (t: Trade) => void;
    onDelete: (id: string) => void;
}

export const LogsTab = ({ onEdit, onDelete }: LogsTabProps) => {
    const { 
        filteredTrades, lang, hideAmounts, portfolios, 
        availableStrategies, availableEmotions, filterStrategy, setFilterStrategy, 
        filterEmotion, setFilterEmotion 
    } = useTradeContext();
    
    const t = I18N[lang] || I18N['zh'];

    return (
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-2 mb-2 relative z-40">
                <MultiSelectDropdown options={availableStrategies} selected={filterStrategy} onChange={setFilterStrategy} icon={Activity} defaultLabel={t.allStrategies} lang={lang} />
                <MultiSelectDropdown options={availableEmotions} selected={filterEmotion} onChange={setFilterEmotion} icon={BrainCircuit} defaultLabel={t.allEmotions} lang={lang} />
            </div>
            <LogsView 
                trades={filteredTrades} 
                lang={lang} 
                hideAmounts={hideAmounts} 
                portfolios={portfolios} 
                onEdit={onEdit} 
                onDelete={onDelete} 
            />
        </div>
    );
};

