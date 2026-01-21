
import React from 'react';
import { SettingsView } from '../features/settings/SettingsView'; // Fixed import
import { Trade, Lang, Portfolio, User } from '../types';
import { I18N } from '../constants';

interface SettingsPageProps {
    lang: Lang;
    setLang: (l: Lang) => void;
    trades: Trade[];
    actions: any;
    ddThreshold: number;
    setDdThreshold: (v: number) => void;
    maxLossStreak: number;
    setMaxLossStreak: (v: number) => void;
    lossColor: string;
    setLossColor: (c: string) => void;
    strategies: string[];
    emotions: string[];
    portfolios: Portfolio[];
    activePortfolioIds: string[];
    setActivePortfolioIds: (ids: string[]) => void;
    onBack: () => void;
    user: User | null;
    login: () => void;
    logout: () => void;
    lastBackupTime?: Date | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = (props) => {
    const t = I18N[props.lang] || I18N['zh'];

    return (
        <div className="flex flex-col h-full w-full">
            <div className="px-5 pt-8 pb-4">
                <h1 className="text-3xl font-bold text-[#C8B085] tracking-tight">{t.settings}</h1>
                <p className="text-sm text-slate-500 mt-1">Customize your experience</p>
            </div>
            
            <div className="relative w-full bg-transparent flex-1">
                <div className="px-4 py-2 pb-32 space-y-5">
                    <SettingsView 
                        {...props}
                        onLogin={props.login}
                        onLogout={props.logout}
                        currentUser={props.user}
                    />
                </div>
            </div>
        </div>
    );
};
