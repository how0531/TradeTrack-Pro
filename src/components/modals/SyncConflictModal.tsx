import React from 'react';
import { CloudLightning, ArrowUpCircle, Activity } from 'lucide-react';
import { I18N } from '../../constants';
import { Lang } from '../../types';

interface SyncConflictModalProps {
    isOpen: boolean;
    onResolve: (choice: 'merge' | 'discard') => void;
    lang: Lang;
    isSyncing: boolean;
}

export const SyncConflictModal = ({ isOpen, onResolve, lang, isSyncing }: SyncConflictModalProps) => {
    if (!isOpen) return null;
    const t = I18N[lang] || I18N['zh'];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-[#141619] rounded-2xl border border-[#C8B085]/30 shadow-2xl overflow-hidden relative">
                {/* Decorative Top Glow */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C8B085] to-transparent opacity-50"></div>
                
                <div className="p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#C8B085]/10 flex items-center justify-center mx-auto mb-4 border border-[#C8B085]/20 shadow-[0_0_15px_rgba(200,176,133,0.2)]">
                        <CloudLightning className="text-[#C8B085]" size={24} />
                    </div>

                    <h3 className="text-white font-bold text-lg mb-2">{t.syncConflictTitle}</h3>
                    <p className="text-slate-400 text-xs leading-relaxed mb-6">
                        {t.syncConflictDesc}
                    </p>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => onResolve('discard')}
                            disabled={isSyncing}
                            className="flex-1 px-4 py-3 rounded-xl bg-[#25282C] border border-white/5 text-slate-400 font-bold text-xs uppercase hover:bg-white/5 hover:text-white transition-all disabled:opacity-50"
                        >
                            {t.discardOption}
                        </button>
                        <button 
                            onClick={() => onResolve('merge')}
                            disabled={isSyncing}
                            className="flex-1 px-4 py-3 rounded-xl bg-[#C8B085] text-black font-bold text-xs uppercase hover:bg-[#D9C298] hover:shadow-[0_0_20px_rgba(200,176,133,0.3)] transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {isSyncing ? <Activity size={14} className="animate-spin" /> : <ArrowUpCircle size={14} />}
                            {t.mergeOption}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};