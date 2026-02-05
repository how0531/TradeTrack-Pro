import React, { useState } from 'react';
import { Plus, X, Trash2, AlertCircle, FileKey, Check, Loader2, FolderOpen, ShieldCheck, BrainCircuit, RefreshCw, ChevronRight, ArrowDown } from 'lucide-react';
import { BrokerConfig } from '../../../types';
import { fetchBrokerProfile, pingBackend } from '../../../services/brokerService';
import { useEffect } from 'react';
import { ACCOUNT_CATEGORY_THEMES } from '../../../constants';

interface BrokerSettingsProps {
    configs: BrokerConfig[];
    onAdd: (c: BrokerConfig) => void;
    onUpdate: (id: string, c: BrokerConfig) => void;
    onDelete: (id: string) => void;
    lang: 'zh' | 'en';
}

export const BrokerSettings = ({ configs, onAdd, onUpdate, onDelete, lang }: BrokerSettingsProps) => {
    const [isEditing, setIsEditing] = useState<string | 'new' | null>(null);
    const [localConfig, setLocalConfig] = useState<BrokerConfig | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showSecrets, setShowSecrets] = useState(false);
    const [accountChoices, setAccountChoices] = useState<any[]>([]);
    
    // New state for backend health check
    const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    // Derived state for button type
    const [errors, setErrors] = useState<Record<string, boolean>>({});

    const emptyConfig: BrokerConfig = {
        id: '',
        provider: 'shioaji',
        apiKey: '',
        apiSecret: '',
        personId: '',
        caPath: '',
        caPassword: '',
        isConnected: false,
        environment: 'production'
    };

    // 自動喚醒 Render 後端 (由於免費版會休眠)
    useEffect(() => {
        if (isEditing) {
            const checkStatus = async () => {
                setBackendStatus('checking');
                const isOnline = await pingBackend();
                setBackendStatus(isOnline ? 'online' : 'offline');
            };
            checkStatus();
        } else {
            setBackendStatus('online'); // Default to online when idle in dev
        }
    }, [isEditing]);

    const handleManualPing = async () => {
        setBackendStatus('checking');
        const isOnline = await pingBackend();
        setBackendStatus(isOnline ? 'online' : 'offline');
    };

    const handleStartEdit = (id: string | 'new') => {
        if (id === 'new') {
            setLocalConfig({ ...emptyConfig, id: Math.random().toString(36).substr(2, 9) });
        } else {
            const config = configs.find(c => c.id === id);
            if (config) setLocalConfig({ ...config });
        }
        setIsEditing(id);
        setErrorMsg(null);
        setAccountChoices([]);
    };

    const handleChange = (key: keyof BrokerConfig, val: any) => {
        let finalVal = val;
        // 自動去除 API 相關欄位的前後空白
        if (['apiKey', 'apiSecret', 'personId', 'caPassword'].includes(key) && typeof val === 'string') {
            finalVal = val.trim();
        }
        if (localConfig) setLocalConfig({ ...localConfig, [key]: finalVal });
    };

    const handleSave = () => {
        if (!localConfig) return;
        if (isEditing === 'new') {
            onAdd(localConfig);
        } else if (typeof isEditing === 'string') {
            onUpdate(isEditing, localConfig);
        }
        setIsEditing(null);
        setLocalConfig(null);
    };

    const handleTestConnection = async () => {
        if (!localConfig) return;
        setIsTesting(true);
        setErrorMsg(null);
        setAccountChoices([]);

        // Validation
        const newErrors: Record<string, boolean> = {};
        if (!localConfig.personId) newErrors.personId = true;
        if (!localConfig.apiKey) newErrors.apiKey = true;
        if (!localConfig.apiSecret) newErrors.apiSecret = true;
        if (!localConfig.caPath) newErrors.caPath = true;
        if (!localConfig.caPassword) newErrors.caPassword = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setErrorMsg(lang === 'zh' ? '請填寫所有必填欄位' : 'Please fill in all required fields');
            setIsTesting(false);
            return;
        }
        setErrors({});

        try {
            const result = await fetchBrokerProfile(localConfig);
            
            if (result.status === 'multiple_accounts' && result.accounts) {
                setAccountChoices(result.accounts);
                setErrorMsg(lang === 'zh' ? "偵測到多個帳戶，請選擇一個分公司" : "Multiple accounts detected. Please select a branch.");
                setIsTesting(false);
                return;
            }

            if (result.environment !== 'production') {
                throw new Error(lang === 'zh' ? "僅支援正式環境 (Production)" : "Production required.");
            }

            const updated: BrokerConfig = {
                ...localConfig,
                isConnected: true,
                branch: result.branch || localConfig.branch,
                branchCode: result.branchCode,
                accounts: result.branchCode, // Standardize: use branchCode as the primary storage for acc IDs
                brokerUsername: result.username,
                environment: result.environment
            };
            
            setLocalConfig(updated);
            if (isEditing === 'new') onAdd(updated);
            else onUpdate(localConfig.id, updated);
            
            setIsEditing(null);
            setIsTesting(false);
            setAccountChoices([]);
        } catch (error: any) {
            let msg = error?.message || 'Connection failed';
            if (msg.includes('Failed to fetch')) {
                msg = lang === 'zh' 
                    ? "連線失敗：後端服務可能正在啟動中，請稍候 30 秒再試一次。" 
                    : "Connection failed: Backend service might be starting up. Please wait 30s and try again.";
                // 再次嘗試 ping 以確保喚醒
                pingBackend();
            }
            setErrorMsg(msg);
            setIsTesting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3">
                {configs.flatMap(config => {
                    const branches = (config.branch || 'Unknown').split(',');
                    // Assuming branchCode matches branch count and order if it exists, otherwise use empty or index
                    // Actually usually they are paired. Since I can't guarantee branchCode is stored as CSV properly in all legacy cases,
                    // I will rely on index binding. Ideally branchCode should be stored same way.
                    // For now, let's just use branch name and index for display.
                    
                    return branches.map((bRaw, idx) => {
                        const bText = bRaw.trim();
                        
                         // --- ROBUST IDENTIFICATION LOGIC (Dev Refactor) ---
                         const isFuture = bText.includes('期貨') || bText.includes('Futures');
                         const isSub = bText.includes('複委託') || bText.includes('Sub') || bText.includes('H-');
                         
                         const theme = isFuture 
                            ? ACCOUNT_CATEGORY_THEMES.FUTURES 
                            : isSub 
                                ? ACCOUNT_CATEGORY_THEMES.SUB 
                                : ACCOUNT_CATEGORY_THEMES.STOCK; // Default Fallback to Red (Stock)

                         const typeLabel = theme.label;
                         const themeClass = theme.fullClass;
                         
                         // Dynamic Style Objects (Legacy support if needed, but primarily using tailwind)
                         const dynamicTextStyle = { color: theme.text.replace('text-', '').replace('/90', '') }; // Rough approximation
                         const dynamicBorderStyle = { borderColor: theme.borderColor.replace('border-', '') };

                        // Specific Delete Handler
                        const handleDeleteAccount = () => {
                            const currentBranches = (config.branch || '').split(',');
                            const currentCodes = (config.branchCode || '').split(','); 
                            
                            // If this is the only account, delete the whole config
                            if (currentBranches.length <= 1) {
                                onDelete(config.id);
                                return;
                            }

                            // Otherwise remove just this one
                            const newBranches = currentBranches.filter((_, i) => i !== idx).join(',');
                            // Try to update codes if length matches
                            let newCodes = config.branchCode;
                            if (config.branchCode && currentCodes.length === currentBranches.length) {
                                newCodes = currentCodes.filter((_, i) => i !== idx).join(',');
                            }

                            // Construct updated config
                            const { ...rest } = config;
                            const updatedConfig = { ...rest, branch: newBranches, branchCode: newCodes };
                            
                            // Call onUpdate to save the new account list
                            onUpdate(config.id, updatedConfig);
                        };

                        return (
                            <div 
                                key={`${config.id}-${idx}`}
                                className={`
                                    group relative p-4 rounded-3xl border transition-all flex items-center justify-between
                                    ${config.isConnected 
                                        ? 'bg-[#1C1E22] border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.5)]' 
                                        : 'bg-white/[0.01] border-white/5 opacity-80'}
                                    hover:border-white/30 hover:bg-white/[0.02]
                                `}
                            >
                                <div className="flex flex-col gap-2">
                                    {/* Row 1: Header (Broker - Branch/Type - Name) */}
                                    <div className="flex items-center gap-2">
                                         <span className="text-[14px] font-bold tracking-wide text-zinc-100">
                                            {(() => {
                                                const brokerName = '永豐金';
                                                const middle = typeLabel === '期貨' ? '期貨' : bText.replace(/\(.*\)/, '');
                                                const name = config.alias || config.brokerUsername || 'User';
                                                const cleanName = name.includes('永豐金') ? name.split('永豐金')[0].trim() : name;
                                                return `${brokerName}-${middle} | ${cleanName}`;
                                            })()}
                                         </span>
                                    </div>
                                    
                                        {/* Row 2: Badge + Code/Account */}
                                    <div className="flex items-center gap-3">
                                        {/* Type Badge */}
                                        <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold border ${themeClass} shadow-sm whitespace-nowrap w-[52px] flex items-center justify-center`}>
                                            {typeLabel}
                                        </span>
                                        {/* Detail: Code - Account */}
                                         <span className="text-[12px] font-bold text-zinc-500 font-mono tracking-wide">
                                            {(() => {
                                                const accList = (config.accounts || '').split(',').map(s => s.trim()).filter(Boolean);
                                                const codeList = (config.branchCode || '').split(',').map(s => s.trim()).filter(Boolean);
                                                
                                                // Robust Fallback: if accounts is empty but branchCode looks like a 7-digit ID, use it.
                                                const displayAcc = accList[idx] || (codeList[idx]?.length >= 7 ? codeList[idx] : '');
                                                return displayAcc;
                                            })()}
                                         </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Connection Status Icon (Matching Image 4 Right Side) */}
                                    {config.isConnected && (
                                        <div className="w-6 h-6 rounded-full bg-[#C8B085] flex items-center justify-center shadow-[0_0_10px_rgba(200,176,133,0.3)]">
                                            <Check size={14} className="text-[#1C1E22] stroke-[4]" />
                                        </div>
                                    )}

                                    {/* Actions Reveal on Hover */}
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleStartEdit(config.id)} className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white border border-white/5 hover:border-white/10 transition-all"><FileKey size={14}/></button>
                                        <button onClick={handleDeleteAccount} className="p-2.5 rounded-xl bg-red-500/5 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/10 transition-all"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            </div>
                        );
                    });
                })}

                <button 
                    onClick={() => handleStartEdit('new')}
                    className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] text-slate-500 hover:text-[#C8B085] group transition-all"
                >
                    <div className="flex items-center gap-2">
                        <Plus size={16} className="group-hover:rotate-90 transition-transform"/>
                        <span className="text-xs font-bold uppercase tracking-widest">{lang === 'zh' ? '新增帳務帳號' : 'Add Account'}</span>
                    </div>
                    <span className="text-[9px] text-zinc-600 font-bold group-hover:text-zinc-500 transition-colors">
                        {lang === 'zh' ? '(目前僅支援永豐金)' : '(Supports SinoPac only)'}
                    </span>
                </button>
            </div>

            {isEditing && localConfig && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="w-full max-w-md bg-[#1C1E22] rounded-3xl border border-white/10 shadow-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <h4 className="text-base font-bold text-white uppercase tracking-tight">
                                {isEditing === 'new' ? '新增券商帳號' : '編輯帳號資訊'}
                            </h4>
                            <button onClick={() => setIsEditing(null)} className="p-2 rounded-xl bg-white/5 text-slate-500 hover:text-white"><X size={20}/></button>
                        </div>

                        <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar">
                            {errorMsg && (
                                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-xs font-bold">
                                    <AlertCircle size={14}/> {errorMsg}
                                </div>
                            )}

                            {/* STEP 1: 簽署同意書 */}
                            <div className="relative pl-10">
                                <div className="absolute -left-1 -top-2 text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-200/20 to-transparent opacity-50 select-none pointer-events-none font-sans">1</div>
                                <div className="relative z-10 pt-1">
                                    <button
                                        onClick={() => window.open('https://www.sinotrade.com.tw/newweb/signCenter/S_openAPI/', '_blank')}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left group flex items-center justify-between"
                                    >
                                        <span className="text-xs font-bold text-slate-200">前往簽署 API 風險預告同意書</span>
                                        <ChevronRight size={14} className="text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all"/>
                                    </button>
                                </div>
                            </div>

                            {/* STEP 2: 取得 API Key */}
                            <div className="relative pl-10">
                                <div className="absolute -left-1 -top-2 text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-200/20 to-transparent opacity-50 select-none pointer-events-none font-sans">2</div>
                                <div className="relative z-10 pt-1">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                        <div className="flex items-start gap-2.5">
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <span className="text-[10px] font-bold text-amber-500/90 truncate">取得 API 金鑰與憑證</span>
                                                <span className="text-[9px] text-amber-500/60 break-words">請保存好，下一步需要這些資訊</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => window.open('https://www.sinotrade.com.tw/newweb/PythonAPIKey/', '_blank')}
                                            className="shrink-0 w-full sm:w-auto px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[10px] font-bold flex items-center justify-center sm:justify-start gap-1 transition-all group border border-amber-500/30"
                                        >
                                            前往管理頁面 <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform"/>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* STEP 3: 輸入 API 資訊 */}
                            <div className="relative pl-10">
                                <div className="absolute -left-1 -top-2 text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-200/20 to-transparent opacity-50 select-none pointer-events-none font-sans">3</div>
                                <div className="relative z-10 pt-1">
                                    <h5 className="text-[10px] font-bold text-[#C8B085] mb-3 uppercase tracking-widest pl-1">輸入用戶資訊</h5>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-[10px] font-bold text-slate-500">身分證字號 (Person ID)</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="A123456789"
                                                    value={localConfig.personId} 
                                                    onChange={(e) => handleChange('personId', e.target.value)} 
                                                    className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm font-mono text-white focus:border-[#C8B085]/50 focus:outline-none transition-colors ${errors.personId ? 'border-red-500 bg-red-500/5' : 'border-white/10'}`} 
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-bold text-slate-500">API Key</label>
                                            <input 
                                                type={showSecrets ? "text" : "password"} 
                                                value={localConfig.apiKey} 
                                                onChange={(e) => handleChange('apiKey', e.target.value)} 
                                                className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-xs font-mono text-white focus:border-[#C8B085]/50 focus:outline-none transition-colors ${errors.apiKey ? 'border-red-500 bg-red-500/5' : 'border-white/10'}`} 
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2 relative">
                                            <label className="text-[10px] font-bold text-slate-500">Secret Key</label>
                                            <input 
                                                type={showSecrets ? "text" : "password"} 
                                                value={localConfig.apiSecret} 
                                                onChange={(e) => handleChange('apiSecret', e.target.value)} 
                                                className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-xs font-mono text-white focus:border-[#C8B085]/50 focus:outline-none transition-colors ${errors.apiSecret ? 'border-red-500 bg-red-500/5' : 'border-white/10'}`}
                                            />
                                            <button onClick={() => setShowSecrets(!showSecrets)} className="absolute right-4 top-9 text-slate-500 hover:text-white"><Shield size={14} /></button>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-bold text-slate-500">連線環境</label>
                                            <div className="flex gap-2 p-1 bg-black/40 border border-white/10 rounded-xl">
                                                <button 
                                                    type="button"
                                                    onClick={() => handleChange('environment', 'production')}
                                                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${localConfig.environment !== 'simulation' ? 'bg-[#C8B085] text-black shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                                >
                                                    正式環境
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleChange('environment', 'simulation')}
                                                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${localConfig.environment === 'simulation' ? 'bg-[#C8B085] text-black shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                                >
                                                    測試環境
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* STEP 4: 匯入憑證 */}
                            <div className="relative pl-10">
                                <div className="absolute -left-1 -top-2 text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-200/20 to-transparent opacity-50 select-none pointer-events-none font-sans">4</div>
                                <div className="relative z-10 pt-1">
                                    <h5 className="text-[10px] font-bold text-[#C8B085] mb-2 uppercase tracking-widest pl-1">匯入憑證</h5>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center h-[15px]">
                                                <label className="text-[10px] font-bold text-slate-500 flex items-center gap-2">
                                                    憑證檔案 (.pfx)
                                                </label>
                                            </div>
                                            <input 
                                                type="file" 
                                                accept=".pfx"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => {
                                                            // Safari Mobile Fix: Ensure no newlines/spaces in base64
                                                            const raw = (ev.target?.result as string).split(',')[1];
                                                            const cleanB64 = raw.replace(/\s/g, '');
                                                            handleChange('caContent', cleanB64);
                                                            handleChange('caPath', file.name);
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                                className="hidden"
                                                id="pfx-settings"
                                            />
                                            <label htmlFor="pfx-settings" className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-xs font-mono text-slate-400 cursor-pointer hover:bg-black/60 hover:text-white flex justify-between items-center group transition-colors ${errors.caPath ? 'border-red-500 bg-red-500/5' : 'border-white/10'}`}>
                                                <span className={`truncate pr-2 ${!localConfig.caPath ? 'text-zinc-700' : 'text-slate-400'}`}>{localConfig.caPath || '選擇檔案...'}</span>
                                                <FolderOpen size={14} className="text-[#C8B085] shrink-0" />
                                            </label>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-bold text-slate-500">憑證密碼</label>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleChange('caPassword', localConfig.personId)}
                                                    className="text-[9px] text-[#C8B085] hover:text-[#E0C8A0] transition-colors flex items-center gap-1 cursor-pointer"
                                                    title={lang === 'zh' ? "使用身分證字號自動帶入" : "Auto-fill with Person ID"}
                                                >
                                                    <ArrowDown size={10} />
                                                    {lang === 'zh' ? "帶入身分證ID" : "Use ID"}
                                                </button>
                                            </div>
                                            <input 
                                                type={showSecrets ? "text" : "password"} 
                                                value={localConfig.caPassword} 
                                                placeholder="預設為您的身分證字號"
                                                onChange={(e) => handleChange('caPassword', e.target.value)} 
                                                className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white focus:border-[#C8B085]/50 focus:outline-none transition-colors placeholder:text-zinc-700 ${errors.caPassword ? 'border-red-500 bg-red-500/5' : 'border-white/10'}`} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 pb-2 flex items-center justify-between text-[10px] font-mono">
                             <div className="flex items-center gap-2">
                                <span className="text-zinc-500">後端狀態:</span>
                                {backendStatus === 'checking' && (
                                    <div className="flex items-center gap-1.5 text-zinc-400">
                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse"/>
                                        <span>喚醒中...</span>
                                    </div>
                                )}
                                {backendStatus === 'online' && (
                                    <div className="flex items-center gap-1.5 text-emerald-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"/>
                                        <span>已就緒</span>
                                    </div>
                                )}
                                {backendStatus === 'offline' && (
                                    <div className="flex items-center gap-1.5 text-red-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"/>
                                        <span>離線 (請稍候)</span>
                                    </div>
                                )}
                                <button 
                                    onClick={handleManualPing} 
                                    disabled={backendStatus === 'checking'}
                                    className="p-1 rounded-full hover:bg-white/10 text-slate-500 hover:text-white transition-colors disabled:opacity-50"
                                    title="手動喚醒"
                                >
                                    <RefreshCw size={10} className={backendStatus === 'checking' ? 'animate-spin' : ''}/>
                                </button>
                             </div>
                        </div>

                        <div className="p-6 border-t border-white/5 flex flex-col sm:flex-row items-center gap-3 bg-black/20 font-bold uppercase tracking-tight text-[10px]">
                            <button onClick={handleSave} className="w-full sm:w-auto flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 order-2 sm:order-1">僅儲存</button>
                            {accountChoices.length === 0 && (
                                <button 
                                    disabled={isTesting}
                                    onClick={handleTestConnection}
                                    className="w-full sm:w-auto flex-[2] py-4 px-8 rounded-2xl bg-[#C8B085] text-black hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 order-1 sm:order-2"
                                >
                                    {isTesting ? <Loader2 className="animate-spin" size={16}/> : <Check size={16}/>}
                                    <span>{isTesting ? '驗證中...' : '同步券商'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* ACCOUNT SELECTION MODAL */}
            {accountChoices.length > 0 && (
                <div className="fixed inset-0 z-[10005] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-[#1C1E22] rounded-3xl border border-[#C8B085]/30 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#C8B085]/5">
                            <div className="flex items-center gap-2 text-[#C8B085]">
                                <BrainCircuit size={18}/>
                                <h4 className="text-sm font-bold uppercase tracking-widest">請選擇連線帳號</h4>
                            </div>
                            <button 
                                onClick={() => setAccountChoices([])}
                                className="p-2 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                            >
                                <X size={18}/>
                            </button>
                        </div>

                        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <p className="text-xs text-zinc-400 mb-2 leading-relaxed">
                                您的憑證包含多個帳號，請選擇您希望同步的帳號(可多選)。
                            </p>
                            
                            {accountChoices.map(acc => {
                                const isSelected = selectedIds.includes(acc.account_id);
                                
                                const toggleLogic = () => {
                                    if (isSelected) {
                                        setSelectedIds(prev => prev.filter(id => id !== acc.account_id));
                                    } else {
                                        setSelectedIds(prev => [...prev, acc.account_id]);
                                    }
                                };

                                return (
                                    <button
                                        type="button"
                                        key={acc.account_id}
                                        disabled={isTesting}
                                        onClick={toggleLogic}
                                        className={`
                                            w-full p-4 rounded-3xl border flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group 
                                            ${isSelected ? 'bg-[#1C1E22] border-[#C8B085] shadow-[0_0_20px_rgba(200,176,133,0.1)]' : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-black/60'}
                                        `}
                                    >
                                        <div className="flex flex-col items-start gap-2">
                                             <span className={`text-[14px] font-bold tracking-wide transition-colors ${isSelected ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
                                                {(() => {
                                                    const brokerName = '永豐金';
                                                    const middle = acc.branch_name ? acc.branch_name.replace(/\(.*\)/, '').replace('分公司', '') : '期貨';
                                                    const name = acc.username || '用戶';
                                                    return `${brokerName}-${middle} | ${name}`;
                                                })()}
                                             </span>
                                             
                                             {/* Row 2: Details */}
                                             <div className="flex items-center gap-3">
                                                 {(() => {
                                                     const type = String(acc.account_type || '').toUpperCase();
                                                     const branch = String(acc.branch_name || '');
                                                     const id = String(acc.account_id || '');
 
                                                     // Enhanced Detection
                                                     const isFuture = type.includes('F') || type.includes('FUTURE') || branch.includes('期貨');
                                                     const isSub = type.includes('H') || branch.includes('複委託') || (id.length !== 7 && !type.includes('F'));
                                                     
                                                     const theme = isSub ? ACCOUNT_CATEGORY_THEMES.SUB : isFuture ? ACCOUNT_CATEGORY_THEMES.FUTURES : ACCOUNT_CATEGORY_THEMES.STOCK;
 
                                                     return <span className={`text-[10px] px-3 py-0.5 rounded-full border font-bold w-[52px] flex items-center justify-center ${theme.fullClass}`}>{theme.label}</span>;
                                                 })()}
                                                 <span className="text-[12px] font-mono font-bold text-zinc-500">{acc.account_id}</span>
                                             </div>
                                        </div>
                                        
                                        {/* Right Side Check */}
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-[#C8B085] border-[#C8B085] shadow-[0_0_10px_rgba(200,176,133,0.3)]' : 'border-zinc-700 group-hover:border-zinc-500'}`}>
                                            {isSelected && <Check size={14} className="text-black stroke-[4px]" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-5 border-t border-white/5 bg-zinc-900/50 flex gap-3">
                            <button
                                onClick={() => setAccountChoices([])}
                                className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white font-bold text-sm transition-all"
                            >
                                取消
                            </button>
                            <button
                                disabled={selectedIds.length === 0}
                                onClick={async () => {
                                    setIsTesting(true);
                                    setErrorMsg(null);
                                    try {
                                        if (!localConfig) return; // Guard clause

                                        // Improved ID construction: Prioritize account_id for uniqueness.
                                        // pnl.py checks both (acc_id or branch_code). Using account_id avoids ambiguity if multiple accounts share a branch.
                                        // Fallback to branch_code only if account_id is empty.
                                        const idString = accountChoices
                                            .filter(a => selectedIds.includes(a.account_id))
                                            .map(a => a.account_id || a.branch_code)
                                            .join(',');

                                         const updatedConfig: BrokerConfig = {
                                            ...localConfig,
                                            branchCode: idString, 
                                            accounts: idString, // Populating accounts field correctly
                                            branch: accountChoices
                                                .filter(a => selectedIds.includes(a.account_id))
                                                .map(a => {
                                                    const shortBranch = a.branch_name.split('(')[0].replace('永豐金', '').trim();
                                                    const type = String(a.account_type || '');
                                                    const simpleType = (type.includes('S') || (!type && a.account_id.length === 7)) ? '台股' : '期貨'; 
                                                    if (type.includes('H') || (!type && a.account_id.length !== 7)) return `${shortBranch}(複委託)`;
                                                    return `${shortBranch}(${simpleType})`;
                                                })
                                                .join(', ')
                                        };
                                        
                                        const result: any = await fetchBrokerProfile(updatedConfig);
                                        
                                        if (result.status === 'error') throw new Error(result.message || result.error);

                                        if (result.environment !== 'production') {
                                            throw new Error(lang === 'zh' ? "僅支援正式環境 (Production)" : "Production required.");
                                        }

                                        const finalConfig: BrokerConfig = {
                                            ...updatedConfig,
                                            isConnected: true,
                                            environment: result.environment,
                                            brokerUsername: result.username 
                                        };
                                        
                                        // Clear cache to ensure SyncDateModal picks up new config immediately
                                        try {
                                            // Simple way to clear cache if function not imported, or relying on invalidation from parent
                                            // But best to try clearing local storage cache key manually if possible
                                            localStorage.removeItem('broker_configs_cache');
                                        } catch (e) { console.warn('Cache clear failed', e); }

                                        setLocalConfig(finalConfig);
                                        if (isEditing === 'new') onAdd(finalConfig);
                                        else onUpdate(localConfig.id, finalConfig);
                                        
                                        setIsEditing(null);
                                        setIsTesting(false);
                                        setAccountChoices([]);
                                    } catch (error: any) {
                                        setErrorMsg(error?.message || 'Connection failed');
                                        setIsTesting(false);
                                    }
                                }}
                                className="flex-[2] py-3 rounded-xl bg-[#C8B085] hover:bg-[#E0C8A0] text-black font-bold text-sm shadow-[0_0_20px_rgba(200,176,133,0.2)] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                            >
                                {isTesting ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>}
                                確認同步已選帳號 ({selectedIds.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};



// Simple Shield icon fallback as it might be missing from some lucide versions
const Shield = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
