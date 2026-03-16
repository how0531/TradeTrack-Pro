import React from 'react';
import { CloudLightning, Cloud, Smartphone, GitMerge, Activity } from 'lucide-react';
import { I18N } from '../../constants';
import { Lang } from '../../types';

interface SyncConflictModalProps {
    isOpen: boolean;
    onResolve: (choice: 'cloud' | 'local' | 'merge') => void;
    lang: Lang;
    isSyncing: boolean;
    stats?: {
        localCount: number;
        cloudCount: number;
        duplicateCount: number;
    };
}

export const SyncConflictModal = ({ isOpen, onResolve, lang, isSyncing, stats }: SyncConflictModalProps) => {
    if (!isOpen) return null;
    const t = I18N[lang] || I18N['zh'];

    const statsText = stats
        ? t.syncStats
            .replace('{local}', String(stats.localCount))
            .replace('{cloud}', String(stats.cloudCount))
            .replace('{dup}', String(stats.duplicateCount))
        : null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-[#141619] rounded-2xl border border-[#C8B085]/30 shadow-2xl overflow-hidden relative">
                {/* Decorative Top Glow */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C8B085] to-transparent opacity-50"></div>
                
                <div className="p-6">
                    <div className="text-center mb-5">
                        <div className="w-12 h-12 rounded-full bg-[#C8B085]/10 flex items-center justify-center mx-auto mb-4 border border-[#C8B085]/20 shadow-[0_0_15px_rgba(200,176,133,0.2)]">
                            <CloudLightning className="text-[#C8B085]" size={24} />
                        </div>

                        <h3 className="text-white font-bold text-lg mb-2">{t.syncConflictTitle}</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            {t.syncConflictDesc}
                        </p>
                    </div>

                    {/* Stats Preview */}
                    {statsText && (
                        <div className="mb-5 p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                            <p className="text-[11px] font-mono text-zinc-400 tracking-wide">{statsText}</p>
                        </div>
                    )}

                    {/* 3 Choices */}
                    <div className="space-y-2.5">
                        {/* Smart Merge (Recommended) */}
                        <button 
                            onClick={() => onResolve('merge')}
                            disabled={isSyncing}
                            className="w-full px-4 py-3.5 rounded-xl bg-[#C8B085] text-black font-bold text-xs uppercase hover:bg-[#D9C298] hover:shadow-[0_0_20px_rgba(200,176,133,0.3)] transition-all disabled:opacity-50 flex items-center gap-3"
                        >
                            <div className="p-1.5 rounded-lg bg-black/10">
                                {isSyncing ? <Activity size={16} className="animate-spin" /> : <GitMerge size={16} />}
                            </div>
                            <span className="flex-1 text-left">{t.smartMergeOption}</span>
                        </button>

                        {/* Use Cloud */}
                        <button 
                            onClick={() => onResolve('cloud')}
                            disabled={isSyncing}
                            className="w-full px-4 py-3 rounded-xl bg-[#25282C] border border-white/5 text-slate-300 font-bold text-xs uppercase hover:bg-white/5 hover:text-white transition-all disabled:opacity-50 flex items-center gap-3"
                        >
                            <div className="p-1.5 rounded-lg bg-white/5">
                                <Cloud size={16} className="text-sky-400" />
                            </div>
                            <span className="flex-1 text-left">{t.useCloudOption}</span>
                        </button>

                        {/* Use Local */}
                        <button 
                            onClick={() => onResolve('local')}
                            disabled={isSyncing}
                            className="w-full px-4 py-3 rounded-xl bg-[#25282C] border border-white/5 text-slate-400 font-bold text-xs uppercase hover:bg-white/5 hover:text-white transition-all disabled:opacity-50 flex items-center gap-3"
                        >
                            <div className="p-1.5 rounded-lg bg-white/5">
                                <Smartphone size={16} className="text-zinc-400" />
                            </div>
                            <span className="flex-1 text-left">{t.useLocalOption}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};