
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, Calendar as CalendarIcon, CheckCircle2, AlertTriangle, ShieldCheck, MessageSquare, Check, CalendarDays } from 'lucide-react';
import { Trade, BrokerConfig, Portfolio } from '../../types';
import { fetchBrokerPnl, fetchBrokerProfile, pingBackend } from '../../services/brokerService';
import { getLocalDateStr } from '../../utils/format';
import { CustomDateRangeModal } from './CustomDateRangeModal';

interface WizardProps {
    isOpen: boolean;
    onClose: () => void;
    currentDate: Date;
    configs: BrokerConfig[];
    activeId: string;
    onUpdateBroker: (id: string, c: BrokerConfig) => void;
    portfolios: Portfolio[];
    activePortfolioIds: string[];
    strategies: string[];
    emotions: string[];
    existingTrades: Trade[];
    onSuccess: (transactions: ImportTransaction[]) => void;
    lang: 'zh' | 'en';
}

export interface ImportTransaction {
    id: string; // temp id
    date: string;
    code: string;
    pnl: number;
    portfolioId: string;
    strategy: string;
    emotion: string;
    note: string;
    selected: boolean;
    isDuplicate?: boolean; // New flag
    showNoteInput?: boolean; 
    // New fields from Broker detail
    category?: string;
    quantity?: number;
    price?: number;
    buyAmt?: number;
    sellAmt?: number;
    yield?: number;
    orderNo?: string;
    currency?: string;
}

