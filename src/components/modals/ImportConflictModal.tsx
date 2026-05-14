import React from 'react';
import { Download, Layers, AlertCircle } from 'lucide-react';
import { I18N } from '../../constants';
import { Lang, Trade } from '../../types';

interface ImportConflictModalProps {
    isOpen: boolean;
    onResolve: (choice: 'merge' | 'overwrite') => void;
    lang: Lang;
    /** Conflicting trades — same id in both incoming file and existing data.
     *  Preview lets the user see what they'd actually overwrite or merge. */
    conflicts?: Array<{ incoming: Trade; existing: Trade }>;
    /** Total number of trades in the incoming file (for the summary line). */
    incomingTotal?: number;
}

const PREVIEW_LIMIT = 5;

export const ImportConflictModal = ({
    isOpen,
    onResolve,
    lang,
    conflicts = [],
    incomingTotal = 0,
}: ImportConflictModalProps) => {
    if (!isOpen) return null;
    const t = I18N[lang] || I18N['zh'];
    const previewed = conflicts.slice(0, PREVIEW_LIMIT);
    const overflow = Math.max(0, conflicts.length - PREVIEW_LIMIT);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-[#141619] rounded-2xl border border-[#C8B085]/30 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C8B085] to-transparent opacity-50"></div>

                <div className="p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#C8B085]/10 flex items-center justify-center mx-auto mb-4 border border-[#C8B085]/20 shadow-[0_0_15px_rgba(200,176,133,0.2)]">
                        <Download className="text-[#C8B085]" size={24} />
                    </div>

                    <h3 className="text-white font-bold text-lg mb-2">{t.importConflictTitle}</h3>
                    <p className="text-slate-400 text-xs leading-relaxed mb-4">
                        {t.importConflictDesc}
                    </p>

                    {(incomingTotal > 0 || conflicts.length > 0) && (
                        <div className="text-[10px] text-zinc-500 mb-3 font-mono tracking-wide">
                            {lang === 'zh'
                                ? `匯入 ${incomingTotal} 筆 · 衝突 ${conflicts.length} 筆`
                                : `Incoming ${incomingTotal} · ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}`}
                        </div>
                    )}

                    {previewed.length > 0 && (
                        <div className="mb-5 max-h-48 overflow-y-auto rounded-xl bg-black/30 border border-white/5 divide-y divide-white/5 text-left">
                            {previewed.map(({ incoming, existing }) => {
                                const changed = incoming.pnl !== existing.pnl;
                                return (
                                    <div key={incoming.id} className="px-3 py-2 flex items-center justify-between gap-3 text-[11px]">
                                        <div className="flex-1 min-w-0 truncate">
                                            <span className="text-slate-300 font-mono">{incoming.date}</span>
                                            <span className="text-slate-500 mx-1.5">·</span>
                                            <span className="text-slate-400 truncate">{incoming.code || incoming.strategy || '—'}</span>
                                        </div>
                                        <div className="text-right font-mono text-[10px] shrink-0">
                                            <span className="text-zinc-500 mr-1">{existing.pnl?.toLocaleString('en-US')}</span>
                                            <span className="text-zinc-600">→</span>
                                            <span className={`ml-1 font-bold ${changed ? 'text-[#C8B085]' : 'text-zinc-400'}`}>
                                                {incoming.pnl?.toLocaleString('en-US')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            {overflow > 0 && (
                                <div className="px-3 py-1.5 text-[10px] text-zinc-500 text-center">
                                    {lang === 'zh' ? `… 還有 ${overflow} 筆` : `… and ${overflow} more`}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={() => onResolve('overwrite')}
                            className="flex-1 px-4 py-3 rounded-xl bg-[#25282C] border border-white/5 text-slate-400 font-bold text-xs uppercase hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all flex items-center justify-center gap-2 group"
                        >
                            <AlertCircle size={14} className="group-hover:text-red-400" />
                            {t.overwriteOption}
                        </button>
                        <button
                            onClick={() => onResolve('merge')}
                            className="flex-1 px-4 py-3 rounded-xl bg-[#C8B085] text-black font-bold text-xs uppercase hover:bg-[#D9C298] hover:shadow-[0_0_20px_rgba(200,176,133,0.3)] transition-all flex justify-center items-center gap-2"
                        >
                            <Layers size={14} />
                            {t.mergeImportOption}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
