
// [Manage] Last Updated: 2024-05-22
import React from 'react';
import { X } from 'lucide-react';
import { TradeModalProps, Trade } from '../../types';
import { I18N } from '../../constants';
import { StrategyChipsInput, EmotionChipsInput, PortfolioChipsInput } from '../../components/form/ChipInputs';

export const TradeModal = ({ isOpen, onClose, form, setForm, onSubmit, isEditing, strategies, emotions, portfolios, lang }: TradeModalProps) => {
    if (!isOpen) return null;
    const t = I18N[lang] || I18N['zh'];
    const updateForm = (key: keyof Trade, value: any) => setForm({ ...form, [key]: value });
    
    // Default to first portfolio if not set
    if (!form.portfolioId && portfolios.length > 0) {
        updateForm('portfolioId', portfolios[0].id);
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="w-full sm:max-w-sm bg-black/60 backdrop-blur-xl rounded-t-2xl sm:rounded-2xl border-t sm:border border-white/10 shadow-2xl shadow-black/50 overflow-hidden flex flex-col max-h-[95vh]">
                <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h2 className="font-bold text-sm text-white">{isEditing ? t.editTrade : t.addTrade}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1"><X size={20}/></button>
                </div>
                <form onSubmit={onSubmit} className="p-4 space-y-4 overflow-y-auto flex-1 no-scrollbar pb-8">
                    
                    {/* GLASS CHIPS: PORTFOLIO SELECTOR */}
                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500 mb-1.5 ml-1 block">{t.portfolio}</label>
                        <PortfolioChipsInput portfolios={portfolios} value={form.portfolioId || (portfolios[0]?.id || '')} onChange={(val: string) => updateForm('portfolioId', val)} />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 ml-1 block">Date</label>
                        <input type="date" required value={form.date} onChange={e => updateForm('date', e.target.value)} className="w-full h-[40px] px-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white font-barlow-numeric outline-none focus:border-white/20 focus:bg-white/10 transition-colors backdrop-blur-sm" />
                    </div>

                    <div className="flex gap-2 items-center bg-white/5 p-1 rounded-xl border border-white/5">
                         <div className="flex bg-black/20 p-0.5 rounded-lg h-[40px] flex-shrink-0">
                            {/* GLASS BUTTONS: PROFIT / LOSS */}
                            <button type="button" onClick={() => updateForm('type', 'profit')} className={`px-4 rounded-md text-[10px] font-bold uppercase transition-all ${form.type === 'profit' ? 'bg-[#D05A5A]/20 text-[#D05A5A] shadow-[0_0_10px_rgba(208,90,90,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}>{t.profit}</button>
                            <button type="button" onClick={() => updateForm('type', 'loss')} className={`px-4 rounded-md text-[10px] font-bold uppercase transition-all ${form.type === 'loss' ? 'bg-[#5B9A8B]/20 text-[#5B9A8B] shadow-[0_0_10px_rgba(91,154,139,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}>{t.loss}</button>
                        </div>
                        <input type="number" step="0.1" inputMode="decimal" required value={form.amount} onChange={e => updateForm('amount', e.target.value)} className="w-full h-[40px] px-2 text-2xl font-barlow-numeric font-bold bg-transparent border-none text-white placeholder-slate-600 outline-none text-right" placeholder="0.0" autoFocus />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">{t.strategyList}</label>
                        <StrategyChipsInput strategies={strategies} value={form.strategy || ''} onChange={(val: string) => updateForm('strategy', val)} lang={lang} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">{t.mindsetList}</label>
                        <EmotionChipsInput emotions={emotions} value={form.emotion || ''} onChange={(val: string) => updateForm('emotion', val)} lang={lang} />
                    </div>
                    <textarea 
                        rows={3} 
                        value={form.note || ''} 
                        onChange={e => updateForm('note', e.target.value)} 
                        className="w-full p-3 rounded-xl text-xs bg-white/5 border border-white/10 text-slate-300 placeholder-slate-600 outline-none focus:border-white/20 focus:bg-white/10 resize-y min-h-[60px] leading-relaxed backdrop-blur-sm" 
                        placeholder={t.notePlaceholder} 
                    />
                    
                    {/* GLASS BUTTON: SUBMIT */}
                    <button type="submit" className={`w-full py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg transition-all active:scale-[0.98] backdrop-blur-md border ${form.type === 'profit' ? 'bg-[#D05A5A]/20 text-[#D05A5A] border-[#D05A5A]/50 shadow-[0_0_20px_rgba(208,90,90,0.15)] hover:bg-[#D05A5A]/30' : 'bg-[#5B9A8B]/20 text-[#5B9A8B] border-[#5B9A8B]/50 shadow-[0_0_20px_rgba(91,154,139,0.15)] hover:bg-[#5B9A8B]/30'}`}>
                        {isEditing ? t.update : t.save}
                    </button>
                </form>
            </div>
        </div>
    );
};
