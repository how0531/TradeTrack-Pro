
import React from 'react';
import { LogsTab } from '../features/history/components/LogsTab';
import { Trade, Lang, Portfolio } from '../types';
import { I18N } from '../constants';

interface LogsPageProps {
    trades: Trade[];
    lang: Lang;
    hideAmounts: boolean;
    portfolios: Portfolio[];
    onEdit: (t: Trade) => void;
    onDelete: (id: string) => void;
    availableStrategies: string[];
    availableEmotions: string[];
    filterStrategy: string[];
    setFilterStrategy: (s: string[]) => void;
    filterEmotion: string[];
    setFilterEmotion: (e: string[]) => void;
}

export const LogsPage: React.FC<LogsPageProps> = ({ 
    trades, lang, hideAmounts, portfolios, onEdit, onDelete,
    availableStrategies, availableEmotions, filterStrategy, setFilterStrategy, filterEmotion, setFilterEmotion
}) => {
    const t = I18N[lang] || I18N['zh'];

    return (
        <div className="flex flex-col h-full w-full">
            <div className="px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-4">
                <h1 className="text-3xl font-bold text-[#C8B085] tracking-tight">{t.logs}</h1>
                <p className="text-sm text-slate-500 mt-1">Review your trading history</p>
            </div>
            
            <div className="relative w-full bg-transparent flex-1">
                <div className="px-4 py-2 pb-32 space-y-5">
                    <LogsTab 
                         trades={trades}
                         lang={lang}
                         hideAmounts={hideAmounts}
                         portfolios={portfolios}
                         onEdit={onEdit}
                         onDelete={onDelete}
                         strategies={availableStrategies} // Fixed
                         emotions={availableEmotions}     // Fixed
                         filterStrategy={filterStrategy}
                         setFilterStrategy={setFilterStrategy}
                         filterEmotion={filterEmotion}
                         setFilterEmotion={setFilterEmotion}
                    />
                </div>
            </div>
        </div>
    );
};
