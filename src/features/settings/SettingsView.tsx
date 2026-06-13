// [Manage] Last Updated: 2024-05-22
import React, { useState, useRef } from 'react';
import {
    Cloud, UserCircle, Check, LogOut, Shield, Settings as SettingsIcon, Languages, Palette,
    HardDrive, Download, Upload, AlertOctagon, Target, Info, Layers, Plus as PlusIcon,
    X, Briefcase, Trash2, Pencil, Loader2, FileKey, ChevronRight, Eye, EyeOff, FolderOpen, Save, AlertCircle, User, CloudLightning, Copy, Edit2
} from 'lucide-react';
import { SettingsViewProps, Portfolio, Lang } from '../../types';
import { THEME, I18N, DEFAULT_PALETTE, PROFIT_PALETTE, LOSS_PALETTE, APP_VERSION } from '../../constants';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { ImportConflictModal } from '../../components/modals/ImportConflictModal';
import { useTradeContext } from '../../context/TradeContext';
import { BrokerSettings } from './components/BrokerSettings';


// --- INTERNAL COMPONENT: GlassCard (UPDATED TRANSPARENCY) ---
const GlassCard = ({ children, className = '', onClick, overflowVisible = false }: { children: React.ReactNode; className?: string; onClick?: () => void; overflowVisible?: boolean }) => {
    return (
        <div
            onClick={onClick}
            className={`
                relative ${overflowVisible ? '' : 'overflow-hidden'}
                bg-gradient-to-br from-white/[0.05] to-zinc-950/40
                backdrop-blur-2xl 
                border border-white/10 
                shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)]
                rounded-2xl
                transition-all duration-300
                hover:bg-white/[0.08] hover:border-white/20
                ${className}
            `}
        >
            {/* Subtle Inner Glow Overlay */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"></div>
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
                className="w-5 h-5 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 relative group overflow-hidden"
                style={{
                    backgroundColor: color,
                    boxShadow: `0 0 15px ${color}88, inset 0 2px 4px rgba(255,255,255,0.4), 0 0 30px ${color}44`
                }}
            >
                {/* Gemstone Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-x-[-100%] group-hover:translate-x-[100%]"></div>
                <div className="absolute inset-0 rounded-full border border-white/20"></div>
            </button>

            {isOpen && (
                <div className={`absolute top-full mt-2 p-2 bg-[#0A0A0A] border border-zinc-800 rounded-xl shadow-2xl z-[100] flex gap-2 animate-in fade-in zoom-in-95 duration-200 flex-wrap w-[180px] justify-center ${align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                    {DEFAULT_PALETTE.map(c => (
                        <button
                            key={c}
                            onClick={() => { onChange(c); setIsOpen(false); }}
                            className={`w-5 h-5 rounded-full transition-all hover:scale-125 border border-white/5 relative flex items-center justify-center ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-black scale-110' : ''}`}
                            style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}44` }}
                        >
                            {color === c && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />}
                        </button>
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



// --- INTERNAL COMPONENT: Glow Slider (Pro Max) ---
const GlowSlider = ({ value, min, max, step, onChange, gradientColors }: { value: number, min: number, max: number, step: number, onChange: (val: number) => void, gradientColors: string[] }) => {
    const percent = ((value - min) / (max - min)) * 100;
    const activeColor = gradientColors[1] || gradientColors[0];

    return (
        <div className="relative flex items-center h-6 group select-none w-full">
            {/* Track Background */}
            <div className="absolute w-full h-1.5 rounded-lg bg-white/5 overflow-hidden">
                <div
                    className="h-full transition-all duration-100 ease-out"
                    style={{
                        width: `${percent}%`,
                        background: `linear-gradient(to right, ${gradientColors.join(', ')})`
                    }}
                />
            </div>

            {/* Thumb with Glow & Shine */}
            <div
                className="absolute h-5 w-5 rounded-full bg-white shadow-lg pointer-events-none transition-all duration-100 ease-out flex items-center justify-center z-10 overflow-hidden"
                style={{
                    left: `calc(${percent}% - 10px)`,
                    boxShadow: `0 0 20px ${activeColor}AA`,
                    border: `1.5px solid ${activeColor}`
                }}
            >
                {/* Thumb Shine */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/60 to-transparent"></div>
                <div className="w-2 h-2 rounded-full bg-black/10 relative z-10" />
            </div>

            {/* Hidden Input for Interaction */}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
        </div>
    );
};
// --- INTERNAL COMPONENT: Currency Input ---
const CurrencyInput = ({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) => {
    const [isFocused, setIsFocused] = useState(false);
    const displayValue = isFocused ? value : Number(value).toLocaleString();

    return (
        <input
            type="text"
            value={displayValue}
            onChange={(e) => {
                const val = e.target.value.replace(/,/g, '');
                if (!isNaN(Number(val))) onChange(val);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={className}
        />
    );
};

// --- INTERNAL COMPONENT: AccountThemeSelector (Pro Max) ---
const AccountThemeSelector = ({ portfolio, onUpdate, globalLossColor }: { portfolio: Portfolio, onUpdate: (id: string, key: string, val: any) => void, globalLossColor: string }) => {
    const [isOpen, setIsOpen] = useState<'profit' | 'loss' | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    useClickOutside(containerRef, () => setIsOpen(null));

    const colors = {
        profit: portfolio.profitColor,
        loss: portfolio.lossColor || globalLossColor
    };

    // Determine active palette based on which button was clicked
    const activePalette = isOpen === 'profit' ? PROFIT_PALETTE : LOSS_PALETTE;

    return (
        <div className="relative flex items-center" ref={containerRef}>
            {/* Profit Trigger */}
            <button
                onClick={() => setIsOpen(isOpen === 'profit' ? null : 'profit')}
                className={`flex items-center gap-2 pl-3 pr-2 py-2 rounded-l-xl hover:bg-white/10 transition-all duration-300 group relative active:scale-95 border-y border-l border-white/5 ${isOpen === 'profit' ? 'bg-white/10' : 'bg-white/5'}`}
                title="Edit Profit Color"
            >
                <span className="text-[10px] font-bold text-zinc-400 tracking-wider group-hover:text-zinc-200 transition-colors">PROFIT</span>
                <div
                    className="w-5 h-5 rounded-full transition-all duration-500 group-hover:scale-110 relative opacity-90"
                    style={{
                        backgroundColor: colors.profit,
                        boxShadow: `0 0 15px ${colors.profit}88, inset 0 0 8px rgba(255,255,255,0.4)`
                    }}
                >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/20 to-white/30" />
                </div>
            </button>

            {/* Separator */}
            <div className="w-px h-6 bg-white/10"></div>

            {/* Loss Trigger */}
            <button
                onClick={() => setIsOpen(isOpen === 'loss' ? null : 'loss')}
                className={`flex items-center gap-2 pl-2 pr-3 py-2 rounded-r-xl hover:bg-emerald-500/10 transition-all duration-300 group relative active:scale-95 border-y border-r border-white/5 ${isOpen === 'loss' ? 'bg-emerald-500/20' : 'bg-white/5'}`}
                title="Edit Loss Color"
            >
                <div
                    className="w-5 h-5 rounded-full transition-all duration-500 group-hover:scale-110 relative opacity-90"
                    style={{
                        backgroundColor: colors.loss,
                        boxShadow: `0 0 15px ${colors.loss}66, inset 0 0 8px rgba(255,255,255,0.3)`
                    }}
                >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/20 to-white/20" />
                </div>
                <span className={`text-[10px] font-bold tracking-wider group-hover:text-emerald-300 transition-colors ${isOpen === 'loss' ? 'text-emerald-400' : 'text-zinc-400'}`}>LOSS</span>
            </button>

            {isOpen && (
                <div className={`absolute top-full mt-2 bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-[200] p-3 animate-in fade-in zoom-in-95 duration-300 backdrop-blur-3xl w-[230px] ${isOpen === 'profit' ? 'right-12' : 'right-0'}`}>
                    <div className="flex flex-wrap gap-2 justify-center mb-1">
                        {/* 9 Presets + 1 Custom = 10 items (5 per row) */}
                        {activePalette.slice(0, 9).map(c => {
                            const activeColor = isOpen === 'profit' ? colors.profit : colors.loss;
                            const isSelected = activeColor === c;
                            return (
                                <button
                                    key={c}
                                    onClick={() => {
                                        onUpdate(portfolio.id, isOpen === 'profit' ? 'profitColor' : 'lossColor', c);
                                        setIsOpen(null);
                                    }}
                                    className={`w-8 h-8 rounded-full transition-all duration-300 hover:scale-110 border border-white/5 relative flex items-center justify-center ${isSelected ? 'ring-2 ring-[#C8B085] ring-offset-2 ring-offset-[#0A0A0A] scale-110 shadow-lg' : 'hover:ring-1 hover:ring-white/30'}`}
                                    style={{
                                        backgroundColor: c,
                                        boxShadow: isSelected ? `0 0 20px ${c}88` : `0 0 10px ${c}33`
                                    }}
                                >
                                    {isSelected && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse" />
                                    )}
                                </button>
                            );
                        })}

                        {/* Custom Picker Tool (10th item) */}
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/10 group cursor-pointer transition-all hover:scale-125">
                            <input
                                type="color"
                                value={isOpen === 'profit' ? colors.profit : colors.loss}
                                onChange={(e) => {
                                    onUpdate(portfolio.id, isOpen === 'profit' ? 'profitColor' : 'lossColor', e.target.value);
                                    setIsOpen(null);
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            />
                            <div className="w-full h-full bg-[conic-gradient(at_center,_red,_orange,_yellow,_green,_blue,_indigo,_violet)] opacity-70 group-hover:opacity-100" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <PlusIcon size={14} className="text-white drop-shadow-md stroke-[3]" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- INTERNAL COMPONENT: Account Row (Refined for V2.4.4 - Ultra Compact) ---
const AccountRow = ({
    portfolio,
    actions,
    isDeletable,
    globalLossColor,
    t
}: {
    portfolio: Portfolio,
    actions: any,
    isDeletable: boolean,
    globalLossColor: string,
    t: any
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempName, setTempName] = useState(portfolio.name);
    const [tempCapital, setTempCapital] = useState(String(portfolio.initialCapital));
    // S1: inline delete confirmation 取代 window.confirm
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Resolve which broker accounts the user has mapped to this portfolio
    // via SyncDateModal, so the card shows "綁定：永豐 9162673（現股）"
    // and the user can tell at a glance which real account it represents.
    // accountPortfolioMap key format: `${configId}|${code}|${subIdx}`.
    const { brokerConfigs, lang: ctxLang } = useTradeContext();
    const [accountMap] = useLocalStorage<Record<string, string>>('account_portfolio_map_v2', {});
    const linkedAccounts = React.useMemo(() => {
        const out: string[] = [];
        for (const [key, pid] of Object.entries(accountMap)) {
            if (pid !== portfolio.id) continue;
            const [configId, code] = key.split('|');
            const cfg = brokerConfigs.find(c => c.id === configId);
            const broker = cfg?.alias || cfg?.brokerUsername || (ctxLang === 'zh' ? '券商' : 'Broker');
            out.push(code ? `${broker} ${code}` : broker);
        }
        return out;
    }, [accountMap, brokerConfigs, portfolio.id, ctxLang]);

    // S1: 自動取消確認（2 秒後不操作就收回）
    React.useEffect(() => {
        if (!showDeleteConfirm) return;
        const timer = setTimeout(() => setShowDeleteConfirm(false), 2000);
        return () => clearTimeout(timer);
    }, [showDeleteConfirm]);

    const handleSave = () => {
        // S9: 合併為一次 batch update，避免連續觸發兩次渲染
        const updates: Record<string, any> = {};
        if (tempName.trim()) updates.name = tempName.trim();
        const cap = parseFloat(tempCapital);
        if (!isNaN(cap)) updates.initialCapital = cap;
        Object.entries(updates).forEach(([key, val]) => actions.updatePortfolio(portfolio.id, key, val));
        setIsEditing(false);
    };

    return (
        <div className="group flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.04] transition-all duration-300 relative">
            {/* Main Info (Left) */}
            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                        <input
                            autoFocus
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#C8B085]/50 transition-colors"
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        />
                        <input
                            type="number"
                            value={tempCapital}
                            onChange={(e) => setTempCapital(e.target.value)}
                            className="w-24 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white text-right outline-none focus:border-[#C8B085]/50 transition-colors font-mono"
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        />
                        <button onClick={handleSave} className="p-1.5 text-[#5B9A8B] hover:bg-[#5B9A8B]/10 rounded-lg transition-colors"><Check size={14} /></button>
                    </div>
                ) : (
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 group/edit cursor-pointer w-fit" onClick={() => setIsEditing(true)}>
                            <span className="text-sm font-bold text-zinc-200 truncate group-hover/edit:text-[#C8B085] transition-colors">{portfolio.name}</span>
                            <Edit2 size={10} className="opacity-0 group-hover/edit:opacity-100 text-[#C8B085]/70 transition-opacity" />
                        </div>
                        <span className="text-xs text-zinc-500 font-mono tracking-tight mt-0.5">{Number(portfolio.initialCapital).toLocaleString()}</span>
                        {linkedAccounts.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {linkedAccounts.map((label, idx) => (
                                    <span
                                        key={idx}
                                        className="text-[9px] font-mono tracking-tight px-1.5 py-0.5 rounded bg-[#C8B085]/10 border border-[#C8B085]/20 text-[#C8B085]/80"
                                        title={ctxLang === 'zh' ? '綁定的券商帳號' : 'Linked broker account'}
                                    >
                                        {label}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Actions & Theme Selector (Right) */}
            <div className="flex items-center gap-3 shrink-0">
                {!isEditing && isDeletable && (
                    showDeleteConfirm ? (
                        <button
                            onClick={() => { actions.deletePortfolio(portfolio.id); setShowDeleteConfirm(false); }}
                            className="px-2.5 py-1 bg-red-500 hover:bg-red-400 text-white text-[10px] font-bold rounded-lg transition-all animate-in fade-in zoom-in-95 duration-150 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                        >
                            {t.confirm || '確認'}
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300"
                        >
                            <Trash2 size={14} />
                        </button>
                    )
                )}


                {!isEditing && (
                    <AccountThemeSelector
                        portfolio={portfolio}
                        onUpdate={actions.updatePortfolio}
                        globalLossColor={globalLossColor}
                    />
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
            actions.addPortfolio(newP);
            setNewName('');
            setNewCapital('');
            setIsAdding(false);
        }
    };

    return (
        <GlassCard className="bg-[#050505]/60 border-zinc-800/60" overflowVisible={true}>

            <div className="flex flex-col">
                {portfolios.map(p => (
                    <AccountRow
                        key={p.id}
                        portfolio={p}
                        actions={actions}
                        isDeletable={portfolios.length > 1}
                        globalLossColor={globalLossColor}
                        t={t}
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
                                placeholder={t.portfolioName}
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="flex-1 bg-zinc-900/30 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition-colors"
                            />
                            <input
                                type="number"
                                placeholder={t.initialCapital}
                                value={newCapital}
                                onChange={e => setNewCapital(e.target.value)}
                                className="w-32 bg-zinc-900/30 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 font-mono transition-colors text-right"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" disabled={!newName || !newCapital} className="flex-1 bg-zinc-100 hover:bg-white text-black py-2 rounded-lg text-xs font-bold uppercase disabled:opacity-50 transition-colors">{t.confirm}</button>
                            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-zinc-500 hover:text-zinc-300 text-xs font-bold uppercase transition-colors">{t.cancel}</button>
                        </div>
                    </form>
                ) : (
                    <button
                        onClick={() => setIsAdding(true)} className="w-full py-3 rounded-xl border border-dashed border-zinc-800 text-zinc-600 hover:border-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 transition-all duration-300 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide group hover:scale-[1.01] active:scale-[0.99]"
                    >
                        <PlusIcon size={14} className="group-hover:scale-110 transition-transform duration-300" /> {t.addPortfolio}
                    </button>
                )}
            </div>
        </GlassCard>
    );
};

// --- INTERNAL COMPONENT: ResetConfirmPanel ---
const ResetConfirmPanel = ({ lang, onConfirm, onCancel }: { lang: Lang; onConfirm: () => void; onCancel: () => void }) => {
    const [countdown, setCountdown] = React.useState(3);

    React.useEffect(() => {
        if (countdown <= 0) return;
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    const isZh = lang === 'zh';

    return (
        <div className="flex flex-col gap-3 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-red-400">
                <AlertOctagon size={16} />
                <span className="text-xs font-bold">{isZh ? '⚠ 此操作不可復原！' : '⚠ This action is irreversible!'}</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
                {isZh
                    ? '所有交易紀錄、帳戶設定、策略標籤將被永久刪除。'
                    : 'All trades, account settings, and strategy tags will be permanently deleted.'}
            </p>
            <div className="flex gap-2">
                <button
                    type="button"
                    disabled={countdown > 0}
                    onClick={(e) => { e.preventDefault(); onConfirm(); }}
                    className={`flex-[2] py-3 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all ${countdown > 0
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed'
                        : 'bg-red-500 border-red-600 text-white hover:bg-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                        }`}
                >
                    {countdown > 0
                        ? `${isZh ? '確認刪除' : 'Confirm Delete'} (${countdown}s)`
                        : (isZh ? '確認刪除' : 'Confirm Delete')}
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); onCancel(); }}
                    className="flex-1 py-3 rounded-lg bg-white/5 border border-white/10 text-zinc-400 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                    {isZh ? '取消' : 'Cancel'}
                </button>
            </div>
        </div>
    );
};

// --- MAIN SETTINGS VIEW ---
export const SettingsView = ({ onBack }: { onBack?: () => void }) => {
    const {
        trades, portfolios, actions, lang, setLang, hideAmounts,
        authStatus, user: currentUser, login: onLogin, logout: onLogout,
        isSyncing, syncStatus, syncError, lastBackupTime, triggerCloudBackup, manualPull, repairDatabase,
        availableStrategies: strategies, availableEmotions: emotions,
        brokerConfigs, activeBrokerId, setActiveBrokerId, updateBrokerConfig, addBrokerConfig, deleteBrokerConfig,
        lossColor, setLossColor, ddThreshold, setDdThreshold, maxLossStreak, setMaxLossStreak,
    } = useTradeContext();
    // Previously this destructure aliased `isSyncModalOpen` to
    // `isImportModalOpen`, which meant the ImportConflictModal popped up on
    // *cloud sync* conflicts (wrong modal at the wrong time) and never on
    // the actual JSON-import conflict. Pull the real flag + conflict preview
    // data from `actions` where they live.
    const isImportModalOpen = actions.isImportModalOpen;
    const importConflicts = actions.importConflicts;
    const incomingImportCount = actions.incomingImportCount;


    const t = I18N[lang] || I18N['zh'];

    const [newStrat, setNewStrat] = useState('');
    const [newEmo, setNewEmo] = useState('');
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showStrategyTip, setShowStrategyTip] = useState(false);
    const [showMindsetTip, setShowMindsetTip] = useState(false);
    const [isForceBackingUp, setIsForceBackingUp] = useState(false); // State for button loading
    const [isForcePulling, setIsForcePulling] = useState(false); // State for pull loading
    // Set1 (v3.5.0): cloud-restore 改為 inline two-step confirm，避免誤觸蓋掉本地全部資料
    const [pullConfirmStage, setPullConfirmStage] = useState<'idle' | 'confirm'>('idle');
    React.useEffect(() => {
        if (pullConfirmStage !== 'confirm') return;
        const timer = setTimeout(() => setPullConfirmStage('idle'), 3000);
        return () => clearTimeout(timer);
    }, [pullConfirmStage]);
    const [showResetConfirm, setShowResetConfirm] = useState(false); // New state for two-step reset
    const jsonInputRef = useRef<HTMLInputElement>(null);


    const handleAddStrategy = (e: React.FormEvent) => {
        e.preventDefault();
        if (newStrat.trim()) { actions.addStrategy(newStrat.trim()); setNewStrat(''); }
    };

    const handleAddEmotion = (e: React.FormEvent) => {
        e.preventDefault();
        if (newEmo.trim()) { actions.addEmotion(newEmo.trim()); setNewEmo(''); }
    };

    const handleForceBackup = async () => {
        if (!currentUser) return onLogin();

        setIsForceBackingUp(true);
        const result = await triggerCloudBackup();
        setIsForceBackingUp(false);

        if (result.success) {
            alert(lang === 'zh' ? '強制備份成功！雲端資料已覆蓋為目前裝置版本。' : 'Force backup successful! Cloud data overwritten with local version.');
        } else {
            alert(lang === 'zh' ? `備份失敗：${result.error}` : `Backup failed: ${result.error}`);
        }
    };

    const handleForcePull = async () => {
        if (!currentUser) return onLogin();
        // Two-step inline confirm，取代 window.confirm（瀏覽器擋掉就直接覆蓋本地資料）
        if (pullConfirmStage === 'idle') {
            setPullConfirmStage('confirm');
            return;
        }
        setPullConfirmStage('idle');
        setIsForcePulling(true);
        const result = await manualPull();
        setIsForcePulling(false);

        if (result.success) {
            alert(lang === 'zh' ? '還原成功！資料已更新。' : 'Restore successful! Data has been updated.');
        } else {
            alert(lang === 'zh' ? `還原失敗：${result.error}` : `Restore failed: ${result.error}`);
        }
    };

    // S10: ddPercent / streakPercent removed — slider components handle their own %

    return (
        <div className="space-y-8 px-4 sm:px-0 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-48 pt-[max(1rem,env(safe-area-inset-top))] max-w-full overflow-x-hidden">
            {/* CLOUD SYNC */}
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#C8B085] uppercase tracking-[0.2em] px-2 flex items-center gap-2 border-l-2 border-[#C8B085]/30 py-0.5"><Cloud size={12} /> {t.cloudBackupSection ?? 'Google 雲端備份'}</h3>
                <div className={`rounded-3xl relative overflow-hidden border transition-all duration-500 ${currentUser ? 'bg-[#1C1E22] border-[#C8B085]/20 p-5' : 'bg-transparent border-white/5 p-1'}`}>
                    {/* Background Decoration */}
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none transform translate-x-1/3 -translate-y-1/3">
                        <UserCircle size={180} />
                    </div>

                    {currentUser ? (
                        <div className="relative z-10">
                            <div className="flex items-start justify-between gap-4">
                                {/* Left: Avatar & Info */}
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="relative shrink-0">
                                        {currentUser.photoURL ? (
                                            <img src={currentUser.photoURL} alt="User" className="w-14 h-14 rounded-full border-2 border-white/10 shadow-lg" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center border border-white/10"><UserCircle size={28} className="text-slate-400" /></div>
                                        )}
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#5B9A8B] border-[3px] border-[#1C1E22] shadow-sm flex items-center justify-center">
                                            <Check size={8} className="text-[#1C1E22] stroke-[4]" />
                                        </div>
                                    </div>

                                    <div className="flex flex-col min-w-0">
                                        <h2 className="text-base font-bold text-white tracking-tight truncate">
                                            {currentUser.displayName || 'Anonymous Trader'}
                                        </h2>
                                        <p className="text-[10px] text-zinc-500 font-mono truncate max-w-full opacity-80 mb-1.5">
                                            {currentUser.email}
                                        </p>

                                        {/* Status Row */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#5B9A8B]/10 border border-[#5B9A8B]/20">
                                                <Cloud size={8} className="text-[#5B9A8B]" />
                                                <span className="text-[9px] font-bold text-[#5B9A8B] uppercase tracking-wider">{t.synced}</span>
                                            </div>
                                            {lastBackupTime instanceof Date && (
                                                <span className="text-[9px] text-zinc-600 font-mono">
                                                    {lastBackupTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Logout Icon Button */}
                                <button
                                    onClick={() => setShowLogoutConfirm(true)}
                                    className="shrink-0 p-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
                                    title={t.logout}
                                >
                                    <LogOut size={16} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div
                            onClick={onLogin}
                            className="relative z-10 flex items-center gap-4 p-3 cursor-pointer group hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/10"
                        >
                            <div className="w-10 h-10 shrink-0 rounded-full bg-[#C8B085]/10 flex items-center justify-center border border-[#C8B085]/20 group-hover:bg-[#C8B085] group-hover:text-black transition-all shadow-[0_0_10px_rgba(200,176,133,0.1)]">
                                <Cloud size={18} className="text-[#C8B085] group-hover:text-black transition-colors" />
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-white group-hover:text-[#C8B085] transition-colors truncate">{t.googleSignIn ?? 'Google 登入'}</h3>
                                <p className="text-[10px] text-zinc-500 truncate group-hover:text-zinc-400 transition-colors">
                                    點擊登入即可啟用雲端備份與還原
                                </p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-600 group-hover:bg-[#C8B085] group-hover:text-black transition-all">
                                <ChevronRight size={14} strokeWidth={3} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* BROKERAGE INTEGRATION */}
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#C8B085] uppercase tracking-[0.2em] px-2 flex items-center gap-2 border-l-2 border-[#C8B085]/30 py-0.5">
                    <CloudLightning size={12} /> {lang === 'zh' ? '同步券商' : 'BROKER SYNC'}
                </h3>
                <BrokerSettings
                    configs={brokerConfigs}
                    onUpdate={updateBrokerConfig}
                    onAdd={addBrokerConfig}
                    onDelete={deleteBrokerConfig}
                    lang={lang}
                />
            </div>


            {/* RISK MANAGEMENT */}


            <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#C8B085] uppercase tracking-[0.2em] px-2 flex items-center gap-2 border-l-2 border-[#C8B085]/30 py-0.5"><Shield size={12} /> {t.riskSettings}</h3>
                <div className="p-4 rounded-xl border border-white/5 space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs items-center">
                            <span className="text-white/90 font-bold">{t.ddThreshold}</span>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#2C5F54]/30 border border-[#2C5F54]/50">
                                <input
                                    type="number"
                                    value={ddThreshold}
                                    min={5}
                                    max={50}
                                    onChange={(e) => {
                                        const val = Math.min(50, Math.max(5, Number(e.target.value)));
                                        setDdThreshold(val);
                                    }}
                                    className="bg-transparent border-none outline-none text-[#5B9A8B] font-bold font-barlow-numeric w-10 text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="text-[#5B9A8B] font-bold font-barlow-numeric text-xs">%</span>
                            </div>
                        </div>
                        <div className="relative flex items-center h-6 w-full">
                            <GlowSlider
                                min={5} max={50} step={1} value={ddThreshold} onChange={setDdThreshold}
                                gradientColors={[THEME.GREEN_DARK, THEME.GREEN]}
                            />
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">{t.risk_dd_desc}</p>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs items-center">
                            <span className="text-white/90 font-bold">{t.maxLossStreak}</span>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#C8B085]/10 border border-[#C8B085]/30">
                                <input
                                    type="number"
                                    value={maxLossStreak}
                                    min={2}
                                    max={10}
                                    onChange={(e) => {
                                        const val = Math.min(10, Math.max(2, Number(e.target.value)));
                                        setMaxLossStreak(val);
                                    }}
                                    className="bg-transparent border-none outline-none text-[#C8B085] font-bold font-barlow-numeric w-8 text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="text-[#C8B085] font-bold font-barlow-numeric text-xs">次</span>
                            </div>
                        </div>
                        <div className="relative flex items-center h-6 w-full">
                            <GlowSlider
                                min={2} max={10} step={1} value={maxLossStreak} onChange={setMaxLossStreak}
                                gradientColors={['#A08C65', '#C8B085']}
                            />
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">{t.risk_streak_desc}</p>
                    </div>
                </div>
            </div>

            {/* PREFERENCES */}
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#C8B085] uppercase tracking-[0.2em] px-2 flex items-center gap-2 border-l-2 border-[#C8B085]/30 py-0.5"><SettingsIcon size={12} /> {t.preferences}</h3>
                <div className="rounded-xl border border-white/5 divide-y divide-white/5 relative">
                    <div className="p-4 flex justify-between items-center hover:bg-white/[0.02] transition-colors first:rounded-t-xl relative">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/5 text-zinc-600"><Languages size={16} /></div>
                            <span className="text-sm font-medium text-white/90">{t.language}</span>
                        </div>
                        <div className="relative flex bg-black/40 p-1 rounded-lg border border-white/10 w-[140px] h-[36px]">
                            {/* Sliding Background */}
                            <div
                                className="absolute top-1 bottom-1 rounded-md bg-[#25282C] border border-white/10 shadow-sm transition-all duration-300 ease-out"
                                style={{
                                    left: lang === 'en' ? '4px' : '50%',
                                    width: 'calc(50% - 4px)',
                                    transform: lang === 'zh' ? 'translateX(0)' : 'translateX(0)'
                                }}
                            />

                            <button
                                onClick={() => setLang('en')}
                                className={`relative z-10 flex-1 text-[10px] font-bold transition-colors duration-300 ${lang === 'en' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                            >
                                EN
                            </button>
                            <button
                                onClick={() => setLang('zh')}
                                className={`relative z-10 flex-1 text-[10px] font-bold transition-colors duration-300 ${lang === 'zh' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                            >
                                中文
                            </button>
                        </div>
                    </div>
                    <div className="p-4 flex justify-between items-center hover:bg-white/[0.02] transition-colors last:rounded-b-xl relative">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/5 text-zinc-600"><Palette size={16} /></div>
                            <span className="text-sm font-medium text-white/90">{t.lossColor}</span>
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
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#C8B085] uppercase tracking-[0.2em] px-2 flex items-center gap-2 border-l-2 border-[#C8B085]/30 py-0.5"><Briefcase size={12} /> {t.managePortfolios}</h3>
                <AccountManager
                    portfolios={portfolios}
                    actions={actions}
                    t={t}
                    globalLossColor={lossColor}
                />
            </div>

            {/* TAG MANAGEMENT */}
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#C8B085] uppercase tracking-[0.2em] px-2 flex items-center gap-2 border-l-2 border-[#C8B085]/30 py-0.5"><Target size={12} /> {t.tagManagement}</h3>
                <div className="rounded-xl border border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                        <div className="flex items-center mb-3 gap-2">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Target size={10} /> {t.strategyList}
                            </div>
                            <button
                                onClick={() => setShowStrategyTip(!showStrategyTip)}
                                className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${showStrategyTip ? 'bg-white text-black' : 'bg-white/5 text-zinc-600 hover:text-white'}`}
                            >
                                <Info size={10} strokeWidth={2.5} />
                            </button>
                        </div>

                        {showStrategyTip && (
                            <div className="mb-4 p-4 rounded-xl border border-white/10 bg-[#111] relative overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                <div className="absolute top-0 left-0 w-1 h-full bg-[#C8B085]"></div>
                                <div className="flex gap-3">
                                    <div className="mt-0.5 shrink-0 text-[#C8B085]"><Info size={16} /></div>
                                    <p className="text-xs text-zinc-400 leading-relaxed font-medium">
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
                                        <span className="px-2.5 py-1 rounded bg-[#25282C] border border-white/5 text-[11px] text-zinc-400 font-medium group-hover:bg-[#2A2D32] transition-colors pr-2 flex items-baseline">
                                            {main}
                                            {sub && <span className="text-[9px] text-zinc-600 ml-1 opacity-50">_{sub}</span>}
                                        </span>
                                        <button onClick={() => actions.deleteStrategy(s)} className="w-4 h-4 ml-[-6px] rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 scale-90 hover:scale-100"><X size={8} strokeWidth={3} /></button>
                                    </div>
                                );
                            })}
                        </div>
                        <form onSubmit={handleAddStrategy} className="relative"><input type="text" value={newStrat} onChange={(e) => setNewStrat(e.target.value)} placeholder={t.addStrategy} className="w-full bg-[#0B0C10] border border-white/5 rounded pl-3 pr-8 py-2 text-xs text-white placeholder-zinc-700 outline-none focus:border-white/20 transition-colors" /><button type="submit" disabled={!newStrat} className="absolute right-1 top-1 p-1 rounded bg-white/5 text-white hover:bg-white/20 transition-all disabled:opacity-0"><PlusIcon size={12} /></button></form>
                    </div>
                    <div className="p-4">
                        <div className="flex items-center mb-3 gap-2">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5"><Layers size={10} /> {t.mindsetList}</div>
                            <button
                                onClick={() => setShowMindsetTip(!showMindsetTip)}
                                className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${showMindsetTip ? 'bg-white text-black' : 'bg-white/5 text-zinc-600 hover:text-white'}`}
                            >
                                <Info size={10} strokeWidth={2.5} />
                            </button>
                        </div>

                        {showMindsetTip && (
                            <div className="mb-4 p-4 rounded-xl border border-white/10 bg-[#111] relative overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                <div className="absolute top-0 left-0 w-1 h-full bg-[#C8B085]"></div>
                                <div className="flex gap-3">
                                    <div className="mt-0.5 shrink-0 text-[#C8B085]"><Info size={16} /></div>
                                    <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                                        {t.mindsetTip}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2 mb-3 min-h-[30px]">{emotions.map(e => (<div key={e} className="group relative flex items-center"><span className="px-2.5 py-1 rounded bg-[#25282C] border border-white/5 text-[11px] text-zinc-400 font-medium group-hover:bg-[#2A2D32] transition-colors pr-2">{e}</span><button onClick={() => actions.deleteEmotion(e)} className="w-4 h-4 ml-[-6px] rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 scale-90 hover:scale-100"><X size={8} strokeWidth={3} /></button></div>))}</div>
                        <form onSubmit={handleAddEmotion} className="relative"><input type="text" value={newEmo} onChange={(e) => setNewEmo(e.target.value)} placeholder={t.addMindset} className="w-full bg-[#0B0C10] border border-white/5 rounded pl-3 pr-8 py-2 text-xs text-white placeholder-zinc-700 outline-none focus:border-white/20 transition-colors" /><button type="submit" disabled={!newEmo} className="absolute right-1 top-1 p-1 rounded bg-white/5 text-white hover:bg-white/20 transition-all disabled:opacity-0"><PlusIcon size={12} /></button></form>
                    </div>
                </div>
            </div>

            {/* DATA MANAGEMENT */}
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#C8B085] uppercase tracking-[0.2em] px-2 flex items-center gap-2 border-l-2 border-[#C8B085]/30 py-0.5"><HardDrive size={12} /> {t.dataManagement}</h3>

                <div className="grid grid-cols-1 gap-3">
                    {/* CLOUD ACTIONS ONLY - Removed Local Backup as per user request */}

                    <button
                        onClick={handleForcePull}
                        disabled={isForcePulling}
                        className={`group flex flex-col items-center justify-center p-5 rounded-2xl border transition-all gap-2 active:scale-[0.98] ${
                            pullConfirmStage === 'confirm'
                                ? 'border-red-500/60 bg-red-500/10'
                                : 'border-[#C8B085]/20 hover:border-[#C8B085]/40 bg-[#C8B085]/5'
                        }`}
                    >
                        <div className={`p-3 rounded-full transition-transform group-hover:scale-110 ${
                            pullConfirmStage === 'confirm'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-[#C8B085]/10 text-[#C8B085]'
                        }`}>
                            {isForcePulling ? <Loader2 size={20} className="animate-spin" /> : <CloudLightning size={20} />}
                        </div>
                        <span className={`text-[10px] font-bold tracking-wider text-center uppercase ${
                            pullConfirmStage === 'confirm' ? 'text-red-400' : 'text-[#C8B085]'
                        }`}>
                            {pullConfirmStage === 'confirm'
                                ? (lang === 'zh' ? '再按一次確認覆蓋' : 'Tap again to overwrite')
                                : (lang === 'zh' ? '雲端還原' : 'Cloud Restore')}
                        </span>
                    </button>

                    <button
                        onClick={handleForceBackup}
                        disabled={isForceBackingUp}
                        className="group flex flex-col items-center justify-center p-5 rounded-2xl border border-[#5B9A8B]/20 hover:border-[#5B9A8B]/40 transition-all gap-2 bg-[#5B9A8B]/5 active:scale-[0.98]"
                    >
                        <div className="p-3 rounded-full bg-[#5B9A8B]/10 text-[#5B9A8B] group-hover:scale-110 transition-transform">
                            {isForceBackingUp ? <Loader2 size={20} className="animate-spin" /> : <Cloud size={20} />}
                        </div>
                        <span className="text-[10px] font-bold text-[#5B9A8B] tracking-wider text-center uppercase">{t.cloudBackup ?? '雲端備份'}</span>
                    </button>
                </div>
            </div>


            {/* SYSTEM DIAGNOSIS & REPAIR */}
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#C8B085] uppercase tracking-[0.2em] px-2 flex items-center gap-2 border-l-2 border-[#C8B085]/30 py-0.5">{t.systemDiagnostics ?? '系統診斷與修復'}</h3>

                <div className="p-5 rounded-2xl bg-black/20 border border-white/5 space-y-4">
                    {/* SYNC STATUS DASHBOARD */}
                    <div className="flex items-start gap-3">
                        <div className={`mt-1 w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-[#5B9A8B] shadow-[0_0_8px_rgba(91,154,139,0.5)]' : syncStatus === 'error' ? 'bg-red-500 animate-pulse' : 'bg-yellow-500 animate-bounce'}`} />
                        <div className="flex-1">
                            <div className="text-xs font-bold text-white mb-1">
                                {syncStatus === 'synced' ? '雲端連線正常' : syncStatus === 'error' ? '連線異常 / 權限受限' : '正在通訊...'}
                            </div>
                            {syncError && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] font-mono leading-relaxed mt-2 overflow-auto max-h-24 text-zinc-500">
                                    ERROR: {syncError}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* REPAIR TOOLS */}
                    <div className="space-y-3">
                        <p className="text-[10px] leading-relaxed uppercase tracking-tighter text-zinc-600">
                            如果遇到「Unexpected state」或「權限不足」，請嘗試下方的修復工具或檢查雲端規則。
                        </p>
                        <button
                            onClick={() => {
                                if (window.confirm('此操作將會清除瀏覽器本地快取並重新載入。您的交易資料在雲端是安全的。要繼續嗎？')) {
                                    repairDatabase();
                                }
                            }}
                            className="w-full py-3 rounded-xl bg-[#C8B085]/10 border border-[#C8B085]/20 hover:bg-[#C8B085] hover:text-black hover:border-black text-[#C8B085] text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                            <AlertCircle size={14} /> 修復資料庫 (重設快取)
                        </button>
                    </div>
                </div>
            </div>

            {/* RESET ZONE */}
            <div className="mt-8 pt-8 border-t border-white/5">
                <div className="rounded-xl border border-red-500/10 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    <div className="p-5">
                        <div className="flex items-center gap-3 mb-2"><AlertOctagon size={18} className="text-red-400" /><h3 className="text-[10px] font-bold text-red-400/80 uppercase tracking-[0.2em]">{t.dangerZone}</h3></div>
                        <p className="text-xs text-zinc-600 leading-relaxed mb-4 pl-8">{t.resetDesc}</p>

                        <div className="relative">
                            {!showResetConfirm ? (
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); setShowResetConfirm(true); }}
                                    className="w-full py-3 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest transition-all"
                                >
                                    {t.resetAll}
                                </button>
                            ) : (
                                <ResetConfirmPanel
                                    lang={lang}
                                    onConfirm={() => { actions.resetAllData(t); setShowResetConfirm(false); }}
                                    onCancel={() => setShowResetConfirm(false)}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-center text-[10px] text-zinc-800 font-mono pb-4 pt-2 underline decoration-red-500/20">TradeTrack Pro {APP_VERSION}</div>

            {showLogoutConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-xs bg-[#1C1E22] rounded-2xl border border-white/10 shadow-2xl p-6 text-center">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center text-slate-300">
                            <LogOut size={24} />
                        </div>
                        <h3 className="text-white font-bold text-lg mb-2">{t.logout}?</h3>
                        <p className="text-xs text-slate-400 mb-6">
                            {lang === 'zh' ? '登出後將清除本機資料以保護隱私。您的交易紀錄在雲端是安全的。' : 'You are about to sign out. Local data will be cleared for security.'}
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 text-xs font-bold hover:bg-white/10 transition-colors">
                                {lang === 'zh' ? '取消' : 'Cancel'}
                            </button>
                            <button
                                onClick={async () => {
                                    try { await triggerCloudBackup(); } catch (_) {} // 1. BACKUP TO CLOUD first
                                    try { await actions.clearLocalData(); } catch (_) {} // 2. WIPE LOCAL
                                    onLogout();               // 3. SIGN OUT
                                    setShowLogoutConfirm(false);
                                }}
                                className="flex-1 py-3 rounded-xl bg-[#C8B085] text-black text-xs font-bold hover:bg-[#B09870] transition-colors"
                            >
                                {lang === 'zh' ? '確認登出' : 'Sign Out'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Conflict Modal — conditional render so internal state
                resets between sessions. 永遠 mount 會讓 modal 自己的 useState
                跨 session 殘留前次未完成的選擇。 */}
            {isImportModalOpen && (
                <ImportConflictModal
                    isOpen={isImportModalOpen}
                    onResolve={actions.resolveImportConflict}
                    lang={lang}
                    conflicts={importConflicts}
                    incomingTotal={incomingImportCount}
                />
            )}
        </div>
    );
};
