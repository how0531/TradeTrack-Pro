
import React from 'react';
import { CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { SyncStatus, User, Lang } from '../types';
import { I18N, THEME } from '../constants';

interface Props {
    authStatus: string;
    user: User | null;
    syncStatus: SyncStatus;
    retrySync: () => void;
    lang: Lang;
}

export const SyncIndicator = ({ authStatus, user, syncStatus, retrySync, lang }: Props) => {
    const t = I18N[lang] || I18N['zh'];
    const isOnline = authStatus === 'online' && user && !user.isAnonymous;

    if (!isOnline) {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/5">
                <CloudOff size={10} className="text-slate-500" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{t.offline}</span>
            </div>
        );
    }
    if (syncStatus === 'saving') {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/5">
                <RefreshCw size={10} className="text-gold animate-spin" />
                <span className="text-[9px] font-bold text-gold uppercase tracking-tighter">{t.saving}</span>
            </div>
        );
    }
    if (syncStatus === 'error') {
         return (
            <button onClick={retrySync} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors">
                <AlertCircle size={10} className="text-red-400" />
                <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">{t.syncError}</span>
            </button>
        );
    }
    return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/5 transition-all duration-500">
            <Check size={10} className="text-[#5B9A8B]" />
            <span className="text-[9px] font-bold text-[#5B9A8B] uppercase tracking-tighter">{t.saved}</span>
        </div>
    );
};