export const SyncDateModal = ({ isOpen, onClose, currentDate, configs, activeId, onUpdateBroker, portfolios, activePortfolioIds, strategies, emotions, existingTrades, onSuccess, lang }: WizardProps) => {
    // Portals can be tricky during hydration or rapid unmounting.
    const [shouldRender, setShouldRender] = useState(isOpen);

    useEffect(() => {
        if (isOpen) setShouldRender(true);
        else setShouldRender(false);
    }, [isOpen]);

    // Wizard State
    const [step, setStep] = useState<1 | 2>(1);
    
    // Step 1: Config
    const [startDate, setStartDate] = useState(getLocalDateStr());
    const [endDate, setEndDate] = useState(getLocalDateStr());
    const [targetPortfolioId, setTargetPortfolioId] = useState(activePortfolioIds[0] || portfolios[0]?.id || 'main');
    const [selectedConfigIds, setSelectedConfigIds] = useState<string[]>(activeId ? [activeId] : (configs[0] ? [configs[0].id] : []));
    const [showCalendar, setShowCalendar] = useState(false);
    
    // Backend Status
    const [backendStatus, setBackendStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
    
    // Step 2: Data
    const [transactions, setTransactions] = useState<ImportTransaction[]>([]);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [resultMsg, setResultMsg] = useState('');

    const toggleConfigSelection = (id: string) => {
        setSelectedConfigIds(prev => 
            prev.includes(id) 
                ? prev.filter(item => item !== id)
                : [...prev, id]
        );
    };

    // Reset on Open & Auto Ping
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setStatus('idle');
            setResultMsg('');
            setTransactions([]);
            setSelectedConfigIds(activeId ? [activeId] : (configs[0] ? [configs[0].id] : []));
            
            // Auto Ping Backend
            const ping = async () => {
                setBackendStatus('checking');
                const isOnline = await pingBackend();
                setBackendStatus(isOnline ? 'online' : 'offline');
            };
            ping();
        } else {
            setBackendStatus('idle');
        }
    }, [isOpen, activeId, configs]);

    const handleFetch = async () => {
        if (selectedConfigIds.length === 0) return;
        setStatus('loading');
        setResultMsg('');
        
        const selectedConfigs = configs.filter(c => selectedConfigIds.includes(c.id));
        let allMapped: ImportTransaction[] = [];
        let loginErrors: string[] = [];

        try {
            for (let config of selectedConfigs) {
                let currentConfig = { ...config };
                
                // 1. 若未連線，嘗試先執行登入 (Auto-Login attempt)
                if (!currentConfig.isConnected) {
                    try {
                        const profile = await fetchBrokerProfile(currentConfig);
                        if (currentConfig.provider === 'shioaji' && profile.environment !== 'production') {
                            loginErrors.push(`${config.alias || config.brokerUsername || '帳號'}: 環境錯誤（需要 production）`);
                            continue;
                        }
                        if (!profile.username || !profile.branchCode) {
                            loginErrors.push(`${config.alias || config.brokerUsername || '帳號'}: 帳戶資訊不完整`);
                            continue;
                        }
                        currentConfig = {
                            ...currentConfig,
                            isConnected: true,
                            brokerUsername: profile.username,
                            branch: profile.branch,
                            environment: profile.environment
                        };
                        onUpdateBroker(currentConfig.id, currentConfig);
                    } catch (e: any) {
                        const errorMsg = e?.message || String(e) || '未知錯誤';
                        loginErrors.push(`${config.alias || config.brokerUsername || '帳號'}: ${errorMsg}`);
                        console.error(`Login failed for ${currentConfig.id}:`, e);
                        continue;
                    }
                }

                // 2. 執行 P&L 抓取
                try {
                    const startObj = new Date(startDate);
                    const endObj = new Date(endDate);
                    const result = await fetchBrokerPnl(startObj, endObj, currentConfig);
                    
                    const mapped: ImportTransaction[] = result.details.map((d, idx) => {
                        const yieldStr = (d.yield >= 0 ? '+' : '') + d.yield + '%';
                        const lots = (d.quantity || 0) / 1000;
                        const leanCode = d.code.replace(/\s+/g, '');
                        const isDuplicate = existingTrades.some(t => t.date === d.date && t.pnl === d.pnl);

                        return {
                            id: `import-${d.date}-${d.orderNo || d.code}-${d.pnl}-${idx}-${currentConfig.id}`, 
                            date: d.date,
                            code: d.code,
                            pnl: d.pnl,
                            portfolioId: targetPortfolioId,
                            strategy: '',
                            emotion: '',
                            note: `${leanCode} | ${yieldStr} | ${lots}張`,
                            selected: !isDuplicate,
                            isDuplicate,
                            showNoteInput: false,
                            category: d.category,
                            quantity: d.quantity,
                            price: d.price,
                            buyAmt: d.buyAmt,
                            sellAmt: d.sellAmt,
                            yield: d.yield,
                            orderNo: d.orderNo,
                            currency: d.currency
                        };
                    });
                    allMapped = [...allMapped, ...mapped];
                } catch (e: any) {
                    const errorMsg = e?.message || String(e) || '未知錯誤';
                    loginErrors.push(`${config.alias || config.brokerUsername || '帳號'} 資料抓取失敗: ${errorMsg}`);
                    console.error(`P&L fetch failed for ${currentConfig.id}:`, e);
                }
            }

            // 如果有登入錯誤，顯示給用戶
            if (loginErrors.length > 0) {
                setStatus('error');
                setResultMsg(loginErrors.join('\n'));
                // 如果有成功的資料，繼續顯示
                if (allMapped.length > 0) {
                    setTransactions(allMapped);
                    setStep(2);
                    setStatus('idle');
                }
                return;
            }

            if (allMapped.length === 0 && selectedConfigs.some(c => !c.isConnected)) {
                throw new Error(lang === 'zh' ? '尚未完成券商連線驗證' : 'Broker connection not verified.');
            }

            setTransactions(allMapped);
            setStep(2);
            setStatus('idle');

        } catch (err: any) {
            setStatus('error');
            const errorMessage = err?.message || String(err) || 'Unknown Error';
            setResultMsg(errorMessage);
            console.error('Sync error:', err);
        }
    };

    const handleConfirmImport = () => {
        const selected = transactions.filter(t => t.selected);
        onSuccess(selected);
        onClose();
    };

    const toggleSelection = (id: string) => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
    };

    const updateTxField = (id: string, field: 'strategy' | 'emotion' | 'note' | 'showNoteInput', value: any) => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const formatMoney = (n: number) => n.toLocaleString();

    if (!shouldRender) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                className={`w-full ${step === 2 ? 'max-w-2xl' : 'max-w-md'} bg-[#1C1E22] rounded-3xl border border-white/10 shadow-3xl overflow-hidden relative transition-all duration-300 mx-4`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''}/>
                        {step === 1 ? '匯入設定 (IMPORT SETUP)' : '交易檢核 (REVIEW)'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><X size={18} className="text-slate-400"/></button>
                </div>

                <div className="p-7">
                    {/* STEP 1: CONFIG */}
                    {step === 1 && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-3 duration-300">
                            
                            {/* Portfolio Setup */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1 h-3 bg-[#C8B085] rounded-full"></div>
                                    匯入帳戶 (TARGET PORTFOLIO)
                                </label>
                                <select 
                                    value={targetPortfolioId}
                                    onChange={(e) => setTargetPortfolioId(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:border-[#C8B085] transition-all appearance-none cursor-pointer"
                                >
                                    {portfolios.map(p => (
                                        <option key={p.id} value={p.id} className="bg-[#1C1E22] text-white">{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Date Selection */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1 h-3 bg-[#C8B085] rounded-full"></div>
                                    日期範圍 (DATE RANGE)
                                </label>
                                <button 
                                    onClick={() => setShowCalendar(true)}
                                    className="w-full bg-black/20 border border-white/10 rounded-2xl px-5 py-4 flex items-center justify-between group hover:bg-white/[0.02] transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-[#C8B085]/10 flex items-center justify-center text-[#C8B085]">
                                            <CalendarDays size={20}/>
                                        </div>
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">SELECTED PERIOD</span>
                                            <div className="text-sm font-bold text-white font-barlow-numeric tracking-wide">
                                                {startDate} <span className="text-slate-600 mx-2">➔</span> {endDate}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] text-slate-400 font-bold group-hover:bg-white/10 transition-colors">
                                        CHANGE
                                    </div>
                                </button>
                            </div>

                            {/* Accounts Selection */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1 h-3 bg-[#C8B085] rounded-full"></div>
                                    選擇券商帳號 (SELECT ACCOUNT)
                                </label>
                                <div className="space-y-2">
                                    {configs.map(config => (
                                        <div 
                                            key={config.id}
                                            onClick={() => toggleConfigSelection(config.id)}
                                            className={`p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${selectedConfigIds.includes(config.id) ? 'bg-[#C8B085]/10 border-[#C8B085]/40 shadow-[0_0_20px_rgba(200,176,133,0.05)]' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all flex items-center justify-center ${selectedConfigIds.includes(config.id) ? 'bg-[#C8B085] border-[#C8B085] shadow-[0_0_10px_rgba(200,176,133,0.4)]' : 'bg-transparent border-white/10'}`}>
                                                    {selectedConfigIds.includes(config.id) && <Check size={10} className="text-black stroke-[4]"/>}
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    {/* Top Line: Broker - Branch */}
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-bold tracking-wide ${selectedConfigIds.includes(config.id) ? 'text-white' : 'text-slate-400'}`}>
                                                            {config.provider === 'shioaji' ? '永豐金' : 'Broker'} - {config.branch || (lang === 'zh' ? '未知分公司' : 'Unknown Branch')}
                                                        </span>
                                                        {config.isConnected && (
                                                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-black text-[8px] uppercase tracking-tighter border border-emerald-500/20">已驗證</span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Bottom Line: Name | Person ID */}
                                                    <div className="text-[10px] text-zinc-500 font-bold flex items-center gap-1.5 mt-0.5 font-mono">
                                                        <span className="text-zinc-400">
                                                            {(() => {
                                                                const name = config.alias || config.brokerUsername || 'User';
                                                                if (name.includes('永豐金')) {
                                                                    return name.split('永豐金')[0].trim();
                                                                }
                                                                return name;
                                                            })()}
                                                        </span>
                                                        <span className="opacity-30">|</span>
                                                        <span className="text-zinc-500">{config.personId}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {selectedConfigIds.includes(config.id) && <ShieldCheck className="text-[#C8B085]" size={18}/>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                             
                            {/* Error or Login Prompt */}
                            {(selectedConfigIds.length > 0 && resultMsg) && (
                                <div className={`p-4 border rounded-2xl text-[11px] font-bold flex items-center gap-3 animate-in fade-in duration-300 bg-red-500/10 border-red-500/20 text-red-400`}>
                                    <AlertTriangle size={16}/> 
                                    {resultMsg}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: REVIEW */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="max-h-[350px] overflow-y-auto pr-3 space-y-3 custom-scrollbar">
                                {transactions.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500 text-sm font-bold opacity-50">此區間無交易紀錄 (NO TRADES FOUND)</div>
                                ) : (
                                    transactions.map(tx => (
                                        <div key={tx.id} className="space-y-2">
                                            <div className={`p-4 rounded-2xl border transition-all flex items-center gap-4 ${
                                                !tx.selected ? 'bg-transparent border-white/5 opacity-60 grayscale-[40%] scale-[0.98]' : 
                                                tx.isDuplicate ? 'bg-amber-500/10 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]' : 
                                                'bg-white/[0.03] border-white/10'
                                            }`}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={tx.selected} 
                                                    onChange={() => toggleSelection(tx.id)}
                                                    className={`w-5 h-5 rounded-lg border-white/20 bg-black/40 focus:ring-0 cursor-pointer ${tx.isDuplicate ? 'text-amber-500' : 'text-[#C8B085]'}`}
                                                />
                                                
                                                <div className="flex flex-col min-w-[140px] shrink-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-[9px] text-slate-500 font-black tracking-tighter whitespace-nowrap">{tx.date}</span>
                                                        {tx.isDuplicate && (
                                                            <span className="bg-amber-500/20 text-amber-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-amber-500/20 animate-pulse whitespace-nowrap">可能重複</span>
                                                        )}
                                                    </div>
                                                    <span className="text-sm font-bold text-white truncate drop-shadow-sm leading-tight">{tx.code}</span>
                                                </div>

                                                <div className={`w-28 font-barlow-numeric font-black text-right text-lg ${tx.pnl >= 0 ? 'text-[#D05A5A]' : 'text-[#5B9A8B]'}`}>
                                                    {formatMoney(tx.pnl)}
                                                </div>

                                                <div className="flex-1 flex gap-2 items-center">
                                                    <select 
                                                        value={tx.strategy} 
                                                        onChange={(e) => updateTxField(tx.id, 'strategy', e.target.value)}
                                                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#C8B085]"
                                                    >
                                                        <option value="">策略...</option>
                                                        {strategies.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                    <select 
                                                        value={tx.emotion} 
                                                        onChange={(e) => updateTxField(tx.id, 'emotion', e.target.value)}
                                                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white outline-none focus:border-[#C8B085]"
                                                    >
                                                        <option value="">標籤...</option>
                                                        {emotions.map(e => <option key={e} value={e}>{e}</option>)}
                                                    </select>
                                                    <button 
                                                        onClick={() => updateTxField(tx.id, 'showNoteInput', !tx.showNoteInput)}
                                                        className={`p-2 rounded-xl transition-all border ${tx.showNoteInput ? 'bg-[#C8B085] text-black border-[#C8B085]' : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10'}`}
                                                    >
                                                        <MessageSquare size={14}/>
                                                    </button>
                                                </div>
                                            </div>

                                            {tx.showNoteInput && (
                                                <div className="px-5 pb-3 animate-in slide-in-from-top-2 duration-200">
                                                    <input 
                                                        type="text"
                                                        value={tx.note}
                                                        onChange={(e) => updateTxField(tx.id, 'note', e.target.value)}
                                                        placeholder="輸入自定義備註..."
                                                        className="w-full bg-white/5 border border-[#C8B085]/30 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none focus:border-[#C8B085] transition-all"
                                                        autoFocus
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            {/* Summary */}
                            <div className="pt-5 border-t border-white/5 flex justify-between items-center px-2">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    匯入筆數: <span className="text-white font-black ml-1">{transactions.filter(t => t.selected).length}</span>
                                </div>
                                <div className="text-lg font-black font-barlow-numeric text-white flex gap-3 items-baseline">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">TOTAL</span>
                                    <span className={`${transactions.filter(t=>t.selected).reduce((sum,t)=>sum+t.pnl,0) >= 0 ? 'text-[#D05A5A]' : 'text-[#5B9A8B]'}`}>
                                        ${formatMoney(transactions.filter(t => t.selected).reduce((sum, t) => sum + t.pnl, 0))}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/5 flex justify-between items-center bg-black/30">
                    <div className="flex items-center gap-2">
                        {step === 1 && (
                            <>
                                {backendStatus === 'checking' && <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono animate-pulse"><div className="w-1.5 h-1.5 rounded-full bg-zinc-500"/>CONNECTING...</div>}
                                {backendStatus === 'online' && <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-mono"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"/>ONLINE</div>}
                                {backendStatus === 'offline' && <div className="flex items-center gap-1.5 text-[10px] text-red-500 font-mono"><div className="w-1.5 h-1.5 rounded-full bg-red-500"/>OFFLINE</div>}
                            </>
                        )}
                    </div>

                    <div className="flex gap-3">
                    {step === 2 && (
                        <button 
                            onClick={() => setStep(1)}
                            className="px-6 py-2.5 rounded-2xl text-slate-500 hover:text-white font-black text-[10px] uppercase tracking-widest transition-colors"
                        >
                            BACK
                        </button>
                    )}

                    <button 
                        onClick={step === 1 ? handleFetch : handleConfirmImport}
                        disabled={status === 'loading'}
                        className="px-8 py-3 rounded-2xl bg-[#C8B085] hover:bg-[#B09870] text-black font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg shadow-[#C8B085]/10 active:scale-95"
                    >
                        {status === 'loading' ? 'FETCHING...' : step === 1 ? 'LOGIN & SYNC' : 'CONFIRM IMPORT'}
                        {!status.includes('loading') && <CheckCircle2 size={14}/>}
                    </button>
                    </div>
                </div>
            </div>

            {/* Date Range Modal */}
            <CustomDateRangeModal 
                isOpen={showCalendar}
                onClose={() => setShowCalendar(false)}
                onApply={(start, end) => {
                    if (start) setStartDate(start);
                    if (end) setEndDate(end);
                    setShowCalendar(false);
                }}
                initialRange={{ start: startDate, end: endDate }}
                lang={lang}
            />
        </div>
    );

    // Using a more stable check for document body
    if (typeof document === 'undefined') return null;

    return createPortal(modalContent, document.body);
};
