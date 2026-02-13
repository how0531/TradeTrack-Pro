import React, { useState } from 'react';
import { Plus, X, Trash2, AlertCircle, FileKey, Check, Loader2, FolderOpen, ShieldCheck, BrainCircuit, RefreshCw, ChevronRight, ArrowDown, Upload } from 'lucide-react';
import { BrokerConfig } from '../../../types';
import { fetchBrokerProfile, pingBackend, validateBackendStatus, wakeUpBackend, verifyBrokerAccount } from '../../../services/brokerService';
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
    const [backendStatus, setBackendStatus] = useState<'ready' | 'server_only' | 'offline' | 'checking' | 'sleeping'>('checking');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [deleteTarget, setDeleteTarget] = useState<{ configId: string, accountIndex: number } | null>(null);
    const [isVerifying, setIsVerifying] = useState<string | null>(null); // New: track verification per accountId
    const [uploadConfigId, setUploadConfigId] = useState<string | null>(null); // Track which config for CA upload
    const [errorConfigId, setErrorConfigId] = useState<string | null>(null); // Track which config caused the error

    // Derived state for button type
    const [errors, setErrors] = useState<Record<string, boolean>>({});
    const [progressMsg, setProgressMsg] = useState<string>(''); // Track login progress

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

    // 自動驗證後端功能 (檢查雲端 API 是否正常運作)
    useEffect(() => {
        if (isEditing) {
            const checkStatus = async () => {
                setBackendStatus('checking');
                const status = await validateBackendStatus();
                if (status === 'sleeping') {
                    setBackendStatus('sleeping');
                    const wake = await wakeUpBackend();
                    setBackendStatus(wake.success ? 'ready' : 'offline');
                } else {
                    setBackendStatus(status);
                }
            };
            checkStatus();
        } else {
            setBackendStatus('ready');
        }
    }, [isEditing]);

    const handleManualPing = async () => {
        setBackendStatus('checking');
        const status = await validateBackendStatus();
        if (status === 'sleeping') {
            setBackendStatus('sleeping');
            const wake = await wakeUpBackend();
            setBackendStatus(wake.success ? 'ready' : 'offline');
        } else {
            setBackendStatus(status);
        }
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
            setErrorMsg(lang === 'zh' ? '請填寫所有必填欄位' : '請填寫所有必填欄位 (Please fill all fields)');
            setIsTesting(false);
            return;
        }
        setErrors({});

        try {
            // Step 1: Wake up backend if needed
            setProgressMsg('正在喚醒後端伺服器 (Waking up backend)...');
            setErrorMsg(null);

            const wakeResult = await wakeUpBackend();
            if (!wakeResult.success) {
                const specificError = wakeResult.error || 'Unknown Error';
                console.error('[BrokerSettings] Wake Error:', specificError);
                setErrorMsg(`後端服務喚醒失敗 (${specificError})。請檢查網路連線或稍後再試。`);
                setIsTesting(false);
                setProgressMsg('');
                return;
            }

            // Step 2: Attempt login with progress callback
            setProgressMsg('正在連接券商 API...');
            const result = await fetchBrokerProfile(localConfig, (msg) => {
                setProgressMsg(msg);
            });

            if (result.status === 'multiple_accounts' && result.accounts) {
                setAccountChoices(result.accounts);

                // Track which ones are signed
                const signedIds = result.accounts.filter((a: any) => a.signed).map((a: any) => a.account_id).join(',');
                if (localConfig) setLocalConfig({ ...localConfig, signedAccounts: signedIds });

                setErrorMsg(lang === 'zh' ? "偵測到多個帳戶，請選擇一個分公司" : "偵測到多個帳戶，請選擇一個分公司 (Multiple accounts)");
                setIsTesting(false);
                return;
            }

            if (result.environment !== 'production') {
                throw new Error(lang === 'zh' ? "僅支援正式環境 (Production)" : "僅支援正式環境 (Production required)");
            }

            const updated: BrokerConfig = {
                ...localConfig,
                isConnected: true,
                branch: result.branch || localConfig.branch,
                branchCode: result.branchCode,
                accounts: result.accountId || result.branchCode, // Use accountId if available, fallback to branchCode
                brokerUsername: result.username,
                environment: result.environment
            };

            // Enhanced: Update verification status from single-login result
            if (result.signedAccounts && result.signedAccounts.length > 0) {
                updated.signedAccounts = result.signedAccounts.join(',');
            }

            setLocalConfig(updated);
            if (isEditing === 'new') onAdd(updated);
            else onUpdate(localConfig.id, updated);

            setIsEditing(null);
            setIsTesting(false);
            setAccountChoices([]);
            setProgressMsg('');
        } catch (error: any) {
            let msg = error?.message || '連線失敗 (Connection failed)';
            if (msg.includes('Failed to fetch')) {
                msg = lang === 'zh'
                    ? "連線失敗：後端服務可能正在啟動中，請稍候 30 秒再試一次。"
                    : "連線失敗：後端服務可能正在啟動中，請稍候 30 秒再試一次。 (Connection failed: Backend starting)";
                // 再次嘗試 ping 以確保喚醒
                pingBackend();
            }
            setErrorMsg(msg);
            setIsTesting(false);
            setProgressMsg('');
        }
    };

    const handleCardCAUpload = async (e: React.ChangeEvent<HTMLInputElement>, configId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const config = configs.find(c => c.id === configId);
        if (!config) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const raw = (ev.target?.result as string).split(',')[1];
            const cleanB64 = raw.replace(/\s/g, '');
            const updated = {
                ...config,
                caContent: cleanB64,
                caPath: file.name
            };
            onUpdate(configId, updated);
            if (localConfig?.id === configId) setLocalConfig(updated);

            // Clear error if it was a path error
            if (errorMsg?.includes('找不到憑證')) setErrorMsg(null);

            // Auto-retry verification if this was a fix action
            setProgressMsg('憑證上傳成功，正在重新嘗試驗證...');
            setTimeout(() => {
                handleVerifyAccount(updated, configId);
            }, 800);
        };
        reader.readAsDataURL(file);
    };

    const handleVerifyAccount = async (config: BrokerConfig, accountId: string) => {
        // [Safety Check] Automated verification is only for Simulation accounts
        if (config.environment === 'production') {
            setErrorMsg('正式環境請直接使用「同步券商」功能，或前往永豐金網站簽署 API 同意書即可，無需模擬驗證。');
            setTimeout(() => setErrorMsg(null), 5000);
            return;
        }

        setIsVerifying(accountId);
        setErrorMsg(null);
        setProgressMsg('正在執行模擬下單驗證 API 權限...');

        try {
            const result = await verifyBrokerAccount(config, accountId);
            if (result.status === 'success') {
                // Update localConfig and parent
                const currentSigned = (config.signedAccounts || '').split(',').filter(Boolean);
                if (!currentSigned.includes(accountId)) {
                    const newSigned = [...currentSigned, accountId].join(',');
                    const updated = { ...config, signedAccounts: newSigned };
                    if (localConfig?.id === config.id) setLocalConfig(updated);
                    onUpdate(config.id, updated);
                }
                setProgressMsg('');
                // Success message is handled by alerting or just clearing
            } else {
                setErrorMsg(result.message || '驗證失敗');
                setErrorConfigId(config.id);
                setProgressMsg('');
            }
        } catch (err: any) {
            setErrorMsg(err.message || '連線錯誤');
            setErrorConfigId(config.id);
            setProgressMsg('');
        } finally {
            setIsVerifying(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Ghost Account & Duplicate Config Fixer */}
            {(() => {
                // Analysis
                const personIdMap = new Map<string, string[]>(); // personId -> configIds
                let hasGhost = false;
                let hasDuplicates = false;

                configs.forEach(c => {
                    // Check Ghost
                    const bLen = (c.branch || '').split(',').filter(s => s.trim()).length;
                    const aLen = (c.accounts || '').split(',').filter(s => s.trim()).length;
                    if (aLen > bLen) hasGhost = true;
                    // Check Duplicates Within (Same ID twice in one config)
                    const accs = (c.accounts || '').split(',').filter(s => s.trim());
                    if (new Set(accs).size !== accs.length) hasGhost = true;

                    // Check Duplicate Configs
                    if (c.personId) {
                        const existing = personIdMap.get(c.personId) || [];
                        existing.push(c.id);
                        personIdMap.set(c.personId, existing);
                        if (existing.length > 1) hasDuplicates = true;
                    }
                });

                if (!hasGhost && !hasDuplicates) return null;

                return (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                                <AlertCircle size={16} className="text-amber-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">
                                    {lang === 'zh' ? '偵測到設定檔異常' : 'Configuration Issues Detected'}
                                </span>
                                <span className="text-[10px] text-amber-500/60">
                                    {hasDuplicates
                                        ? (lang === 'zh' ? '發現重複的設定檔 (同一身分證)，建議合併。' : 'Duplicate configs found.')
                                        : (lang === 'zh' ? '部分帳號未正確連結 (幽靈帳號)。' : 'Ghost accounts detected.')}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                // 1. Fix Duplicates (Merge)
                                personIdMap.forEach((ids, pid) => {
                                    if (ids.length > 1) {
                                        // Keep the first one, merge others into it
                                        const masterId = ids[0];
                                        const masterConfig = configs.find(c => c.id === masterId);
                                        if (!masterConfig) return;

                                        // Collect all unique accounts and signed statuses
                                        const allAccounts = new Set<string>();
                                        const allBranches = new Map<string, string>(); // accId -> branchName
                                        const allSigned = new Set<string>();

                                        // Initial load from master
                                        (masterConfig.signedAccounts || '').split(',').forEach(s => {
                                            if (s.trim()) allSigned.add(s.trim());
                                        });

                                        ids.forEach(id => {
                                            const cfg = configs.find(c => c.id === id);
                                            if (!cfg) return;
                                            const accs = (cfg.accounts || cfg.branchCode || '').split(',').map(s => s.trim()).filter(Boolean);
                                            const brs = (cfg.branch || '').split(',').map(s => s.trim());

                                            accs.forEach((accId, idx) => {
                                                allAccounts.add(accId);
                                                if (brs[idx]) allBranches.set(accId, brs[idx]);
                                            });

                                            // Merge signed status
                                            (cfg.signedAccounts || '').split(',').forEach(s => {
                                                if (s.trim()) allSigned.add(s.trim());
                                            });

                                            // Delete the duplicates (except master)
                                            if (id !== masterId) onDelete(id);
                                        });

                                        // Update Master
                                        const uniqueAccList = Array.from(allAccounts);
                                        const uniqueBranchList = uniqueAccList.map(uid => allBranches.get(uid) || 'Unknown Branch');

                                        onUpdate(masterId, {
                                            ...masterConfig,
                                            accounts: uniqueAccList.join(','),
                                            branchCode: uniqueAccList.join(','),
                                            branch: uniqueBranchList.join(','),
                                            signedAccounts: Array.from(allSigned).join(',')
                                        });
                                    }
                                });

                                // 2. Fix Ghosts & Internal Duplicates (Run on all survivors)
                                // We use a timeout to let the deletes propagate if necessary, 
                                // but typically we can just run this logic on non-deleted ones.
                                // Re-reading configs from prop might be stale if we just called onDelete?
                                // Actually, we should probably rely on the user clicking "Fix" again if state updates rely on parent.
                                // But let's try to fix "in-place" for the ones we touched.

                                configs.forEach(c => {
                                    // Skip if likely deleted (checked via personIdMap logic above)
                                    // Just perform local cleanup
                                    const branches = (c.branch || '').split(',');
                                    const accounts = (c.accounts || '').split(',');

                                    // Dedup within single config
                                    const uniqueMap = new Map<string, string>(); // id -> branch
                                    let changed = false;

                                    accounts.forEach((acc, idx) => {
                                        const trimmed = acc.trim();
                                        if (!trimmed) return;
                                        if (!uniqueMap.has(trimmed)) {
                                            // Keep valid branch if possible
                                            const b = branches[idx] && branches[idx].trim() ? branches[idx].trim() : (uniqueMap.get(trimmed) || 'Unknown');
                                            uniqueMap.set(trimmed, b);
                                        } else {
                                            changed = true; // Found dup
                                        }
                                    });

                                    // Check Length Mismatch
                                    if (accounts.length > branches.length) changed = true;

                                    if (changed) {
                                        const newAccs = Array.from(uniqueMap.keys());
                                        const newBras = Array.from(uniqueMap.values());
                                        onUpdate(c.id, {
                                            ...c,
                                            accounts: newAccs.join(','),
                                            branchCode: newAccs.join(','), // ensure sync
                                            branch: newBras.join(',')
                                        });
                                    }
                                });
                            }}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-[10px] font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                        >
                            {lang === 'zh' ? '一鍵修復' : 'Fix Configs'}
                        </button>
                    </div>
                );
            })()}

            {/* Verification Progress & Errors (Outside Modal) */}
            {!isEditing && (progressMsg || errorMsg) && (
                <div className="p-4 rounded-2xl bg-black/20 border border-white/5 space-y-3 animate-in fade-in slide-in-from-top-2">
                    {progressMsg && (
                        <div className="flex items-center gap-2 text-xs text-[#C8B085] animate-pulse">
                            <Loader2 size={14} className="animate-spin" />
                            <span>{progressMsg}</span>
                        </div>
                    )}
                    {errorMsg && !progressMsg && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2">
                                    <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                    <span className="text-xs text-red-300 font-bold">{errorMsg}</span>
                                </div>
                                {errorMsg.includes('找不到憑證') && errorConfigId && (
                                    <button
                                        onClick={() => {
                                            setUploadConfigId(errorConfigId);
                                            setTimeout(() => {
                                                document.getElementById('card-ca-upload-trigger')?.click();
                                            }, 10);
                                        }}
                                        className="shrink-0 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg border border-amber-500/20 transition-all cursor-pointer"
                                    >
                                        立即修復
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <input
                type="file"
                id="card-ca-upload-trigger"
                accept=".pfx"
                className="hidden"
                onChange={(e) => {
                    if (uploadConfigId) handleCardCAUpload(e, uploadConfigId);
                    e.target.value = ''; // Critical: Reset input so same file selection triggers change
                }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {configs.flatMap(config => {
                    const branches = (config.branch || 'Unknown').split(',');
                    const codes = (config.branchCode || '').split(',');
                    const accounts = (config.accounts || config.branchCode || '').split(',');

                    // Use the longest array to ensure we show all entries (revealing ghosts)
                    const maxLength = Math.max(branches.length, codes.length, accounts.length);

                    return Array.from({ length: maxLength }).map((_, idx) => {
                        const bRaw = branches[idx] || 'Unknown Branch';
                        const bText = bRaw.trim();
                        const accId = accounts[idx] ? accounts[idx].trim() : (codes[idx] || 'Unknown');

                        // --- ROBUST IDENTIFICATION LOGIC (Dev Refactor) ---
                        // ... use accId or bText ...

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

                        // Specific Delete Handler
                        const handleDeleteAccount = (e?: React.MouseEvent) => {
                            if (e) e.stopPropagation();
                            setDeleteTarget({ configId: config.id, accountIndex: idx });
                        };

                        return (
                            <div
                                key={`${config.id}-${idx}`}
                                className={`
                                    group relative p-3.5 rounded-2xl border transition-all flex flex-col justify-center gap-2 overflow-hidden min-h-[80px]
                                    ${config.isConnected
                                        ? isFuture
                                            ? 'bg-gradient-to-br from-[#1E40AF]/20 to-zinc-950/50 border-[#1E40AF]/40 shadow-[0_4px_16px_rgba(30,64,175,0.15),inset_0_1px_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl'
                                            : isSub
                                                ? 'bg-gradient-to-br from-zinc-800/30 to-zinc-950/60 border-white/10 grayscale opacity-75 cursor-not-allowed shadow-none'
                                                : 'bg-gradient-to-br from-[#D05A5A]/15 to-zinc-950/50 border-[#D05A5A]/30 shadow-[0_4px_16px_rgba(208,90,90,0.1),inset_0_1px_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl'
                                        : 'bg-white/[0.01] border-white/5 opacity-80'}
                                    hover:border-white/30 hover:bg-white/[0.04]
                                `}
                            >
                                {/* Subtle Inner Glow Overlay for Connected Cards */}
                                {config.isConnected && (
                                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"></div>
                                )}

                                <div className="flex justify-between items-center w-full h-full relative">
                                    <div className="flex flex-col gap-1 w-full items-center justify-center">
                                        {/* Row 1: Broker - Branch (Large) */}
                                        <div className="flex items-center justify-center gap-1 w-full relative">
                                            <h4 className="text-[13px] font-bold text-white/95 tracking-tight text-center">
                                                {(() => {
                                                    const brokerName = '永豐金';
                                                    const middle = typeLabel === '期貨'
                                                        ? '期貨'
                                                        : bText.replace(/\(.*\)/, '')
                                                            .replace('分公司', '')
                                                            .replace(/^永豐金-?/, '')
                                                            .trim();
                                                    return `${brokerName} ${middle}`;
                                                })()}
                                            </h4>
                                            {/* Unsupported Badge (Next to Title) - Always show for Sub-brokerage */}
                                            {isSub && (
                                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-500/10 border border-zinc-500/20 cursor-not-allowed">
                                                    <span className="text-[9px] font-bold text-zinc-500 uppercase whitespace-nowrap">尚未支援</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Row 2: Category - Account - Name (Small) */}
                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                            <span className={`px-1.5 rounded-[4px] text-[9px] font-bold border shadow-sm whitespace-nowrap h-[16px] flex items-center justify-center min-w-[32px] ${isSub ? 'border-zinc-700 text-zinc-600 bg-zinc-800/30' : theme.fullClass}`}>
                                                {typeLabel}
                                            </span>
                                            <span className={`text-[10px] font-bold font-mono tracking-wide ${isSub ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                                {accId}
                                            </span>
                                            <span className="text-[10px] font-medium text-zinc-500">
                                                {(() => {
                                                    const name = config.alias || config.brokerUsername || 'User';
                                                    const cleanName = name.includes('永豐金') ? name.split('永豐金')[0].trim() : name;
                                                    return cleanName.replace(/【|】/g, '');
                                                })()}
                                            </span>

                                            {config.isConnected && (
                                                <div className="flex items-center gap-1 ml-1">
                                                    <div className="w-1 h-1 rounded-full bg-[#C8B085] shadow-[0_0_5px_rgba(200,176,133,0.8)]" />
                                                </div>
                                            )}

                                            {/* Verification Status Tag (Interactive Only) */}
                                            {config.provider === 'shioaji' && config.signedAccounts !== undefined && !config.signedAccounts.includes(accId) && !isSub && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleVerifyAccount(config, accId);
                                                    }}
                                                    disabled={isVerifying === accId}
                                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 mt-0.5 hover:bg-amber-500/20 cursor-pointer transition-colors ${isVerifying === accId ? 'animate-pulse' : ''}`}
                                                    title={`點擊立即驗證 (ID: ${accId} | Signed: ${config.signedAccounts || 'None'})`}
                                                >
                                                    {isVerifying === accId ? <Loader2 size={8} className="animate-spin text-amber-500" /> : <AlertCircle size={8} className="text-amber-500" />}
                                                    <span className="text-[8px] font-bold text-amber-500 uppercase">{isVerifying === accId ? '驗證中...' : '未驗證'}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons (Absolute Bottom Right on Hover, but slightly adjusted for centered layout) */}
                                    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md rounded-lg p-0.5 border border-white/10 z-50">
                                        {config.provider === 'shioaji' && config.signedAccounts !== undefined && !config.signedAccounts.includes(accId) && !isSub && (
                                            <>
                                                <button
                                                    disabled={isVerifying === accId}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleVerifyAccount(config, accId);
                                                    }}
                                                    className={`p-1.5 rounded-md text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all flex items-center gap-1 ${isVerifying === accId ? 'animate-pulse' : ''}`}
                                                    title="需要驗證 API 權限 (點擊執行模擬下單)"
                                                >
                                                    {isVerifying === accId ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                                                    <span className="text-[9px] font-bold">驗證</span>
                                                </button>
                                                {!config.caContent && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setUploadConfigId(config.id);
                                                            setTimeout(() => {
                                                                document.getElementById('card-ca-upload-trigger')?.click();
                                                            }, 10);
                                                        }}
                                                        className="p-1.5 rounded-md text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 transition-all flex items-center gap-1"
                                                        title="上傳憑證修復路徑錯誤"
                                                    >
                                                        <FolderOpen size={12} />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        <button onClick={() => handleStartEdit(config.id)} className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-all"><FileKey size={12} /></button>
                                        <button onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteAccount(e);
                                        }} className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    });
                })}

                <button
                    onClick={() => handleStartEdit('new')}
                    className="group border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-[70px] hover:border-[#C8B085]/40 hover:bg-[#C8B085]/5 transition-all border-dashed"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-white/5 group-hover:bg-[#C8B085]/20 flex items-center justify-center transition-colors">
                            <Plus size={10} className="text-zinc-500 group-hover:text-[#C8B085] transition-colors" />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-500 group-hover:text-[#C8B085] uppercase tracking-widest transition-colors">{lang === 'zh' ? '新增帳務帳號' : 'Add Account'}</span>
                    </div>
                </button>
            </div>

            {isEditing && localConfig && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="w-full max-w-md bg-[#1C1E22] rounded-3xl border border-white/10 shadow-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-zinc-800/50 flex justify-between items-center">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                                {isEditing === 'new' ? '新增券商帳號' : '編輯帳號資訊'}
                            </h4>
                            <button onClick={() => setIsEditing(null)} className="p-2 rounded-xl bg-white/5 text-zinc-600 hover:text-white transition-colors"><X size={20} /></button>
                        </div>

                        <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar">
                            {errorMsg && (
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-[11px] font-bold">
                                    <AlertCircle size={14} /> {errorMsg}
                                </div>
                            )}



                            {/* STEP 1: 取得 API Key */}
                            <div className="relative pl-10">
                                <div className="absolute -left-1 -top-2 text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white/10 to-transparent opacity-50 select-none pointer-events-none font-sans">1</div>
                                <div className="relative z-10 pt-1">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                        <div className="flex items-start gap-2.5">
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <span className="text-[10px] font-bold text-amber-500/80 uppercase">取得 API 金鑰與憑證</span>
                                                <span className="text-[9px] text-amber-500/50 break-words font-medium">請保存好，下一步需要這些資訊</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => window.open('https://www.sinotrade.com.tw/newweb/PythonAPIKey/', '_blank')}
                                            className="shrink-0 w-full sm:w-auto px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[9px] font-bold flex items-center justify-center sm:justify-start gap-1 transition-all group border border-amber-500/20 uppercase tracking-wider"
                                        >
                                            管理頁面 <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* STEP 2: 輸入 API 資訊 */}
                            <div className="relative pl-10">
                                <div className="absolute -left-1 -top-2 text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white/10 to-transparent opacity-50 select-none pointer-events-none font-sans">2</div>
                                <div className="relative z-10 pt-1">
                                    <h5 className="text-[10px] font-bold text-zinc-500 mb-3 uppercase tracking-[0.2em] pl-1">輸入用戶資訊</h5>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">身分證字號 (Person ID)</label>
                                                <input
                                                    type="text"
                                                    placeholder="A123456789"
                                                    value={localConfig.personId}
                                                    onChange={(e) => handleChange('personId', e.target.value.trim().toUpperCase())}
                                                    className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm font-mono text-white focus:border-[#C8B085]/40 focus:outline-none transition-colors placeholder:text-zinc-800 ${errors.personId ? 'border-red-500 bg-red-500/5' : 'border-white/5'}`}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">API Key</label>
                                            <input
                                                type={showSecrets ? "text" : "password"}
                                                value={localConfig.apiKey}
                                                onChange={(e) => handleChange('apiKey', e.target.value.trim())}
                                                className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-xs font-mono text-white focus:border-[#C8B085]/40 focus:outline-none transition-colors ${errors.apiKey ? 'border-red-500 bg-red-500/5' : 'border-white/5'}`}
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2 relative">
                                            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">Secret Key</label>
                                            <input
                                                type={showSecrets ? "text" : "password"}
                                                value={localConfig.apiSecret}
                                                onChange={(e) => handleChange('apiSecret', e.target.value.trim())}
                                                className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-xs font-mono text-white focus:border-[#C8B085]/40 focus:outline-none transition-colors ${errors.apiSecret ? 'border-red-500 bg-red-500/5' : 'border-white/5'}`}
                                            />
                                            <button onClick={() => setShowSecrets(!showSecrets)} className="absolute right-4 top-9 text-zinc-600 hover:text-white transition-colors"><Shield size={14} /></button>
                                        </div>

                                        {/* API Risk Disclosure Link */}
                                        <a
                                            href="https://www.sinotrade.com.tw/newweb/signCenter/S_openAPI/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group w-full bg-zinc-900/30 hover:bg-zinc-800/50 border border-white/5 hover:border-white/10 rounded-xl px-4 py-3 flex items-center justify-between transition-all duration-300 -mt-1"
                                        >
                                            <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors flex items-center gap-2">
                                                前往簽署 API 風險預告同意書
                                                <span className="text-[10px] font-medium text-zinc-600 group-hover:text-zinc-500 transition-colors hidden sm:inline-block">
                                                    (若已簽署可忽略)
                                                </span>
                                            </span>
                                            <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors group-hover:translate-x-0.5 duration-300" />
                                        </a>

                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">連線環境</label>
                                            <div className="flex gap-2 p-1 bg-black/40 border border-white/5 rounded-xl">
                                                <button
                                                    type="button"
                                                    onClick={() => handleChange('environment', 'production')}
                                                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${localConfig.environment !== 'simulation' ? 'bg-[#C8B085] text-black shadow-lg' : 'text-zinc-600 hover:text-white'}`}
                                                >
                                                    正式環境
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleChange('environment', 'simulation')}
                                                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${localConfig.environment === 'simulation' ? 'bg-[#C8B085] text-black shadow-lg' : 'text-zinc-600 hover:text-white'}`}
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
                                <div className="absolute -left-1 -top-2 text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white/10 to-transparent opacity-50 select-none pointer-events-none font-sans">4</div>
                                <div className="relative z-10 pt-1">
                                    <h5 className="text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-[0.2em] pl-1">匯入憑證</h5>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center h-[15px]">
                                                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter flex items-center gap-2">
                                                    憑證檔案 (.pfx)
                                                </label>
                                            </div>

                                            <input
                                                id="ca-upload"
                                                type="file"
                                                accept=".pfx"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => {
                                                            const raw = (ev.target?.result as string).split(',')[1];
                                                            const cleanB64 = raw.replace(/\s/g, '');
                                                            setLocalConfig(prev => prev ? ({ ...prev, caContent: cleanB64, caPath: file.name }) : null);
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                    e.target.value = '';
                                                }}
                                            />

                                            {/* Unified Certificate Input */}
                                            {!localConfig.caContent ? (
                                                <label
                                                    htmlFor="ca-upload"
                                                    className="relative group cursor-pointer block"
                                                >
                                                    {/* PRO MAX UI: Single-line input style for empty state */}
                                                    <div className="w-full bg-black/40 border border-white/5 hover:border-[#C8B085]/50 rounded-xl px-4 py-3 flex items-center gap-3 transition-all duration-300 h-[46px] group-hover:shadow-[0_0_15px_rgba(200,176,133,0.05)]">
                                                        <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                                                            <Upload size={10} className="text-zinc-500 group-hover:text-[#C8B085] transition-colors" />
                                                        </div>
                                                        <span className="text-xs font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors truncate">
                                                            {lang === 'zh' ? '點擊上傳 .pfx 憑證' : 'Click to Upload .pfx'}
                                                        </span>
                                                    </div>
                                                </label>
                                            ) : (
                                                <div className="relative group animate-in fade-in zoom-in-95 duration-300">
                                                    {/* PRO MAX UI: Mimic the exact style of the password input for alignment */}
                                                    <div className="w-full bg-black/40 border border-emerald-500/30 rounded-xl px-4 py-3 flex items-center justify-between group-hover:border-emerald-500/50 transition-all h-[46px]">

                                                        {/* Left: Icon + Filename */}
                                                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                            {/* Icon with Glow Effect */}
                                                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                                                <Check size={10} className="text-emerald-500" strokeWidth={3} />
                                                            </div>

                                                            {/* Filename with Gradient Text for Premium Feel */}
                                                            <span className="text-xs font-medium text-zinc-200 truncate font-mono tracking-tight min-w-0">
                                                                {localConfig.caPath}
                                                            </span>
                                                        </div>

                                                        {/* Right: Size Badge + Delete Action */}
                                                        <div className="flex items-center gap-3 shrink-0 pl-2">
                                                            {/* Monospace Size Badge */}
                                                            <span className="text-[10px] font-mono text-emerald-500/80 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/10">
                                                                {(localConfig.caContent.length / 1024).toFixed(1)} KB
                                                            </span>

                                                            {/* Separator */}
                                                            <div className="w-[1px] h-3 bg-white/10" />

                                                            {/* Delete Button with Hover Effect */}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleChange('caPath', '');
                                                                    handleChange('caContent', '');
                                                                }}
                                                                className="text-zinc-600 hover:text-red-400 transition-colors p-1 -mr-1"
                                                                title="Remove"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center h-[15px]">
                                                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">憑證密碼</label>
                                                <button
                                                    type="button"
                                                    onClick={() => handleChange('caPassword', localConfig.personId)}
                                                    className="text-[9px] text-[#C8B085] hover:text-[#E0C8A0] transition-colors flex items-center gap-1 cursor-pointer font-bold uppercase"
                                                    title={lang === 'zh' ? "使用身分證字號自動帶入" : "Auto-fill with Person ID"}
                                                >
                                                    <ArrowDown size={10} />
                                                    {lang === 'zh' ? "ID 帶入" : "Use ID"}
                                                </button>
                                            </div>
                                            <input
                                                type={showSecrets ? "text" : "password"}
                                                value={localConfig.caPassword}
                                                placeholder="預設為身分證字號"
                                                onChange={(e) => handleChange('caPassword', e.target.value)}
                                                className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white focus:border-[#C8B085]/40 focus:outline-none transition-colors placeholder:text-zinc-800 ${errors.caPassword ? 'border-red-500 bg-red-500/5' : 'border-white/5'}`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 pb-2 flex items-center justify-between text-[10px] font-mono">
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-600 uppercase tracking-tighter font-bold">後端狀態:</span>
                                {backendStatus === 'checking' && (
                                    <div className="flex items-center gap-1.5 text-zinc-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse" />
                                        <span className="uppercase tracking-tighter">連線中...</span>
                                    </div>
                                )}
                                {backendStatus === 'sleeping' && (
                                    <div className="flex items-center gap-1.5 text-amber-400">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                                        <span>喚醒伺服器中... ⏳</span>
                                    </div>
                                )}
                                {backendStatus === 'ready' && (
                                    <div className="flex items-center gap-1.5 text-emerald-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        <span>已連線</span>
                                    </div>
                                )}
                                {backendStatus === 'server_only' && (
                                    <div className="flex items-center gap-1.5 text-amber-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                        <span>API 異常</span>
                                    </div>
                                )}
                                {backendStatus === 'offline' && (
                                    <div className="flex items-center gap-1.5 text-red-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        <span>無法連線</span>
                                    </div>
                                )}
                                <button
                                    onClick={handleManualPing}
                                    disabled={backendStatus === 'checking'}
                                    className="p-1 rounded-full hover:bg-white/10 text-slate-500 hover:text-white transition-colors disabled:opacity-50"
                                    title="手動喚醒"
                                >
                                    <RefreshCw size={10} className={backendStatus === 'checking' ? 'animate-spin' : ''} />
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
                                    {isTesting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                    <span>{isTesting ? '驗證中...' : '同步券商'}</span>
                                </button>
                            )}
                        </div>

                        {/* Progress & Error Messages */}
                        {(progressMsg || errorMsg) && (
                            <div className="px-6 pb-4 pt-2">
                                {progressMsg && (
                                    <div className="flex items-center gap-2 text-xs text-[#C8B085] animate-pulse">
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>{progressMsg}</span>
                                    </div>
                                )}
                                {errorMsg && !progressMsg && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                        <div className="flex items-start gap-2">
                                            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                            <span className="text-xs text-red-300">{errorMsg}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* ACCOUNT SELECTION MODAL */}
            {accountChoices.length > 0 && (
                <div className="fixed inset-0 z-[10005] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-[#1C1E22] rounded-3xl border border-[#C8B085]/30 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#C8B085]/5">
                            <div className="flex items-center gap-2 text-[#C8B085]">
                                <BrainCircuit size={18} />
                                <h4 className="text-sm font-bold uppercase tracking-widest">請選擇連線帳號</h4>
                            </div>
                            <button
                                onClick={() => setAccountChoices([])}
                                className="p-2 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <p className="text-xs text-zinc-400 mb-2 leading-relaxed">
                                您的憑證包含多個帳號，請選擇您希望同步的帳號(可多選)。
                            </p>

                            {accountChoices.map(acc => {
                                // 1. Check if this account is already connected
                                // We check against all existing configs to see if this account ID is present
                                const isConnected = configs.some(c => {
                                    const existingAccounts = (c.accounts || '').split(',').map(s => s.trim());
                                    const existingCodes = (c.branchCode || '').split(',').map(s => s.trim());
                                    // Robust check against ID or Branch Code
                                    return existingAccounts.includes(acc.account_id) || existingCodes.includes(acc.branch_code);
                                });

                                const isSelected = selectedIds.includes(acc.account_id);

                                const toggleLogic = () => {
                                    if (isConnected) return; // Prevent toggling if already connected

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
                                        disabled={isTesting || isConnected}
                                        onClick={toggleLogic}
                                        className={`
                                            w-full p-4 rounded-3xl border flex items-center justify-between transition-all cursor-pointer group 
                                            ${isConnected
                                                ? 'bg-zinc-900/50 border-white/5 opacity-60 cursor-not-allowed'
                                                : isSelected
                                                    ? 'bg-[#1C1E22] border-[#C8B085] shadow-[0_0_20px_rgba(200,176,133,0.1)]'
                                                    : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-black/60'}
                                        `}
                                    >
                                        <div className="flex flex-col items-start gap-2">
                                            <span className={`text-[14px] font-bold tracking-wide transition-colors ${isSelected && !isConnected ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
                                                {(() => {
                                                    // Backend已經返回完整的分公司名稱 (例如：永豐金-板新 (Stock))
                                                    // 只需移除括號內的帳戶類型部分
                                                    const branchName = acc.branch_name
                                                        ? acc.branch_name
                                                            .replace(/\s*\(.*\)/, '')
                                                            .replace(/永豐金-永豐金/g, '永豐金') // Fix double SinoPac
                                                            .trim()
                                                        : '分公司';
                                                    const userName = acc.username || '用戶';
                                                    return `${branchName} | ${userName}`;
                                                })()}
                                            </span>

                                            {/* Verification Status */}
                                            {acc.signed === false && (
                                                <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                                                    <ShieldCheck size={12} />
                                                    <span className="text-[10px] font-bold">需要模擬下單驗證</span>
                                                </div>
                                            )}

                                            {/* Row 2: Details */}
                                            <div className="flex items-center gap-3">
                                                {(() => {
                                                    const type = String(acc.account_type || '').toUpperCase();
                                                    const branch = String(acc.branch_name || '');
                                                    const desc = (acc as any).category; // New Backend Field

                                                    // Priority: Explicit Category > Type String > Branch Name
                                                    if (desc === 'SubBrokerage') return <span className={`text-[10px] px-3 py-0.5 rounded-full border font-bold w-[52px] flex items-center justify-center ${ACCOUNT_CATEGORY_THEMES.SUB.fullClass}`}>{ACCOUNT_CATEGORY_THEMES.SUB.label}</span>;
                                                    if (desc === 'Futures') return <span className={`text-[10px] px-3 py-0.5 rounded-full border font-bold w-[52px] flex items-center justify-center ${ACCOUNT_CATEGORY_THEMES.FUTURES.fullClass}`}>{ACCOUNT_CATEGORY_THEMES.FUTURES.label}</span>;
                                                    if (desc === 'Stock') return <span className={`text-[10px] px-3 py-0.5 rounded-full border font-bold w-[52px] flex items-center justify-center ${ACCOUNT_CATEGORY_THEMES.STOCK.fullClass}`}>{ACCOUNT_CATEGORY_THEMES.STOCK.label}</span>;

                                                    // Fallback Detection
                                                    const isFuture = type.includes('F') || type.includes('FUTURE') || branch.includes('期貨');
                                                    const isSub = type.includes('H') || type.includes('SUB') || branch.includes('複委託');

                                                    const theme = isSub ? ACCOUNT_CATEGORY_THEMES.SUB : isFuture ? ACCOUNT_CATEGORY_THEMES.FUTURES : ACCOUNT_CATEGORY_THEMES.STOCK;

                                                    return <span className={`text-[10px] px-3 py-0.5 rounded-full border font-bold w-[52px] flex items-center justify-center ${theme.fullClass}`}>{theme.label}</span>;
                                                })()}
                                                <span className="text-[12px] font-mono font-bold text-zinc-500">{acc.account_id}</span>
                                            </div>
                                        </div>

                                        {/* Right Side Check or Status */}
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isConnected
                                            ? 'bg-zinc-800 border-zinc-700'
                                            : isSelected
                                                ? 'bg-[#C8B085] border-[#C8B085] shadow-[0_0_10px_rgba(200,176,133,0.3)] border-2'
                                                : 'border-2 border-zinc-700 group-hover:border-zinc-500'
                                            }`}>
                                            {isConnected ? (
                                                <span className="text-[9px] font-bold text-zinc-500">已加</span>
                                            ) : (
                                                isSelected && <Check size={14} className="text-black stroke-[4px]" />
                                            )}
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
                                                    // Use backend's full branch name, just remove the account type in parentheses
                                                    // AND strip redundant broker name (e.g. "永豐金-板新" -> "板新")
                                                    const branchOnly = a.branch_name.split('(')[0].replace('永豐金-', '').replace('永豐金', '').trim();
                                                    // Robust Category Logic
                                                    const cat = (a as any).category; // New field from backend
                                                    const type = String(a.account_type || '').toUpperCase();

                                                    // Priority: Explicit Category > Type String > Branch Name
                                                    if (cat === 'SubBrokerage') return `${branchOnly}(複委託)`;
                                                    if (cat === 'Futures') return `${branchOnly}(期貨)`;
                                                    if (cat === 'Stock') return `${branchOnly}(台股)`;

                                                    // Fallback for old backend or ambiguous cases
                                                    if (type.includes('H') || type.includes('SUB')) return `${branchOnly}(複委託)`;
                                                    if (type.includes('F') || type.includes('FUTURE') || branchOnly.includes('期貨')) return `${branchOnly}(期貨)`;
                                                    return `${branchOnly}(台股)`;
                                                })
                                                .join(', ')
                                        };

                                        const result: any = await fetchBrokerProfile(updatedConfig);

                                        if (result.status === 'error') throw new Error(result.message || result.error);

                                        if (result.environment !== 'production') {
                                            throw new Error(lang === 'zh' ? "僅支援正式環境 (Production)" : "僅支援正式環境 (Production required)");
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

                                        if (isEditing === 'new') {
                                            // [Smart Merge Logic]
                                            // Check if we already have a config for this personId to avoid duplicates
                                            const existingConfig = configs.find(c => c.personId === finalConfig.personId);

                                            if (existingConfig) {
                                                // MERGE: Update existing config with new accounts
                                                const existAccs = (existingConfig.accounts || '').split(',').map(s => s.trim()).filter(Boolean);
                                                const existBranches = (existingConfig.branch || '').split(',').map(s => s.trim());

                                                // New data
                                                const newAccs = (finalConfig.accounts || '').split(',').map(s => s.trim()).filter(Boolean);
                                                const newBranches = (finalConfig.branch || '').split(',').map(s => s.trim());

                                                // Append only unique accounts
                                                newAccs.forEach((accId, idx) => {
                                                    if (!existAccs.includes(accId)) {
                                                        existAccs.push(accId);
                                                        // Append branch info (match index)
                                                        existBranches.push(newBranches[idx] || 'Unknown');
                                                    }
                                                });

                                                const mergedConfig = {
                                                    ...existingConfig,
                                                    ...finalConfig,     // Update credentials with latest successful ones
                                                    id: existingConfig.id, // CRITICAL: Keep existing ID
                                                    accounts: existAccs.join(','),
                                                    branch: existBranches.join(','),
                                                    // branchCode is often unused or mirrors accounts, merge strictly if present
                                                    branchCode: existAccs.join(',')
                                                };

                                                onUpdate(existingConfig.id, mergedConfig);
                                            } else {
                                                // No existing config -> Create new
                                                onAdd(finalConfig);
                                            }
                                        }
                                        else onUpdate(localConfig.id, finalConfig);

                                        setIsEditing(null);
                                        setIsTesting(false);
                                        setAccountChoices([]);
                                    } catch (error: any) {
                                        setErrorMsg(error?.message || '連線失敗 (Connection failed)');
                                        setIsTesting(false);
                                    }
                                }}
                                className="flex-[2] py-3 rounded-xl bg-[#C8B085] hover:bg-[#E0C8A0] text-black font-bold text-sm shadow-[0_0_20px_rgba(200,176,133,0.2)] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                            >
                                {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                確認同步已選帳號 ({selectedIds.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* DELETE CONFIRMATION MODAL */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[10006] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-sm bg-[#1C1E22] rounded-3xl border border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.1)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 flex flex-col items-center gap-4 text-center">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                                <AlertCircle size={32} className="text-red-500" />
                            </div>

                            <h4 className="text-lg font-bold text-white">
                                {lang === 'zh' ? '確定要刪除此帳號？' : 'Delete Account?'}
                            </h4>

                            <p className="text-sm text-zinc-400 leading-relaxed">
                                {lang === 'zh'
                                    ? '此動作無法復原。刪除後您將無法查閱此帳號的歷史交易紀錄。'
                                    : 'This action cannot be undone. You will lose access to historical data for this account.'}
                            </p>
                        </div>

                        <div className="p-4 border-t border-white/5 bg-zinc-900/50 flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white font-bold text-sm transition-all"
                            >
                                {lang === 'zh' ? '取消' : 'Cancel'}
                            </button>
                            <button
                                onClick={() => {
                                    const { configId, accountIndex } = deleteTarget;
                                    const config = configs.find(c => c.id === configId);

                                    if (config) {
                                        const currentBranches = (config.branch || '').split(',');
                                        const currentCodes = (config.branchCode || '').split(',');

                                        // If this is the only account, delete the whole config
                                        if (currentBranches.length <= 1) {
                                            onDelete(configId);
                                        } else {
                                            // Otherwise remove just this one
                                            // Robustly handle all arrays (branch, branchCode, accounts)
                                            // to ensure we delete the correct index across all fields
                                            const currentAccounts = (config.accounts || config.branchCode || '').split(',');

                                            // Helper to filter safely
                                            const filterAt = (arr: string[]) => arr.filter((_, i) => i !== accountIndex).join(',');

                                            // Handle potential length mismatches by padding before filtering? 
                                            // No, just filter what exists. If index is out of bounds for one array, it's fine.
                                            const newBranches = filterAt(currentBranches);

                                            // Code might be optional/shorter, but we attempt to filter it
                                            const newCodes = filterAt(currentCodes);

                                            // Accounts is the critical one for "Ghost" accounts
                                            const newAccounts = filterAt(currentAccounts);

                                            // Construct updated config
                                            const { ...rest } = config;
                                            const updatedConfig = {
                                                ...rest,
                                                branch: newBranches,
                                                branchCode: newCodes,
                                                accounts: newAccounts
                                            };

                                            // Call onUpdate to save the new account list
                                            onUpdate(configId, updatedConfig);
                                        }
                                    }
                                    setDeleteTarget(null);
                                }}
                                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all"
                            >
                                {lang === 'zh' ? '確認刪除' : 'Delete'}
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);
