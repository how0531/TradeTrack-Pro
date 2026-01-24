import React, { useState } from 'react';
import { Shield, Check, AlertCircle, FileKey, Eye, EyeOff, FolderOpen, Plus, Trash2, Loader2, X } from 'lucide-react';
import { BrokerConfig } from '../../../types';
import { fetchBrokerProfile } from '../../../services/brokerService';

interface BrokerSettingsProps {
    configs: BrokerConfig[];
    activeId: string;
    onAdd: (c: BrokerConfig) => void;
    onUpdate: (id: string, c: BrokerConfig) => void;
    onDelete: (id: string) => void;
    onSwitch: (id: string) => void;
    lang: 'zh' | 'en';
}

export const BrokerSettings = ({ configs, activeId, onAdd, onUpdate, onDelete, onSwitch, lang }: BrokerSettingsProps) => {
    const [isEditing, setIsEditing] = useState<string | 'new' | null>(null);
    const [showSecrets, setShowSecrets] = useState(false);
    const [localConfig, setLocalConfig] = useState<BrokerConfig | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const emptyConfig: BrokerConfig = {
        id: '',
        alias: '',
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
    };

    const handleChange = (key: keyof BrokerConfig, val: any) => {
        if (localConfig) setLocalConfig({ ...localConfig, [key]: val });
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
            console.log('Testing connection with config:', {
                provider: localConfig.provider,
                apiKey: localConfig.apiKey?.substring(0, 10) + '...',
                personId: localConfig.personId,
                caPath: localConfig.caPath
            });

            const profile = await fetchBrokerProfile(localConfig);
            
            if (profile.environment !== 'production') {
                throw new Error(lang === 'zh' ? "僅支援正式環境 (Production)" : "Production environment required.");
            }
            if (!profile.branchCode || !profile.username) {
                throw new Error(lang === 'zh' ? "無法取得帳號資訊" : "Missing account info.");
            }

            const updated = {
                ...localConfig,
                isConnected: true,
                branch: profile.branch || localConfig.branch,
                brokerUsername: profile.username,
                environment: profile.environment
            };
            
            setLocalConfig(updated);
            if (isEditing === 'new') onAdd(updated);
            else onUpdate(localConfig.id, updated);
            
            setIsEditing(null);
            setIsTesting(false);
        } catch (error: any) {
            console.error('Connection test error:', error);
            const errorMessage = error?.message || String(error) || '連線測試失敗';
            setErrorMsg(lang === 'zh' 
                ? `連線失敗: ${errorMessage}` 
                : `Connection failed: ${errorMessage}`
            );
            setIsTesting(false);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2">
                <Shield size={12}/> 券商串接設定 (SHIOAJI)
            </h3>

            <div className="grid grid-cols-1 gap-3">
                {(Array.isArray(configs) ? configs : []).map(config => (
                    config && config.id && (
                        <div 
                            key={config.id}
                            onClick={() => onSwitch(config.id)}
                            className={`group p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${activeId === config.id ? 'bg-[#C8B085]/10 border-[#C8B085]/40 shadow-[0_0_20px_rgba(200,176,133,0.05)]' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-2.5 h-2.5 rounded-full ${config.isConnected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-slate-600'}`}></div>
                                    <div className="flex flex-col gap-0.5">
                                        {/* Top Line: Broker - Branch */}
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-base tracking-tight">
                                                {config.provider === 'shioaji' ? '永豐金' : 'Broker'} - {config.branch || (lang === 'zh' ? '未知分公司' : 'Unknown Branch')}
                                            </span>
                                            {activeId === config.id && (
                                                <span className="bg-[#C8B085] text-black text-[9px] font-black px-1.5 py-0.5 rounded tracking-tighter">
                                                    現役
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Bottom Line: Name | PersonID */}
                                        <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5 font-mono">
                                            <span className="text-zinc-300">{config.alias || config.brokerUsername || 'User'}</span>
                                            <span className="text-zinc-600">|</span>
                                            <span className="tracking-wide text-zinc-500">{config.personId}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleStartEdit(config.id); }}
                                        className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-slate-400"
                                    >
                                        <FileKey size={14}/>
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDelete(config.id); }}
                                        className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/10 hover:bg-red-500/20 hover:border-red-500/20 text-red-500"
                                    >
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                ))}

                <button 
                    onClick={() => handleStartEdit('new')}
                    className="flex items-center justify-center gap-2 p-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] hover:border-[#C8B085]/30 transition-all text-slate-500 hover:text-[#C8B085] group"
                >
                    <Plus size={16} className="transition-transform group-hover:rotate-90"/>
                    <span className="text-xs font-bold uppercase tracking-widest">{lang === 'zh' ? '新增帳務帳號' : 'Add Broker Account'}</span>
                </button>
            </div>

            {isEditing && localConfig && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-4">
                    <div className="w-full max-w-lg bg-[#1C1E22] rounded-3xl border border-white/10 shadow-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <div className="flex flex-col">
                                <h4 className="text-base font-bold text-white uppercase tracking-tight">
                                    {isEditing === 'new' ? (lang === 'zh' ? '新增券商帳號' : 'Add Broker Account') : (lang === 'zh' ? '編輯帳號資訊' : 'Edit Account')}
                                </h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Shioaji API (Production Only)</p>
                            </div>
                            <button onClick={() => setIsEditing(null)} className="p-2 rounded-xl bg-white/5 text-slate-500 hover:text-white">
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto">
                            {errorMsg && (
                                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-xs font-bold animate-in shake duration-300">
                                    <AlertCircle size={14}/> {errorMsg}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">帳戶暱稱 (ALIAS)</label>
                                    <input 
                                        type="text" 
                                        placeholder="例如：主帳戶、我的投資、SimulationUser的投資..."
                                        value={localConfig.alias} 
                                        onChange={(e) => handleChange('alias', e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-[#C8B085]"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">身分證字號 (ID)</label>
                                        <input 
                                            type="text" 
                                            value={localConfig.personId} 
                                            onChange={(e) => handleChange('personId', e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-mono text-white outline-none focus:border-[#C8B085]"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">憑證密碼 (PFX PWD)</label>
                                        <input 
                                            type={showSecrets ? "text" : "password"} 
                                            value={localConfig.caPassword} 
                                            onChange={(e) => handleChange('caPassword', e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-[#C8B085]"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">API 金鑰 (API KEY)</label>
                                    <div className="relative">
                                        <input 
                                            type={showSecrets ? "text" : "password"} 
                                            value={localConfig.apiKey} 
                                            onChange={(e) => handleChange('apiKey', e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-mono text-white outline-none focus:border-[#C8B085]"
                                        />
                                        <button 
                                            onClick={() => setShowSecrets(!showSecrets)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                        >
                                            {showSecrets ? <EyeOff size={16}/> : <Eye size={16}/>}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">API 密鑰 (API SECRET)</label>
                                    <input 
                                        type={showSecrets ? "text" : "password"} 
                                        value={localConfig.apiSecret} 
                                        onChange={(e) => handleChange('apiSecret', e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-mono text-white outline-none focus:border-[#C8B085]"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-[#C8B085] uppercase tracking-widest px-1 flex items-center gap-2">
                                        <FileKey size={12}/> 憑證檔案 (.PFX FILE)
                                    </label>
                                    <div className="group relative">
                                        <input 
                                            type="file" 
                                            accept=".pfx"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (event) => {
                                                        const base64 = event.target?.result as string;
                                                        // 移除 data:application/x-pkcs12;base64, 前綴
                                                        const pureBase64 = base64.split(',')[1];
                                                        handleChange('caContent', pureBase64);
                                                        handleChange('caPath', file.name); // 儲存檔名作為參考
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                            className="hidden"
                                            id="pfx-upload"
                                        />
                                        <label 
                                            htmlFor="pfx-upload"
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-xs font-mono text-slate-400 outline-none focus:border-[#C8B085] flex items-center justify-between cursor-pointer hover:bg-black/60 transition-colors"
                                        >
                                            <span>{localConfig.caPath || (lang === 'zh' ? '點擊選取 .pfx 憑證檔案' : 'Click to select .pfx file')}</span>
                                            <div className="p-2 bg-white/5 rounded-lg border border-white/5 text-[#C8B085]">
                                                <FolderOpen size={14}/>
                                            </div>
                                        </label>
                                    </div>
                                    <p className="text-[9px] text-zinc-600 font-bold italic px-1">
                                        {lang === 'zh' 
                                            ? '註：憑證僅供本次連線使用，不會儲存於伺服器。支援手機端選取檔案。' 
                                            : 'Note: Certificate is used only for this connection and not stored. Supports mobile file selection.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/5 flex items-center gap-3 bg-black/20">
                            <button 
                                onClick={handleSave}
                                className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 font-bold text-xs uppercase hover:bg-white/10 transition-all border border-white/5"
                            >
                                僅儲存 (SAVE ONLY)
                            </button>
                            <button 
                                disabled={isTesting}
                                onClick={handleTestConnection}
                                className="flex-2 py-4 px-8 rounded-2xl bg-[#C8B085] text-black font-bold text-xs uppercase hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#C8B085]/10 disabled:opacity-50"
                            >
                                {isTesting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16}/>
                                        <span>驗證中...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check size={16}/>
                                        <span>儲存並驗證連線</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
