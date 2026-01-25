
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, Calendar as CalendarIcon, CheckCircle2, AlertTriangle, ShieldCheck, MessageSquare, Check, CalendarDays, ChevronDown, ChevronRight, Copy, Wifi, Power } from 'lucide-react';
import { Trade, BrokerConfig, Portfolio } from '../../types';
import { fetchBrokerPnl, fetchBrokerProfile, pingBackend } from '../../services/brokerService';
import { getLocalDateStr, formatDateWithWeekday } from '../../utils/format';
import { CustomDateRangeModal } from './CustomDateRangeModal';
import { useClickOutside } from '../../hooks/useClickOutside';
import { GlassSelect } from '../common/GlassSelect';

// --- Interfaces ---
interface SyncDateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (trades: Trade[]) => void;
    lang?: 'zh' | 'en';
    existingTrades?: Trade[];
}

// --- Internal Component: GlassSelect Moved to common/GlassSelect.tsx ---

export const SyncDateModal: React.FC<SyncDateModalProps> = ({ isOpen, onClose, onSuccess, lang = 'zh', existingTrades = [] }) => {
    // --- State ---
    const [step, setStep] = useState<1 | 2>(1);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [resultMsg, setResultMsg] = useState('');
    
    // Dates
    const today = getLocalDateStr(new Date());
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [showCalendar, setShowCalendar] = useState(false);

    // Data
    const [configs, setConfigs] = useState<BrokerConfig[]>([]);
    const [selectedConfigIds, setSelectedConfigIds] = useState<string[]>([]);
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [targetPortfolioId, setTargetPortfolioId] = useState<string>('');
    const [transactions, setTransactions] = useState<any[]>([]); // Need Trade type + selected

    // Consts (Mock)
    const strategies = ['動能突破', '急殺抄底', '波段趨勢', '當沖'];
    const emotions = ['FOMO', '冷靜', '猶豫', '貪婪'];

    // --- Effects ---
    useEffect(() => {
        if (isOpen) {
            // Load Configs
            try {
                const savedConfigs = localStorage.getItem('broker_configs');
                if (savedConfigs) {
                    const parsed = JSON.parse(savedConfigs);
                    setConfigs(parsed);
                    if (parsed.length > 0) setSelectedConfigIds([`${parsed[0].id}-0`]);
                }
                
                // Load Portfolios
                const savedPortfolios = localStorage.getItem('portfolios'); // Assuming this key
                if (savedPortfolios) {
                    const parsedP = JSON.parse(savedPortfolios);
                    setPortfolios(parsedP);
                    if (parsedP.length > 0) setTargetPortfolioId(parsedP[0].id);
                } else {
                    // Fallback Mock
                     setPortfolios([{ id: 'main', name: 'Main Account', initialCapital: 100000, profitColor: '#D05A5A', lossColor: '#5B9A8B' }]);
                     setTargetPortfolioId('main');
                }

                // Check Backend
                handleManualPing();
            } catch (e) {
                console.error("Error loading initial data", e);
            }
        } else {
            // Reset
            setStep(1);
            setStatus('idle');
            setTransactions([]);
        }
    }, [isOpen]);

    // --- Handlers ---
    const handleManualPing = async () => {
        setBackendStatus('checking');
        const isOnline = await pingBackend();
        setBackendStatus(isOnline ? 'online' : 'offline');
    };

    const toggleConfigSelection = (id: string, idx: number) => {
        const key = `${id}-${idx}`;
        setSelectedConfigIds(prev => {
            if (prev.includes(key)) return prev.filter(k => k !== key);
            return [...prev, key]; // Allow multiple? For now yes.
        });
    };

    const formatMoney = (val: number) => val.toLocaleString();

    const updateTxField = (id: string, field: string, val: any) => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, [field]: val } : t));
    };
    
    const toggleSelection = (id: string) => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
    };

    const handleFetch = async () => {
        if (selectedConfigIds.length === 0) {
            setResultMsg("請至少選擇一個券商帳號");
            return;
        }

        setStatus('loading');
        setResultMsg('');

        try {
            // 找出選中的 config
            // Note: uniqueKey is id-idx, we map back to config
            const selectedKeys = selectedConfigIds.map(k => k.split('-')[0]);
            const targetConfig = configs.find(c => selectedKeys.includes(c.id));
            
            if (!targetConfig) throw new Error("無效的帳號設定");

            // 呼叫後端
            const startD = new Date(startDate);
            const endD = new Date(endDate);
            const result = await fetchBrokerPnl(startD, endD, targetConfig);

            // 處理結果
            // 處理結果 & 重複判斷
            // 處理結果 & 重複判斷
            const mappedTrades = result.details.map((d, i) => {
                // User Request: 個股名稱 | 損益%數 | 買賣張數
                // format: 2890 永豐金 | 1.51% | 5張
                // d.code has format "2890 Name". We use it as is or split it? User screenshot implies full name.
                const sheets = d.quantity ? (d.quantity / 1000).toFixed(0) : '0';
                const yieldStr = d.yield ? `${d.yield > 0 ? '+' : ''}${d.yield}%` : '0%';
                
                // Auto Note Format: [Code] Name | Yield% | Sheets 
                // e.g. [2890 永豐金] | +1.51% | 5張
                // Wait, user said: "個股名稱 | 損益%數 | 買賣張數"
                // Let's use `${d.code} | ${yieldStr} | ${sheets}張`
                const autoNote = `${d.code} | ${yieldStr} | ${sheets}張`.trim();

                // Advanced Deduplication Logic
                let isDup = false;
                let dupReason = '';
                
                if (existingTrades && existingTrades.length > 0) {
                     // Try to find the BEST match
                     // Priority 1: Exact Order ID Match (High Confidence)
                     const orderMatch = existingTrades.find(e => 
                        d.orderNo && (e.orderNo === d.orderNo || e.note?.includes(d.orderNo))
                     );
                     
                     if (orderMatch) {
                         isDup = true;
                         dupReason = `單號重複`;
                     } else {
                         // Priority 2: Date + PnL + Code Match (Medium Confidence)
                         const codeMatch = existingTrades.find(e => 
                            e.date === d.date && 
                            Math.abs(e.pnl - d.pnl) < 0.1 && 
                            (e.note?.includes(d.code) || e.note?.includes(`[${d.code}]`))
                         );
                         
                         if (codeMatch) {
                             isDup = true;
                             dupReason = `金額與代碼重複`;
                         } else {
                             // Priority 3: Date + PnL Match (Low Confidence)
                             const pnlMatch = existingTrades.find(e => 
                                e.date === d.date && 
                                Math.abs(e.pnl - d.pnl) < 0.1
                             );
                             
                             if (pnlMatch) {
                                 isDup = true;
                                 dupReason = `日期與金額相同`;
                             }
                         }
                     }
                }
                
                return {
                    id: `tx-${Date.now()}-${i}`,
                    date: d.date,
                    orderNo: d.orderNo, // ✅ Stored but not in note
                    code: d.code,
                    pnl: d.pnl,
                    price: d.price,
                    quantity: d.quantity,
                    side: d.quantity > 0 ? 'Buy' : 'Sell',
                    selected: !isDup, // Default key to UNCHECKED if duplicate
                    isDuplicate: isDup,
                    duplicateReason: dupReason,
                    portfolioId: targetPortfolioId,
                    strategy: '',
                    emotion: '',
                    note: autoNote, // Clean note: Name | % | Vol
                    showNoteInput: false
                };
            });

            setTransactions(mappedTrades);
            setStatus('idle');
            if (mappedTrades.length === 0) {
                setResultMsg("此區間無交易紀錄");
            } else {
                setStep(2);
            }

        } catch (e: any) {
            console.error("Fetch Error:", e);
            setStatus('error');
            setResultMsg(e.message || "同步失敗，請確認後端連線或憑證");
        }
    };

    const handleConfirmImport = () => {
        const finalTrades = transactions.filter(t => t.selected);
        if (onSuccess) onSuccess(finalTrades);
        onClose();
    };


    if (!isOpen) return null;
    if (typeof document === 'undefined') return null;

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0A0B0F]/85 backdrop-blur-2xl animate-in fade-in duration-300 p-4 overflow-hidden">
            {/* Ambient Background Flares (Design Premium Touch) */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#C8B085]/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#D05A5A]/5 rounded-full blur-[100px] pointer-events-none" />

            <div 
                className={`relative w-full ${step === 2 ? 'max-w-4xl' : 'max-w-md'} bg-[#14161B]/90 rounded-[40px] border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.6)] backdrop-blur-3xl transition-all duration-500 flex flex-col my-auto overflow-hidden animate-in zoom-in-95`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02] rounded-t-3xl">
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
                            {/* Date Selection */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1 h-3 bg-[#C8B085] rounded-full"></div>
                                        日期範圍 (DATE RANGE)
                                    </label>
                                    <div className="flex gap-1">
                                        {[5, 10, 20, 30].map(days => {
                                            const today = new Date();
                                            const past = new Date();
                                            past.setDate(today.getDate() - days + 1);
                                            const rangeStart = getLocalDateStr(past);
                                            const rangeEnd = getLocalDateStr(today);
                                            const isActive = startDate === rangeStart && endDate === rangeEnd;

                                            return (
                                                <button
                                                    key={days}
                                                    onClick={() => {
                                                        setEndDate(rangeEnd);
                                                        setStartDate(rangeStart);
                                                    }}
                                                    className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all font-barlow-numeric border ${
                                                        isActive 
                                                            ? 'bg-[#C8B085] text-black border-[#C8B085]' 
                                                            : 'bg-white/5 border-white/5 hover:bg-[#C8B085] hover:text-black hover:border-[#C8B085] text-slate-500'
                                                    }`}
                                                >
                                                    {days}D
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowCalendar(true)}
                                    className="w-full bg-[#1C1E22]/35 backdrop-blur-xl backdrop-saturate-150 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-2xl px-5 py-4 flex items-center justify-between group hover:bg-white/[0.05] transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-[#C8B085]/10 flex items-center justify-center text-[#C8B085]">
                                            <CalendarDays size={20}/>
                                        </div>
                                        <div className="flex flex-col items-start gap-1">
                                            <div className="text-sm font-bold text-white font-barlow-numeric tracking-wide">
                                                {startDate} <span className="text-slate-600 mx-2">➔</span> {endDate}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors group-hover:scale-110 duration-300">
                                        <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
                                    </div>
                                </button>
                            </div>

                            {/* Accounts Selection */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1 h-3 bg-[#C8B085] rounded-full"></div>
                                        選擇券商帳號 (SELECT ACCOUNT)
                                    </label>
                                    
                                    <button
                                        onClick={handleManualPing}
                                        disabled={backendStatus === 'checking'}
                                        className={`
                                            flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold transition-all
                                            ${backendStatus === 'online' 
                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 cursor-default' 
                                                : backendStatus === 'checking'
                                                    ? 'bg-slate-500/10 border-slate-500/20 text-slate-400 cursor-wait'
                                                    : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer active:scale-95'
                                            }
                                        `}
                                    >
                                        {backendStatus === 'checking' && <RefreshCw size={8} className="animate-spin"/>}
                                        {backendStatus === 'online' && <Wifi size={8}/>}
                                        {backendStatus === 'offline' && <Power size={8}/>}
                                        
                                        <span>
                                            {backendStatus === 'online' ? '已連線 (ONLINE)' : 
                                             backendStatus === 'checking' ? '連線中...' : 
                                             '喚醒後端 (WEAK UP)'}
                                        </span>
                                    </button>
                                </div>
                                    {configs.map((config, idx) => {
                                        const uniqueKey = `${config.id}-${idx}`;
                                        const isSelected = selectedConfigIds.includes(uniqueKey);
                                        return (
                                        <div 
                                            key={uniqueKey}
                                            onClick={() => toggleConfigSelection(config.id, idx)}
                                            className={`
                                                p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer backdrop-blur-xl backdrop-saturate-150
                                                ${isSelected 
                                                    ? 'bg-[#C8B085]/10 border-[#C8B085]/40 shadow-[0_0_20px_rgba(200,176,133,0.05),inset_0_1px_1px_rgba(255,255,255,0.1)]' 
                                                    : 'bg-[#1C1E22]/35 border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:bg-white/[0.05] hover:border-white/20'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all flex items-center justify-center ${isSelected ? 'bg-[#C8B085] border-[#C8B085] shadow-[0_0_10px_rgba(200,176,133,0.4)]' : 'bg-transparent border-white/10'}`}>
                                                    {isSelected && <Check size={10} className="text-black stroke-[4]"/>}
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-bold tracking-wide ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                                            {config.provider === 'shioaji' ? '永豐金' : 'Broker'} - {config.branch || (lang === 'zh' ? '未知分公司' : 'Unknown Branch')}
                                                        </span>
                                                        {config.isConnected && (
                                                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-black text-[8px] uppercase tracking-tighter border border-emerald-500/20">已驗證</span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="text-[10px] text-zinc-500 font-bold flex items-center gap-1.5 mt-0.5 font-mono">
                                                        <span className="text-zinc-400">
                                                            {(() => {
                                                                // Clean up name by removing 【】 or [] and specific branding if needed
                                                                const rawName = config.alias || config.brokerUsername || 'User';
                                                                // Use formatting similar to "Tan Meijuan" without brackets
                                                                return rawName.replace(/[【】\[\]]/g, '').replace('永豐金', '').trim();
                                                            })()}
                                                        </span>
                                                        <span className="opacity-30">|</span>
                                                        <span className="text-zinc-500">{config.personId}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {isSelected && <ShieldCheck className="text-[#C8B085]" size={18}/>}
                                        </div>
                                        );
                                    })}
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
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            {/* Target Portfolio Selector */}
                            <div className="bg-black/20 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[#C8B085]/10 flex items-center justify-center text-[#C8B085]">
                                        <ShieldCheck size={16}/>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">匯入至帳戶 (TARGET PORTFOLIO)</span>
                                        <span className="text-xs font-bold text-white">Default: {portfolios.find(p => p.id === targetPortfolioId)?.name}</span>
                                    </div>
                                </div>
                                <div className="w-[150px]">
                                    <GlassSelect
                                        value={targetPortfolioId}
                                        onChange={(val) => {
                                            setTargetPortfolioId(val);
                                            setTransactions(prev => prev.map(t => ({ ...t, portfolioId: val })));
                                        }}
                                        options={portfolios.map(p => ({ value: p.id, label: p.name }))}
                                        variant="standard"
                                    />
                                </div>
                            </div>

                            <div className="max-h-[350px] overflow-y-auto pr-3 space-y-3 custom-scrollbar">
                                {transactions.length === 0 ? (
                                    <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-500/40">
                                        <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                                            <CalendarDays size={24} className="opacity-20" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[11px] font-black tracking-widest uppercase">No Data Found</p>
                                            <p className="text-[10px] font-medium mt-1">此區間無同步交易紀錄</p>
                                        </div>
                                    </div>
                                ) : (
                                    transactions.map(tx => (
                                        <div key={tx.id} className="space-y-1">
                                            <div className={`px-2.5 py-2.5 rounded-2xl border transition-all flex items-center gap-2 relative overflow-hidden ${
                                                !tx.selected 
                                                    ? 'bg-black/20 border-white/5 opacity-40 grayscale-[100%] hover:opacity-60 transition-opacity' // Unselected
                                                    : tx.isDuplicate 
                                                        ? 'bg-amber-500/5 border-amber-500/20 shadow-[inset_0_0_20px_rgba(245,158,11,0.02)]' 
                                                        : 'bg-[#1C1E22]/50 border-white/10 shadow-lg shadow-black/25'
                                            }`}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={tx.selected} 
                                                    onChange={() => toggleSelection(tx.id)}
                                                    className={`w-4 h-4 rounded-md border-white/20 bg-black/40 focus:ring-0 cursor-pointer shrink-0 transition-all ${tx.selected && tx.isDuplicate ? 'text-amber-500 border-amber-500/50' : 'text-[#C8B085] border-[#C8B085]/30'}`}
                                                />
                                                
                                                {/* Meta Info: Identity Group */}
                                                <div className="flex items-center gap-2.5 min-w-0 shrink-0">
                                                    {/* Column 1: Priority Status & Date */}
                                                    <div className="flex flex-col items-start gap-1 min-w-[62px] shrink-0">
                                                        {tx.isDuplicate ? (
                                                            <span className="bg-amber-500 text-black text-[7px] px-1.2 rounded-[3px] font-black whitespace-nowrap tracking-tighter leading-none py-0.5 shadow-sm">
                                                                可能重複
                                                            </span>
                                                        ) : (
                                                            <div className="h-[10px]" />
                                                        )}
                                                        <span className="text-[9px] text-zinc-400 font-bold tracking-tighter shrink-0 leading-none">
                                                            {formatDateWithWeekday(tx.date).split('(')[0].slice(5)} ({formatDateWithWeekday(tx.date).split('(')[1]}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Column 2: Data Pill (Stock & PnL) */}
                                                    <div className="flex items-center gap-2 min-w-0 bg-white/5 px-2.5 py-1 rounded-xl border border-white/10 h-[28px]">
                                                        <span className="text-[11px] font-black text-white truncate max-w-[55px] tracking-tight">{tx.code.split(' ')[1] || tx.code}</span>
                                                        <div className="w-[1.5px] h-3 bg-white/10 shrink-0" />
                                                        <span className={`text-[11px] font-black font-barlow-numeric tracking-tight ${tx.pnl >= 0 ? 'text-[#D05A5A]' : 'text-[#5B9A8B]'}`}>
                                                            {tx.pnl >= 0 ? '+' : ''}{formatMoney(tx.pnl)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Configuration Area (Flexible Action Group) */}
                                                <div className="flex-1 flex items-center gap-1 min-w-0 justify-end overflow-hidden">
                                                    {/* Account - Stable but can shrink */}
                                                    <div className="min-w-[70px] flex-shrink-0">
                                                        <GlassSelect 
                                                            value={tx.portfolioId || targetPortfolioId}
                                                            onChange={(val) => updateTxField(tx.id, 'portfolioId', val)}
                                                            options={portfolios.map(p => ({ value: p.id, label: p.name }))}
                                                            placeholder="帳號"
                                                            variant="capsule"
                                                            className="w-full"
                                                        />
                                                    </div>

                                                    {/* Strategy - Flexible Growth Priority */}
                                                    <div className="min-w-[50px] flex-1 flex-shrink min-w-0 max-w-[100px]">
                                                        <GlassSelect 
                                                            value={tx.strategy}
                                                            onChange={(val) => updateTxField(tx.id, 'strategy', val)}
                                                            options={[{value: '', label: '策略'}, ...strategies.map(s => ({ value: s, label: s }))]}
                                                            placeholder="策略"
                                                            variant="capsule"
                                                            className="w-full"
                                                        />
                                                    </div>

                                                    {/* Tag - Compact */}
                                                    <div className="min-w-[50px] flex-shrink-0">
                                                        <GlassSelect 
                                                            value={tx.tag}
                                                            onChange={(val) => updateTxField(tx.id, 'tag', val)}
                                                            options={[{value: '', label: '標籤'}, ...emotions.map(e => ({ value: e, label: e }))]}
                                                            placeholder="標籤"
                                                            variant="capsule"
                                                            className="w-full"
                                                        />
                                                    </div>

                                                    <button 
                                                        onClick={() => updateTxField(tx.id, 'showNoteInput', !tx.showNoteInput)}
                                                        className={`h-6 w-6 flex items-center justify-center rounded-lg transition-all border shrink-0 ${tx.showNoteInput ? 'bg-[#C8B085] text-black border-[#C8B085]' : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20 active:scale-95'}`}
                                                    >
                                                        <MessageSquare size={11}/>
                                                    </button>
                                                </div>
                                            </div>

                                            {tx.showNoteInput && (
                                                <div className="px-5 pb-2 animate-in slide-in-from-top-2 duration-200">
                                                    <input 
                                                        type="text"
                                                        value={tx.note}
                                                        onChange={(e) => updateTxField(tx.id, 'note', e.target.value)}
                                                        placeholder="輸入自定義備註..."
                                                        className="w-full bg-white/5 border border-[#C8B085]/30 rounded-xl px-4 py-2 text-[10px] text-slate-300 outline-none focus:border-[#C8B085] transition-all"
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
                                <button 
                                    onClick={handleManualPing}
                                    disabled={backendStatus === 'checking'}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-all disabled:opacity-50"
                                >
                                    <RefreshCw size={10} className={backendStatus === 'checking' ? 'animate-spin' : ''}/>
                                </button>
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
                        {status === 'loading' 
                            ? (lang === 'zh' ? '讀取中...' : 'FETCHING...') 
                            : step === 1 
                                ? (lang === 'zh' ? '登入並同步' : 'LOGIN & SYNC') 
                                : (lang === 'zh' ? '確認匯入' : 'CONFIRM IMPORT')}
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

    return createPortal(modalContent, document.body);
};
