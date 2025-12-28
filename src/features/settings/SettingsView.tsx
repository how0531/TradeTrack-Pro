// [Manage] Last Updated: 2024-05-22
import React, { useState, useRef } from 'react';
import { Cloud, UserCircle, Check, LogOut, Shield, Settings as SettingsIcon, Languages, Palette, HardDrive, Download, Upload, AlertOctagon, Target, Info, Layers, Plus as PlusIcon, X, Briefcase, Trash2, Pencil } from 'lucide-react';
import { SettingsViewProps, Portfolio, Lang } from '../../types';
import { THEME, I18N, DEFAULT_PALETTE } from '../../constants';
import { useClickOutside } from '../../hooks/useClickOutside';
import { ImportConflictModal } from '../../components/modals/ImportConflictModal';

// --- INTERNAL COMPONENT: GlassCard (UPDATED TRANSPARENCY) ---
const GlassCard = ({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => {
    return (
        <div 
            onClick={onClick}
            className={`
                bg-[#1A1C20]/40 backdrop-blur-xl 
                border border-white/5 
                shadow-[0_8px_32px_rgba(0,0,0,0.3)]
                rounded-xl
                ${className}
            `}
        >
            {children}
        </div>
    );
};

// --- INTERNAL COMPONENT: Gemstone Light (Enhanced with Native Picker) ---
const GemstoneLight = ({ color, onChange, label, align = 'left' }: { color: string, onChange: (c: string) => void, label?: string, align?: 'left' | 'right' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useClickOutside(containerRef, () => setIsOpen(false));

    return (
        <div className="flex flex-col items-center gap-1.5 relative" ref={containerRef}>
            {label && <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{label}</span>}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-5 h-5 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 relative group"
                style={{
                    backgroundColor: color,
                    boxShadow: `0 0 10px ${color}66, inset 0 2px 4px rgba(255,255,255,0.3)`
                }}
            >
                <div className="absolute inset-0 rounded-full border border-white/10"></div>
            </button>

            {isOpen && (
                <div className={`absolute top-full mt-2 p-2 bg-[#0A0A0A] border border-zinc-800 rounded-xl shadow-2xl z-[100] flex gap-2 animate-in fade-in zoom-in-95 duration-200 flex-wrap w-[180px] justify-center ${align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                    {DEFAULT_PALETTE.map(c => (
                        <button
                            key={c}
                            onClick={() => { onChange(c); setIsOpen(false); }}
                            className={`w-5 h-5 rounded-full transition-all hover:scale-125 border border-white/5 ${color === c ? 'ring-1 ring-white' : ''}`}
                            style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}44` }}
                        />
                    ))}
                    {/* Native Picker Integration */}
                    <div className="relative w-5 h-5 rounded-full overflow-hidden transition-all hover:scale-125 border border-white/5 group cursor-pointer" title="Custom Color">
                         <input 
                            type="color" 
                            value={color}
                            onChange={(e) => { onChange(e.target.value); setIsOpen(false); }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full p-0 border-0 z-10"
                         />
                         {/* Rainbow Gradient Circle */}
                         <div className="w-full h-full bg-[conic-gradient(at_center,_red,_orange,_yellow,_green,_blue,_indigo,_violet)] opacity-70 group-hover:opacity-100" />
                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <PlusIcon size={10} className="text-white drop-shadow-md stroke-[3]" />
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- INTERNAL COMPONENT: Account Row ---
const AccountRow = ({ 
    portfolio, 
    actions, 
    isDeletable, 
    globalLossColor 
}: { 
    portfolio: Portfolio, 
    actions: any, 
    isDeletable: boolean, 
    globalLossColor: string 
}) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(portfolio.name);
    const [tempCapital, setTempCapital] = useState(String(portfolio.initialCapital));

    const handleSaveName = () => {
        if (tempName.trim()) {
            actions.updatePortfolio(portfolio.id, 'name', tempName.trim());
        } else {
            setTempName(portfolio.name);
        }
        setIsEditingName(false);
    };

    const handleSaveCapital = (val: string) => {
        setTempCapital(val);
        const num = parseFloat(val);
        if (!isNaN(num)) {
            actions.updatePortfolio(portfolio.id, 'initialCapital', num);
        }
    };

    return (
        <div className="group flex items-center justify-between h-20 px-4 border-b border-zinc-900/50 hover:bg-zinc-900/20 transition-colors relative">
            <div className="flex flex-col justify-center min-w-0 flex-1 pr-6">
                <div className="flex items-center gap-2 mb-1">
                    {isEditingName ? (
                        <input
                            autoFocus
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onBlur={handleSaveName}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                            className="bg-transparent border-b border-zinc-500 text-lg font-bold text-white outline-none w-full max-w-[200px] p-0"
                        />
                    ) : (
                        <h3 
                            onClick={() => setIsEditingName(true)}
                            className="text-lg font-bold text-zinc-200 cursor-pointer truncate flex items-center gap-2 hover:text-white transition-colors"
                        >
                            {portfolio.name}
                            <Pencil size={10} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h3>
                    )}
                </div>
                {/* REMOVED THE HARDCODED $ SYMBOL HERE */}
                <div className="flex items-center gap-2 text-sm font-mono text-zinc-500">
                    <input
                        type="number"
                        value={tempCapital}
                        onChange={(e) => handleSaveCapital(e.target.value)}
                        className="bg-transparent outline-none w-32 hover:text-zinc-300 focus:text-zinc-200 transition-colors"
                    />
                </div>
            </div>

            <div className="flex items-center gap-6">
                <GemstoneLight 
                    label="WIN" 
                    color={portfolio.profitColor} 
                    onChange={(c) => actions.updatePortfolio(portfolio.id, 'profitColor', c)} 
                />
                <div className="w-px h-8 bg-zinc-900 mx-1"></div>
                <GemstoneLight 
                    label="LOSS" 
                    color={portfolio.lossColor || globalLossColor} 
                    onChange={(c) => actions.updatePortfolio(portfolio.id, 'lossColor', c)} 
                    align="right"
                />
                {isDeletable && (
                    <button 
                        onClick={(e) => {
                            e.preventDefault();
                            if(window.confirm('Delete this account?')) {
                                const id = portfolio.id;
                                actions.updateSettings('portfolios', (prev: any[]) => prev.filter(p => p.id !== id));
                            }
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-700 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 ml-2"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

// --- INTERNAL COMPONENT: Account Manager ---
export const AccountManager = ({ 
    portfolios, 
    actions, 
    t, 
    globalLossColor 
}: { 
    portfolios: Portfolio[], 
    actions: any, 
    t: any, 
    globalLossColor: string 
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCapital, setNewCapital] = useState('');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName.trim() && newCapital.trim()) {
            const newP: Portfolio = {
                id: `p-${Date.now()}`,
                name: newName.trim(),
                initialCapital: parseFloat(newCapital),
                profitColor: DEFAULT_PALETTE[Math.floor(Math.random() * DEFAULT_PALETTE.length)],
                lossColor: globalLossColor // USE GLOBAL PREFERENCE AS DEFAULT
            };
            actions.updateSettings('portfolios', [...portfolios, newP]);
            setNewName('');
            setNewCapital('');
            setIsAdding(false);
        }
    };

    return (
        <GlassCard className="bg-[#050505]/60 border-zinc-800/60">
            <div className="px-5 py-3 border-b border-zinc-900 bg-[#080808]/40 flex justify-between items-center rounded-t-xl">
                <div className="flex items-center gap-2 text-zinc-500">
                    <Briefcase size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{t.managePortfolios}</span>
                </div>
                <div className="text-[10px] text-zinc-700 font-mono">
                    {portfolios.length} ACTIVE
                </div>
            </div>

            <div className="flex flex-col">
                {portfolios.map(p => (
                    <AccountRow 
                        key={p.id} 
                        portfolio={p} 
                        actions={actions}
                        isDeletable={portfolios.length > 1}
                        globalLossColor={globalLossColor}
                    />
                ))}
            </div>

            <div className="p-4 bg-[#050505]/40 rounded-b-xl">
                {isAdding ? (
                    <form onSubmit={handleAdd} className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex gap-3">
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="Account Name" 
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="flex-1 bg-zinc-900/30 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition-colors"
                            />
                            <input 
                                type="number" 
                                placeholder="Capital" 
                                value={newCapital}
                                onChange={e => setNewCapital(e.target.value)}
                                className="w-32 bg-zinc-900/30 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono transition-colors"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" disabled={!newName || !newCapital} className="flex-1 bg-zinc-100 hover:bg-white text-black py-2 rounded-lg text-xs font-bold uppercase disabled:opacity-50 transition-colors">Confirm</button>
                            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-zinc-500 hover:text-zinc-300 text-xs font-bold uppercase transition-colors">Cancel</button>
                        </div>
                    </form>
                ) : (
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="w-full py-3 rounded-xl border border-dashed border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/10 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide group"
                    >
                        <PlusIcon size={14} className="group-hover:scale-110 transition-transform"/> {t.addPortfolio}
                    </button>
                )}
            </div>
        </GlassCard>
    );
};

// --- MAIN SETTINGS VIEW ---
export const SettingsView = ({
    lang, setLang, trades, actions,
    ddThreshold, setDdThreshold,
    maxLossStreak, setMaxLossStreak,
    lossColor, setLossColor,
    strategies, emotions,
    portfolios, activePortfolioIds, setActivePortfolioIds,
    onBack, currentUser, onLogin, onLogout,
    lastBackupTime,
    isImportModalOpen = false
}: SettingsViewProps) => {
    
    const t = I18N[lang] || I18N['zh'];
    const [newStrat, setNewStrat] = useState('');
    const [newEmo, setNewEmo] = useState('');
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showStrategyTip, setShowStrategyTip] = useState(false); 
    const [showMindsetTip, setShowMindsetTip] = useState(false);
    const jsonInputRef = useRef<HTMLInputElement>(null);
    
    const handleAddStrategy = (e: React.FormEvent) => {
        e.preventDefault();
        if(newStrat.trim()) { actions.addStrategy(newStrat.trim()); setNewStrat(''); }
    };

    const handleAddEmotion = (e: React.FormEvent) => {
        e.preventDefault();
        if(newEmo.trim()) { actions.addEmotion(newEmo.trim()); setNewEmo(''); }
    };

    const ddPercent = ((ddThreshold - 5) / (50 - 5)) * 100;
    const streakPercent = ((maxLossStreak - 2) / (10 - 2)) * 100;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32 pt-4">
            {/* CLOUD SYNC */}
            <div className="space-y-2">
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2"><Cloud size={12}/> {t.syncTitle}</h3>
                 <div className={`p-6 rounded-2xl relative overflow-hidden border transition-all duration-500 ${currentUser ? 'bg-white/5 border-white/10 backdrop-blur-xl' : 'bg-transparent border-white/5'}`}>
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none transform translate-x-1/3 -translate-y-1/3">
                        <UserCircle size={200} />
                    </div>
                    {currentUser ? (
                        <div className="relative z-10 flex flex-col gap-6">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    {currentUser.photoURL ? (
                                        <img src={currentUser.photoURL} alt="User" className="w-16 h-16 rounded-full border-2 border-white/10 shadow-lg" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center border border-white/10"><UserCircle size={32} className="text-slate-400"/></div>
                                    )}
                                    <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#5B9A8B] border-2 border-[#1C1E22] shadow-sm flex items-center justify-center">
                                        <Check size={8} className="text-[#1C1E22] stroke-[4]" />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white tracking-tight">{currentUser.displayName || 'Anonymous Trader'}</h2>
                                    <p className="text-xs text-slate-500 font-mono mt-0.5">{currentUser.email}</p>
                                    
                                    {/* STATUS INDICATOR */}
                                    <div className="flex flex-col gap-1 mt-2">
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#5B9A8B]/10 border border-[#5B9A8B]/20 self-start">
                                            <Cloud size={10} className="text-[#5B9A8B]"/>
                                            <span className="text-[10px] font-bold text-[#5B9A8B] uppercase tracking-wider">{t.synced}</span>
                                        </div>
                                        {lastBackupTime && (
                                            <span className="text-[9px] text-slate-600 pl-1 font-mono">
                                                {t.lastBackup}: {lastBackupTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setShowLogoutConfirm(true)} className="w-full py-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2">
                                <LogOut size={14} /> {t.logout}
                            </button>
                        </div>
                    ) : (
                        <div className="relative z-10 text-center py-4 space-y-5">
                            <div className="w-16 h-16 mx-auto rounded-full bg-[#C8B085]/10 flex items-center justify-center border border-[#C8B085]/20 shadow-[0_0_20px_rgba(200,176,133,0.1)]"><Cloud size={32} className="text-[#C8B085]"/></div>
                            <div>
                                <h3 className="text-sm font-bold text-white mb-2">{t.syncTitle}</h3>
                                <p className="text-xs text-slate-400 leading-relaxed px-4">{t.syncDesc}</p>
                            </div>
                            <button onClick={onLogin} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#C8B085] to-[#A08C65] text-black font-bold uppercase tracking-widest text-xs shadow-lg shadow-[#C8B085]/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                                <UserCircle size={16} /> {t.loginWithGoogle}
                            </button>
                        </div>
                    )}
                 </div>
            </div>

            {/* RISK MANAGEMENT */}
            <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2"><Shield size={12}/> {t.riskSettings}</h3>
                <div className="p-4 rounded-xl border border-white/5 space-y-6">
                    <div className="space-y-2">
                         <div className="flex justify-between text-xs items-center">
                             <span className="text-slate-300 font-bold">{t.ddThreshold}</span>
                             <span className="px-2 py-0.5 rounded bg-[#2C5F54]/30 text-[#5B9A8B] font-bold font-barlow-numeric border border-[#2C5F54]/50">{ddThreshold}%</span>
                         </div>
                         <div className="relative flex items-center h-4">
                             <input type="range" min="5" max="50" step="1" value={ddThreshold} onChange={(e) => setDdThreshold(Number(e.target.value))} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer" style={{background: `linear-gradient(to right, ${THEME.GREEN_DARK} 0%, ${THEME.GREEN} ${ddPercent}%, rgba(255,255,255,0.1) ${ddPercent}%, rgba(255,255,255,0.1) 100%)`}} />
                         </div>
                         <p className="text-[10px] text-slate-500 leading-relaxed">{t.risk_dd_desc}</p>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div className="space-y-2">
                         <div className="flex justify-between text-xs items-center">
                             <span className="text-slate-300 font-bold">{t.maxLossStreak}</span>
                             <span className="px-2 py-0.5 rounded bg-[#C8B085]/10 text-[#C8B085] font-bold font-barlow-numeric border border-[#C8B085]/30">{maxLossStreak} Trades</span>
                         </div>
                         <div className="relative flex items-center h-4">
                            <input type="range" min="2" max="10" step="1" value={maxLossStreak} onChange={(e) => setMaxLossStreak(Number(e.target.value))} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer" style={{background: `linear-gradient(to right, #A08C65 0%, #C8B085 ${streakPercent}%, rgba(255,255,255,0.1) ${streakPercent}%, rgba(255,255,255,0.1) 100%)`}} />
                         </div>
                         <p className="text-[10px] text-slate-500 leading-relaxed">{t.risk_streak_desc}</p>
                    </div>
                </div>
            </div>

            {/* PREFERENCES */}
            <div className="space-y-2">
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2"><SettingsIcon size={12}/> {t.preferences}</h3>
                 <div className="rounded-xl border border-white/5 divide-y divide-white/5 relative">
                     <div className="p-4 flex justify-between items-center hover:bg-white/[0.02] transition-colors first:rounded-t-xl relative">
                         <div className="flex items-center gap-3">
                             <div className="p-2 rounded-lg bg-white/5 text-slate-400"><Languages size={16}/></div>
                             <span className="text-sm font-medium text-slate-200">{t.language}</span>
                         </div>
                         <div className="flex bg-black p-1 rounded-lg border border-white/10">
                             <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${lang === 'en' ? 'bg-[#25282C] text-white shadow-sm border border-white/10' : 'text-slate-500'}`}>EN</button>
                             <button onClick={() => setLang('zh')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${lang === 'zh' ? 'bg-[#25282C] text-white shadow-sm border border-white/10' : 'text-slate-500'}`}>中文</button>
                         </div>
                     </div>
                     <div className="p-4 flex justify-between items-center hover:bg-white/[0.02] transition-colors last:rounded-b-xl relative">
                         <div className="flex items-center gap-3">
                             <div className="p-2 rounded-lg bg-white/5 text-slate-400"><Palette size={16}/></div>
                             <span className="text-sm font-medium text-slate-200">{t.lossColor}</span>
                         </div>
                         <GemstoneLight 
                            color={lossColor} 
                            onChange={setLossColor} 
                            align="right" 
                        />
                     </div>
                 </div>
            </div>

            {/* ACCOUNT MANAGEMENT */}
            <div className="space-y-2">
                <AccountManager 
                    portfolios={portfolios} 
                    actions={actions} 
                    t={t} 
                    globalLossColor={lossColor} 
                />
            </div>

            {/* TAG MANAGEMENT */}
            <div className="space-y-2">
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2"><Target size={12}/> {t.tagManagement}</h3>
                 <div className="rounded-xl border border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                        <div className="flex items-center mb-3 gap-2">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Target size={10}/> {t.strategyList}
                            </div>
                            <button 
                                onClick={() => setShowStrategyTip(!showStrategyTip)}
                                className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${showStrategyTip ? 'bg-white text-black' : 'bg-white/5 text-slate-500 hover:text-white'}`}
                            >
                                <Info size={10} strokeWidth={2.5} />
                            </button>
                        </div>
                        
                        {showStrategyTip && (
                            <div className="mb-4 p-4 rounded-xl border border-white/10 bg-[#111] relative overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                 <div className="absolute top-0 left-0 w-1 h-full bg-[#C8B085]"></div>
                                 <div className="flex gap-3">
                                     <div className="mt-0.5 shrink-0 text-[#C8B085]"><Info size={16} /></div>
                                     <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                        {t.strategyTip}
                                     </p>
                                 </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2 mb-3 min-h-[30px]">
                            {strategies.map(s => {
                                const parts = s.split('_');
                                const main = parts[0];
                                const sub = parts.slice(1).join('_');
                                return (
                                    <div key={s} className="group relative flex items-center">
                                        <span className="px-2.5 py-1 rounded bg-[#25282C] border border-white/5 text-[11px] text-slate-300 font-medium group-hover:bg-[#2A2D32] transition-colors pr-2 flex items-baseline">
                                            {main}
                                            {sub && <span className="text-[9px] text-zinc-500 ml-1 opacity-50">_{sub}</span>}
                                        </span>
                                        <button onClick={() => actions.deleteStrategy(s)} className="w-4 h-4 ml-[-6px] rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 scale-90 hover:scale-100"><X size={8} strokeWidth={3}/></button>
                                    </div>
                                );
                            })}
                        </div>
                        <form onSubmit={handleAddStrategy} className="relative"><input type="text" value={newStrat} onChange={(e) => setNewStrat(e.target.value)} placeholder={t.addStrategy} className="w-full bg-[#0B0C10] border border-white/5 rounded pl-3 pr-8 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-white/20 transition-colors" /><button type="submit" disabled={!newStrat} className="absolute right-1 top-1 p-1 rounded bg-white/5 text-white hover:bg-white/20 transition-all disabled:opacity-0"><PlusIcon size={12}/></button></form>
                    </div>
                    <div className="p-4">
                        <div className="flex items-center mb-3 gap-2">
                             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Layers size={10}/> {t.mindsetList}</div>
                             <button 
                                onClick={() => setShowMindsetTip(!showMindsetTip)}
                                className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${showMindsetTip ? 'bg-white text-black' : 'bg-white/5 text-slate-500 hover:text-white'}`}
                            >
                                <Info size={10} strokeWidth={2.5} />
                            </button>
                        </div>

                        {showMindsetTip && (
                            <div className="mb-4 p-4 rounded-xl border border-white/10 bg-[#111] relative overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                 <div className="absolute top-0 left-0 w-1 h-full bg-[#C8B085]"></div>
                                 <div className="flex gap-3">
                                     <div className="mt-0.5 shrink-0 text-[#C8B085]"><Info size={16} /></div>
                                     <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                        {t.mindsetTip}
                                     </p>
                                 </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2 mb-3 min-h-[30px]">{emotions.map(e => (<div key={e} className="group relative flex items-center"><span className="px-2.5 py-1 rounded bg-[#25282C] border border-white/5 text-[11px] text-slate-300 font-medium group-hover:bg-[#2A2D32] transition-colors pr-2">{e}</span><button onClick={() => actions.deleteEmotion(e)} className="w-4 h-4 ml-[-6px] rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 scale-90 hover:scale-100"><X size={8} strokeWidth={3}/></button></div>))}</div>
                        <form onSubmit={handleAddEmotion} className="relative"><input type="text" value={newEmo} onChange={(e) => setNewEmo(e.target.value)} placeholder={t.addMindset} className="w-full bg-[#0B0C10] border border-white/5 rounded pl-3 pr-8 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-white/20 transition-colors" /><button type="submit" disabled={!newEmo} className="absolute right-1 top-1 p-1 rounded bg-white/5 text-white hover:bg-white/20 transition-all disabled:opacity-0"><PlusIcon size={12}/></button></form>
                    </div>
                 </div>
            </div>

            {/* DATA MANAGEMENT */}
            <div className="space-y-2">
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2"><HardDrive size={12}/> {t.dataManagement}</h3>
                 
                 <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => actions.downloadBackup()} className="group flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all gap-2 bg-[#1A1C20]/50 active:scale-[0.98]">
                        <div className="p-2 rounded-full bg-[#C8B085]/10 text-[#C8B085] group-hover:scale-110 transition-transform"><Upload size={18}/></div>
                        <span className="text-[10px] font-bold text-slate-300 tracking-wide text-center uppercase">{t.backupDownload}</span>
                    </button>
                    
                    <button onClick={() => jsonInputRef.current?.click()} className="group flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all gap-2 bg-[#1A1C20]/50 active:scale-[0.98]">
                        <div className="p-2 rounded-full bg-[#5B9A8B]/10 text-[#5B9A8B] group-hover:scale-110 transition-transform"><Download size={18}/></div>
                        <span className="text-[10px] font-bold text-slate-300 tracking-wide text-center uppercase">{t.backupImport}</span>
                        <input type="file" ref={jsonInputRef} onChange={(e) => actions.handleImportJSON(e, t)} className="hidden" accept=".json" />
                    </button>

                    <button onClick={() => actions.triggerCloudBackup()} className="group flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all gap-2 bg-[#1A1C20]/50 active:scale-[0.98]">
                        <div className="p-2 rounded-full bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform"><Cloud size={18}/></div>
                        <span className="text-[10px] font-bold text-slate-300 tracking-wide text-center uppercase">{t.backupCloud}</span>
                    </button>
                 </div>
            </div>

            {/* RESET ZONE */}
            <div className="mt-8 pt-8 border-t border-white/5">
                 <div className="rounded-xl border border-red-500/10 overflow-hidden relative group">
                     <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                     <div className="p-5">
                         <div className="flex items-center gap-3 mb-2"><AlertOctagon size={18} className="text-red-400"/><h3 className="text-sm font-bold text-red-400 uppercase tracking-widest">{t.dangerZone}</h3></div>
                         <p className="text-xs text-slate-500 leading-relaxed mb-4 pl-8">{t.resetDesc}</p>
                         <button onClick={() => actions.resetAllData(t)} className="w-full py-3 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-black hover:border-red-500 text-red-400 text-xs font-bold uppercase tracking-widest transition-all">{t.resetAll}</button>
                     </div>
                 </div>
            </div>
            
            <div className="text-center text-[10px] text-slate-700 font-mono pb-4 pt-2">TradeTrack Pro v1.3.1</div>
            {showLogoutConfirm && (<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"><div className="w-full max-w-xs bg-[#1C1E22] rounded-2xl border border-white/10 shadow-2xl p-6 text-center"><div className="w-12 h-12 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center text-slate-300"><LogOut size={24}/></div><h3 className="text-white font-bold text-lg mb-2">{t.logout}?</h3><p className="text-xs text-slate-400 mb-6">You are about to sign out. Your data is synced.</p><div className="flex gap-3"><button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 text-xs font-bold hover:bg-white/10 transition-colors">Cancel</button><button onClick={() => { setShowLogoutConfirm(false); onLogout(); }} className="flex-1 py-3 rounded-xl bg-[#C8B085] text-black text-xs font-bold hover:bg-[#B09870] transition-colors">Sign Out</button></div></div></div>)}

            {/* Import Conflict Modal */}
            <ImportConflictModal 
                isOpen={isImportModalOpen} 
                onResolve={actions.resolveImportConflict} 
                lang={lang} 
            />
        </div>
    );
};