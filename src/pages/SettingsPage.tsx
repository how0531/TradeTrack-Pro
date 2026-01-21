
import React from 'react';
import { SettingsView } from '../features/settings/SettingsView'; 
import { I18N } from '../constants';
import { useTradeContext } from '../context/TradeContext';

interface SettingsPageProps {
    onBack: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
    const { lang } = useTradeContext();
    const t = I18N[lang] || I18N['zh'];

    return (
        <div className="flex flex-col h-full w-full">
            <div className="px-5 pt-8 pb-4">
                <h1 className="text-3xl font-bold text-[#C8B085] tracking-tight">{t.settings}</h1>
                <p className="text-sm text-slate-500 mt-1">Customize your experience</p>
            </div>
            
            <div className="relative w-full bg-transparent flex-1">
                <div className="px-4 py-2 pb-32 space-y-5">
                    <SettingsView onBack={onBack} />
                </div>
            </div>
        </div>
    );
};
