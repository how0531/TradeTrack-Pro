
import React from 'react';
import { LogsTab } from '../components/tabs/LogsTab';
import { Trade } from '../types';
import { I18N } from '../constants';
import { useTradeContext } from '../context/TradeContext';

interface LogsPageProps {
    onEdit: (t: Trade) => void;
    onDelete: (id: string) => void;
}

export const LogsPage: React.FC<LogsPageProps> = ({ onEdit, onDelete }) => {
    const { lang } = useTradeContext();
    const t = I18N[lang] || I18N['zh'];

    return (
        <div className="flex flex-col h-full w-full">
            <div className="px-5 pt-8 pb-4">
                <h1 className="text-3xl font-bold text-[#C8B085] tracking-tight">{t.logs}</h1>
                <p className="text-sm text-slate-500 mt-1">Review your trading history</p>
            </div>
            
            <div className="relative w-full bg-transparent flex-1">
                <div className="px-4 py-2 pb-32 space-y-5">
                    <LogsTab 
                         onEdit={onEdit}
                         onDelete={onDelete}
                    />
                </div>
            </div>
        </div>
    );
};
