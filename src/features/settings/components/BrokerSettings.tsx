import React, { useState } from 'react';
import { Plus, X, Trash2, AlertCircle, FileKey, Check, Loader2, FolderOpen, ShieldCheck, BrainCircuit } from 'lucide-react';
import { BrokerConfig } from '../../../types';
import { fetchBrokerProfile } from '../../../services/brokerService';

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

    const emptyConfig: BrokerConfig = {
        id: '',
        provider: 'shioaji',
        apiKey: '',
        apiSecret: '',
        personId: '',
        caPath: '',
        caPassword: '',
        isConnected: false
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

            const updated = {
                ...localConfig,
                isConnected: true,
                branch: result.branch || localConfig.branch,
                branchCode: result.branchCode,
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
            setErrorMsg(error?.message || 'Connection failed');
            setIsTesting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3">
                {configs.map(config => (
                    <div 
                        key={config.id}
                        className="group relative p-5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {config.isConnected ? <ShieldCheck size={20}/> : <AlertCircle size={20}/>}
                                </div>
                                <div className="flex flex-col">
                                    <h4 className="text-sm font-bold text-slate-200">
                                        {config.provider === 'shioaji' ? '永豐金' : 'Broker'} - {config.branch || 'Unknown'}
                                    </h4>
                                    <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5 font-mono">
                                        <span className="text-zinc-300">
                                            {(() => {
                                                const name = config.alias || config.brokerUsername || 'User';
                                                return name.includes('永豐金') ? name.split('永豐金')[0].trim() : name;
                                            })()}
                                        </span>
                                        <span className="text-zinc-600">|</span>
                                        <span className="tracking-wide text-zinc-500">{config.personId}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleStartEdit(config.id)} className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white"><FileKey size={14}/></button>
                                <button onClick={() => onDelete(config.id)} className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20"><Trash2 size={14}/></button>
                            </div>
                        </div>
                    </div>
                ))}

                <button 
                    onClick={() => handleStartEdit('new')}
                    className="flex items-center justify-center gap-2 p-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] text-slate-500 hover:text-[#C8B085] group"
                >
                    <Plus size={16} className="group-hover:rotate-90 transition-transform"/>
                    <span className="text-xs font-bold uppercase tracking-widest">{lang === 'zh' ? '新增帳務帳號' : 'Add Account'}</span>
                </button>
            </div>

            {isEditing && localConfig && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="w-full max-w-lg bg-[#1C1E22] rounded-3xl border border-white/10 shadow-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <h4 className="text-base font-bold text-white uppercase tracking-tight">
                                {isEditing === 'new' ? '新增券商帳號' : '編輯帳號資訊'}
                            </h4>
                            <button onClick={() => setIsEditing(null)} className="p-2 rounded-xl bg-white/5 text-slate-500 hover:text-white"><X size={20}/></button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto">
                            {errorMsg && (
                                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-xs font-bold">
                                    <AlertCircle size={14}/> {errorMsg}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-slate-500">帳戶暱稱</label>
                                    <input type="text" value={localConfig.alias || ''} onChange={(e) => handleChange('alias', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500">身分證字號</label>
                                        <input type="text" value={localConfig.personId} onChange={(e) => handleChange('personId', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-mono text-white" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500">憑證密碼</label>
                                        <input type={showSecrets ? "text" : "password"} value={localConfig.caPassword} onChange={(e) => handleChange('caPassword', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white" />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-slate-500">API 金鑰</label>
                                    <input type={showSecrets ? "text" : "password"} value={localConfig.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-mono text-white" />
                                </div>

                                <div className="flex flex-col gap-2 relative">
                                    <label className="text-[10px] font-bold text-slate-500">API 密鑰</label>
                                    <input type={showSecrets ? "text" : "password"} value={localConfig.apiSecret} onChange={(e) => handleChange('apiSecret', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-mono text-white" />
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
                                            正式環境 (PRODUCTION)
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => handleChange('environment', 'simulation')}
                                            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${localConfig.environment === 'simulation' ? 'bg-[#C8B085] text-black shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                        >
                                            測試環境 (SIMULATION)
                                        </button>
                                    </div>
                                </div>

                                {accountChoices.length > 0 && (

                                    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-zinc-900 border border-[#C8B085]/20">
                                        <div className="flex items-center gap-2 mb-1 px-1 text-[#C8B085]">
                                            <BrainCircuit size={14}/>
                                            <span className="text-[10px] font-bold uppercase tracking-widest">請選擇連線分公司</span>
                                        </div>
                                        {accountChoices.map(acc => (
                                            <button
                                                type="button"
                                                key={acc.account_id}
                                                disabled={isTesting}
                                                onClick={async () => {
                                                    console.log('Branch selected:', acc.branch_code, acc.branch_name);
                                                    setErrorMsg(null);
                                                    setIsTesting(true);
                                                    
                                                    // 先更新配置，確保 branchCode 已設置
                                                    const updatedConfig = {
                                                        ...localConfig,
                                                        branchCode: acc.branch_code,
                                                        branch: acc.branch_name
                                                    };
                                                    setLocalConfig(updatedConfig);
                                                    
                                                    // 稍微延遲以確保狀態更新完成
                                                    await new Promise(resolve => setTimeout(resolve, 50));
                                                    
                                                    // 使用更新後的配置重新驗證
                                                    try {
                                                        const result = await fetchBrokerProfile(updatedConfig);
                                                        
                                                        if (result.status === 'success') {
                                                            const finalConfig = {
                                                                ...updatedConfig,
                                                                isConnected: true,
                                                                brokerUsername: result.username,
                                                                environment: result.environment
                                                            };
                                                            
                                                            if (isEditing === 'new') onAdd(finalConfig);
                                                            else onUpdate(updatedConfig.id, finalConfig);
                                                            
                                                            setIsEditing(null);
                                                            setAccountChoices([]);
                                                        } else {
                                                            setErrorMsg('驗證失敗，請重試');
                                                        }
                                                    } catch (error: any) {
                                                        setErrorMsg(error?.message || '連線失敗');
                                                    } finally {
                                                        setIsTesting(false);
                                                    }
                                                }}
                                                className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${localConfig.branchCode === acc.branch_code ? 'bg-[#C8B085]/10 border-[#C8B085]/50' : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-black/60'}`}
                                            >
                                                <div className="flex flex-col items-start font-mono">
                                                    <span className="text-xs font-bold text-white">永豐金 - {acc.branch_name} ({acc.branch_code})</span>
                                                    <span className="text-[9px] text-zinc-600 mt-1">{acc.account_id}</span>
                                                </div>
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${localConfig.branchCode === acc.branch_code ? 'bg-[#C8B085] border-[#C8B085]' : 'border-white/10'}`}>
                                                    {isTesting && localConfig.branchCode === acc.branch_code && (
                                                        <Loader2 size={10} className="animate-spin text-black" />
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-[#C8B085] flex items-center gap-2 font-mono">
                                        <FileKey size={12}/> 憑證檔案 (.PFX)
                                    </label>
                                    <input 
                                        type="file" 
                                        accept=".pfx"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (ev) => {
                                                    const b64 = (ev.target?.result as string).split(',')[1];
                                                    handleChange('caContent', b64);
                                                    handleChange('caPath', file.name);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="hidden"
                                        id="pfx-settings"
                                    />
                                    <label htmlFor="pfx-settings" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-xs font-mono text-slate-400 cursor-pointer hover:bg-black/60 flex justify-between items-center group">
                                        <span>{localConfig.caPath || '點擊選取檔案'}</span>
                                        <FolderOpen size={14} className="text-[#C8B085] group-hover:scale-110 transition-transform" />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/5 flex items-center gap-3 bg-black/20 font-bold uppercase tracking-tight text-[10px]">
                            <button onClick={handleSave} className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10">僅儲存</button>
                            <button 
                                disabled={isTesting}
                                onClick={handleTestConnection}
                                className="flex-2 py-4 px-8 rounded-2xl bg-[#C8B085] text-black hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isTesting ? <Loader2 className="animate-spin" size={16}/> : <Check size={16}/>}
                                <span>{isTesting ? '驗證中...' : '同步券商'}</span>
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
