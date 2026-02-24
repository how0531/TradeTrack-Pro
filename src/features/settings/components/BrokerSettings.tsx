import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Trash2, AlertCircle, FileKey, Check, Loader2, FolderOpen, ShieldCheck, BrainCircuit, RefreshCw, ChevronRight, ArrowDown, Upload, HelpCircle } from 'lucide-react';
import { BrokerConfig } from '../../../types';
import { fetchBrokerProfile, pingBackend, validateBackendStatus, wakeUpBackend, verifyBrokerAccount } from '../../../services/brokerService';
import { useEffect } from 'react';
import { ACCOUNT_CATEGORY_THEMES } from '../../../constants';
import { BrokerGuideModal } from './BrokerGuideModal';

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
    const [showApiHelper, setShowApiHelper] = useState(false);
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
    // 登入狀態追蹤（支援詳細階段）
    const [accountLoginStatus, setAccountLoginStatus] = useState<Record<string, {
        phase: 'connecting' | 'authenticating' | 'fetching_data' | 'success' | 'error',
        message?: string,
        error?: string
    }>>({});

    // ===== 優化新增狀態 =====
    // Stepper：控制登入 Modal 顯示哪一步
    const [loginStep, setLoginStep] = useState<1 | 2>(1);
    // 結構化進度：替代簡單的 progressMsg 字串
    const [loginProgress, setLoginProgress] = useState<{
        phase: 'idle' | 'waking' | 'connecting' | 'authenticating' | 'listing' | 'done',
        message: string,
        startTime: number | null
    }>({ phase: 'idle', message: '', startTime: null });
    // 計時器：顯示已等待秒數
    const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    // 登入成功結果摘要
    const [loginResult, setLoginResult] = useState<{
        show: boolean,
        successCount: number,
        failCount: number,
        accounts: { name: string, success: boolean, error?: string }[]
    } | null>(null);

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
        setLoginStep(1); // 重置 Stepper 回第一步
        setLoginResult(null); // 清除上次結果
    };

    // ===== 錯誤分類器：將技術性錯誤轉為友善訊息 =====
    const classifyError = useCallback((rawMsg: string): { message: string, action?: 'retry' | 'upload_ca' | 'sign_api' } => {
        if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
            return {
                message: '無法連接後端伺服器。服務可能正在冷啟動中（約 30 秒），請點擊重試。',
                action: 'retry'
            };
        }
        if (rawMsg.includes('key:') && rawMsg.includes('not exist')) {
            return {
                message: 'API Key 無效或不存在，請至永豐金管理頁面重新確認金鑰。',
                action: 'retry'
            };
        }
        if (rawMsg.includes('CA') || rawMsg.includes('憑證未啟動') || rawMsg.includes('找不到憑證')) {
            return {
                message: 'CA 憑證問題：請重新上傳 .pfx 憑證檔案。',
                action: 'upload_ca'
            };
        }
        if (rawMsg.includes('Account Not Acceptable')) {
            return {
                message: '帳號未授權，請先至永豐金網站簽署 API 風險預告同意書。',
                action: 'sign_api'
            };
        }
        if (rawMsg.includes('timeout') || rawMsg.includes('Timeout') || rawMsg.includes('AbortError')) {
            return {
                message: '伺服器回應超時，可能正在忙碌中。請稍等 10 秒後重試。',
                action: 'retry'
            };
        }
        return { message: rawMsg };
    }, []);

    // ===== 計時器控制 =====
    const startElapsedTimer = useCallback(() => {
        setElapsedSeconds(0);
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);
    }, []);

    const stopElapsedTimer = useCallback(() => {
        if (elapsedTimerRef.current) {
            clearInterval(elapsedTimerRef.current);
            elapsedTimerRef.current = null;
        }
    }, []);

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
        startElapsedTimer();

        // Validation
        const newErrors: Record<string, boolean> = {};
        if (!localConfig.personId) newErrors.personId = true;
        if (!localConfig.apiKey) newErrors.apiKey = true;
        if (!localConfig.apiSecret) newErrors.apiSecret = true;
        if (!localConfig.caPath) newErrors.caPath = true;
        if (!localConfig.caPassword) newErrors.caPassword = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setErrorMsg('請填寫所有必填欄位');
            setIsTesting(false);
            stopElapsedTimer();
            return;
        }
        setErrors({});

        try {
            // 階段 1: 喚醒後端（如果已 ready 則跳過）
            if (backendStatus !== 'ready') {
                setLoginProgress({ phase: 'waking', message: '正在喚醒後端伺服器...', startTime: Date.now() });
                setProgressMsg('🔄 正在喚醒後端伺服器...');
                setErrorMsg(null);

                const wakeResult = await wakeUpBackend();
                if (!wakeResult.success) {
                    const classified = classifyError(wakeResult.error || 'Backend unreachable');
                    setErrorMsg(classified.message);
                    setIsTesting(false);
                    setProgressMsg('');
                    setLoginProgress({ phase: 'idle', message: '', startTime: null });
                    stopElapsedTimer();
                    return;
                }
                setBackendStatus('ready');
            }

            // 階段 2: 連接券商 API
            setLoginProgress({ phase: 'connecting', message: '正在連接券商 API...', startTime: Date.now() });
            setProgressMsg('🔑 正在驗證憑證與連線...');

            // 短暫延遲讓狀態變化可見
            await new Promise(r => setTimeout(r, 200));

            // 階段 3: 驗證身份
            setLoginProgress({ phase: 'authenticating', message: '正在驗證身份...', startTime: Date.now() });
            setProgressMsg('🔐 正在驗證身份...');

            const result = await fetchBrokerProfile(localConfig, (msg) => {
                setProgressMsg(msg);
            });

            // 階段 4: 取得帳號列表
            setLoginProgress({ phase: 'listing', message: '正在取得帳號列表...', startTime: Date.now() });

            if (result.status === 'multiple_accounts' && result.accounts) {
                setAccountChoices(result.accounts);

                // Track which ones are signed
                const signedIds = result.accounts.filter((a: any) => a.signed).map((a: any) => a.account_id).join(',');
                if (localConfig) setLocalConfig({ ...localConfig, signedAccounts: signedIds });

                setProgressMsg('');
                setLoginProgress({ phase: 'done', message: '已取得帳號列表', startTime: null });
                setIsTesting(false);
                stopElapsedTimer();
                return;
            }

            if (result.environment !== 'production') {
                throw new Error('僅支援正式環境 (Production)');
            }

            const updated: BrokerConfig = {
                ...localConfig,
                isConnected: true,
                branch: result.branch || localConfig.branch,
                branchCode: result.branchCode,
                accounts: result.accountId || result.branchCode,
                brokerUsername: result.username,
                environment: result.environment
            };

            if (result.signedAccounts && result.signedAccounts.length > 0) {
                updated.signedAccounts = result.signedAccounts.join(',');
            }

            setLocalConfig(updated);
            if (isEditing === 'new') onAdd(updated);
            else onUpdate(localConfig.id, updated);

            setLoginProgress({ phase: 'done', message: '登入成功', startTime: null });
            setIsEditing(null);
            setIsTesting(false);
            setAccountChoices([]);
            setProgressMsg('');
            stopElapsedTimer();
        } catch (error: any) {
            const rawMsg = error?.message || '連線失敗 (Connection failed)';
            const classified = classifyError(rawMsg);
            setErrorMsg(classified.message);

            // 網路錯誤時嘗試預喚醒
            if (classified.action === 'retry') {
                pingBackend();
            }
            setIsTesting(false);
            setProgressMsg('');
            setLoginProgress({ phase: 'idle', message: '', startTime: null });
            stopElapsedTimer();
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
        // 後端 verify_simulation_account 永遠使用 simulation=True 登入，所以任何環境都可以安全使用
        setIsVerifying(accountId);
        setErrorMsg(null);
        setProgressMsg('正在執行 Python 模擬下單驗證 API 權限...');

        try {
            const result = await verifyBrokerAccount(config, accountId);
            if (result.status === 'success') {
                // 更新 signedAccounts 清單
                const currentSigned = (config.signedAccounts || '').split(',').filter(Boolean);
                if (!currentSigned.includes(accountId)) {
                    const newSigned = [...currentSigned, accountId].join(',');
                    const updated = { ...config, signedAccounts: newSigned };
                    if (localConfig?.id === config.id) setLocalConfig(updated);
                    onUpdate(config.id, updated);
                }
                // 更新 accountChoices 中的 signed 狀態
                setAccountChoices(prev => prev.map(a =>
                    a.account_id === accountId ? { ...a, signed: true } : a
                ));
                setProgressMsg('✅ 驗證成功！');
                setTimeout(() => setProgressMsg(''), 3000);
            } else if (result.status === 'pending') {
                setProgressMsg(result.message || '測試訂單已送出，請等待 5 分鐘後重新檢查。');
                setTimeout(() => setProgressMsg(''), 8000);
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

            <div className="grid grid-cols-2 gap-3">
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
                                                <div className="group/badge relative flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-500/10 border border-zinc-500/20 cursor-help">
                                                    <span className="text-[9px] font-bold text-zinc-500 uppercase whitespace-nowrap">尚未支援</span>
                                                    {/* Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] px-2 py-1 bg-zinc-800 text-zinc-300 text-[10px] rounded border border-white/10 opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none z-50">
                                                        目前僅支援台股證券與期貨帳號，複委託尚未開放。
                                                    </div>
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

                                            {/* Enhanced Connection Status Label - REMOVED per user request */}
                                            {/* Verification Status Tag - REMOVED: 已移至 hover 操作列避免重複 */}
                                        </div>
                                    </div>

                                    {/* Action Buttons (Absolute Bottom Right on Hover, but slightly adjusted for centered layout) */}
                                    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md rounded-lg p-0.5 border border-white/10 z-50">
                                        {config.provider === 'shioaji' && config.signedAccounts !== undefined && !(config.signedAccounts || '').split(',').map(s => s.trim()).includes(accId) && !isSub && (
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
                                        <button onClick={() => handleStartEdit(config.id)} className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-all" title="編輯"><FileKey size={12} /></button>
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
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4">
                    <div className="w-full max-w-[95vw] sm:max-w-md bg-[#1C1E22] rounded-3xl border border-white/10 shadow-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-zinc-800/50 flex justify-between items-center">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                                {isEditing === 'new' ? '新增券商帳號' : '編輯帳號資訊'}
                            </h4>
                            <button onClick={() => setIsEditing(null)} className="p-2 rounded-xl bg-white/5 text-zinc-600 hover:text-white transition-colors"><X size={20} /></button>
                        </div>

                        {/* ===== Stepper 進度條 ===== */}
                        <div className="px-4 sm:px-6 pt-4 pb-8 shrink-0">
                            <div className="flex items-center w-full px-2">
                                {/* 步驟 1 */}
                                <div className="relative flex flex-col items-center">
                                    <button
                                        type="button"
                                        onClick={() => !isTesting && setLoginStep(1)}
                                        className={`w-8 h-8 rounded-full z-10 relative flex items-center justify-center text-[11px] font-bold transition-all duration-300 border-2 bg-[#1C1E22] shrink-0
                                            ${loginStep > 1
                                                ? 'border-emerald-500/60 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                                : 'border-[#C8B085] text-[#C8B085] shadow-[0_0_12px_rgba(200,176,133,0.3)]'
                                            }`}
                                    >
                                        {loginStep > 1 ? <Check size={14} strokeWidth={3} /> : 1}
                                    </button>
                                    <span className="absolute top-10 whitespace-nowrap text-[9px] font-bold uppercase tracking-wider text-zinc-300">
                                        填寫資訊
                                    </span>
                                </div>

                                {/* 彈性連接線區塊 (Flex-1) */}
                                <div className="flex-1 h-[2px] bg-white/5 mx-2 rounded-full relative overflow-hidden flex items-center">
                                    <div
                                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#C8B085] via-[#E0C8A0] to-[#C8B085] shadow-[0_0_10px_rgba(200,176,133,0.5)] transition-all duration-700 ease-out w-full"
                                        style={{ transform: loginStep === 1 ? 'translateX(-100%)' : 'translateX(0)' }}
                                    />
                                </div>

                                {/* 步驟 2 */}
                                <div className="relative flex flex-col items-center">
                                    <button
                                        type="button"
                                        onClick={() => !isTesting && setLoginStep(2)}
                                        className={`w-8 h-8 rounded-full z-10 relative flex items-center justify-center text-[11px] font-bold transition-all duration-300 border-2 bg-[#1C1E22] shrink-0
                                            ${loginStep === 2
                                                ? 'border-[#C8B085] text-[#C8B085] shadow-[0_0_12px_rgba(200,176,133,0.3)]'
                                                : 'border-zinc-700 text-zinc-600'
                                            }`}
                                    >
                                        2
                                    </button>
                                    <span className={`absolute top-10 whitespace-nowrap text-[9px] font-bold uppercase tracking-wider transition-colors
                                        ${loginStep === 2 ? 'text-zinc-300' : 'text-zinc-600'}
                                    `}>
                                        上傳憑證
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 sm:p-5 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            {/* ===== 錯誤訊息（含快捷修復按鈕）===== */}
                            {errorMsg && (
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[11px] font-bold text-red-300 leading-relaxed block">{errorMsg}</span>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {/* 重試按鈕 */}
                                                <button
                                                    onClick={handleTestConnection}
                                                    disabled={isTesting}
                                                    className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-[9px] font-bold rounded-lg transition-colors flex items-center gap-1"
                                                >
                                                    <RefreshCw size={10} /> 重試
                                                </button>
                                                {/* CA 相關錯誤顯示上傳按鈕 */}
                                                {errorMsg.includes('憑證') && (
                                                    <label
                                                        htmlFor="ca-upload"
                                                        className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[9px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                                    >
                                                        <Upload size={10} /> 上傳憑證
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}


                            {/* STEP 1: 取得金鑰 + 填寫資訊（合併） - 僅在 loginStep === 1 時顯示 */}
                            {loginStep === 1 && (
                                <>
                                    <div className="relative pl-6 sm:pl-10">
                                        <div className="relative z-10 pt-1">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                                <div className="flex items-start gap-2.5">
                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                        <span className="text-xs sm:text-sm font-bold text-[#C8B085] uppercase">取得 API 金鑰與憑證</span>
                                                        <span className="text-[9px] sm:text-[10px] text-amber-500/50 break-words font-medium">尚未申請？點擊下方按鈕前往開通</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                                    <button
                                                        onClick={() => setShowApiHelper(true)}
                                                        className="shrink-0 w-full sm:w-auto px-3 py-1.5 rounded-lg bg-transparent hover:bg-white/5 border border-white/20 hover:border-white/50 text-zinc-300 hover:text-white text-[9px] font-bold flex items-center justify-center sm:justify-start gap-1 transition-all group uppercase tracking-wider"
                                                    >
                                                        如何開通? <HelpCircle size={10} className="group-hover:scale-110 transition-transform" />
                                                    </button>
                                                    <button
                                                        onClick={() => window.open('https://www.sinotrade.com.tw/newweb/PythonAPIKey/', '_blank')}
                                                        className="shrink-0 w-full sm:w-auto px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[9px] font-bold flex items-center justify-center sm:justify-start gap-1 transition-all group border border-amber-500/20 uppercase tracking-wider"
                                                    >
                                                        管理頁面 <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* STEP 1 (續): 輸入 API 資訊 */}
                                    <div className="relative pl-6 sm:pl-10 mt-4">
                                        <div className="absolute -left-1 -top-2 text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white/70 to-transparent opacity-30 select-none pointer-events-none font-sans">2</div>
                                        <div className="relative z-10 pt-1">
                                            <h5 className="text-sm font-bold text-[#C8B085] mb-4 uppercase tracking-widest pl-1">輸入用戶資訊</h5>
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 gap-4">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">身分證字號 (Person ID)</label>
                                                        <input
                                                            type="text"
                                                            placeholder="A123456789"
                                                            value={localConfig.personId}
                                                            onChange={(e) => handleChange('personId', e.target.value.trim().toUpperCase())}
                                                            autoComplete="off"
                                                            spellCheck={false}
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
                                                        autoComplete="off"
                                                        spellCheck={false}
                                                        className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-xs font-mono text-white focus:border-[#C8B085]/40 focus:outline-none transition-colors ${errors.apiKey ? 'border-red-500 bg-red-500/5' : 'border-white/5'}`}
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-2 relative">
                                                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">Secret Key</label>
                                                    <input
                                                        type={showSecrets ? "text" : "password"}
                                                        value={localConfig.apiSecret}
                                                        onChange={(e) => handleChange('apiSecret', e.target.value.trim())}
                                                        autoComplete="off"
                                                        spellCheck={false}
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


                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* STEP 2: 匯入憑證 - 僅在 loginStep === 2 時顯示 */}
                            {loginStep === 2 && (
                                <div className="relative pl-6 sm:pl-10 mt-4">
                                    <div className="absolute -left-1 -top-2 text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white/70 to-transparent opacity-30 select-none pointer-events-none font-sans">2</div>
                                    <div className="relative z-10 pt-1">
                                        <h5 className="text-sm font-bold text-[#C8B085] mb-4 uppercase tracking-widest pl-1">匯入憑證</h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">憑證密碼</label>
                                                <div className="relative">
                                                    <input
                                                        type={showSecrets ? "text" : "password"}
                                                        value={localConfig.caPassword}
                                                        placeholder="預設為身分證字號"
                                                        onChange={(e) => handleChange('caPassword', e.target.value)}
                                                        autoComplete="off"
                                                        spellCheck={false}
                                                        className={`w-full bg-black/40 border rounded-xl pl-4 pr-20 py-3 text-sm text-white focus:border-[#C8B085]/40 focus:outline-none transition-colors placeholder:text-zinc-800 ${errors.caPassword ? 'border-red-500 bg-red-500/5' : 'border-white/5'}`}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleChange('caPassword', localConfig.personId)}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/5 hover:bg-white/10 text-[#C8B085] hover:text-[#E0C8A0] text-[10px] font-bold px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1 backdrop-blur-sm border border-white/5"
                                                        title={lang === 'zh' ? "使用身分證字號自動帶入" : "Auto-fill with Person ID"}
                                                    >
                                                        {lang === 'zh' ? "ID 帶入" : "Use ID"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ===== 增強型進度面板 ===== */}
                        {isTesting && (
                            <div className="px-6 py-3 bg-black/30 border-t border-white/5">
                                {/* 階段式進度模塊 */}
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="relative w-6 h-6 flex items-center justify-center">
                                        <Loader2 size={18} className="animate-spin text-[#C8B085]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-bold text-[#C8B085] block">{progressMsg || '正在處理...'}</span>
                                        <span className="text-[10px] text-zinc-500 font-mono">已等待 {elapsedSeconds} 秒</span>
                                    </div>
                                </div>
                                {/* 超過 15 秒的安撫訊息 */}
                                {elapsedSeconds > 15 && (
                                    <div className="text-[10px] text-amber-400/70 bg-amber-500/5 rounded-lg px-3 py-1.5 border border-amber-500/10 animate-in fade-in duration-500">
                                        ☕ 雲端伺服器冷啟動中，通常需要 20-30 秒，請稍候...
                                    </div>
                                )}
                                {/* 階段視覺化進度條 */}
                                <div className="flex items-center gap-1 mt-2">
                                    {['waking', 'connecting', 'authenticating', 'listing'].map((phase, i) => (
                                        <div
                                            key={phase}
                                            className={`h-1 flex-1 rounded-full transition-all duration-500 ${loginProgress.phase === phase
                                                ? 'bg-[#C8B085] animate-pulse'
                                                : ['waking', 'connecting', 'authenticating', 'listing'].indexOf(loginProgress.phase) > i
                                                    ? 'bg-emerald-500/60'
                                                    : 'bg-zinc-800'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 後端狀態 + 計時器 */}
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

                        {/* ===== Footer: 步驟導航按鈕 ===== */}
                        <div className="p-4 sm:p-6 border-t border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-black/20 font-bold uppercase tracking-tight text-[10px]">
                            {/* 上一步 / 僅儲存 */}
                            {loginStep === 1 ? (
                                <button onClick={handleSave} className="w-full sm:w-auto flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 order-2 sm:order-1">僅儲存</button>
                            ) : (
                                <button
                                    onClick={() => setLoginStep(prev => Math.max(1, prev - 1) as 1 | 2)}
                                    className="w-full sm:w-auto flex-1 py-4 rounded-2xl bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 order-2 sm:order-1 flex items-center justify-center gap-1"
                                >
                                    <ChevronRight size={12} className="rotate-180" /> 上一步
                                </button>
                            )}
                            {/* 下一步 / 同步券商 */}
                            {accountChoices.length === 0 && (
                                loginStep < 2 ? (
                                    <button
                                        onClick={() => setLoginStep(prev => Math.min(2, prev + 1) as 1 | 2)}
                                        className="w-full sm:w-auto flex-[2] py-4 px-8 rounded-2xl bg-[#C8B085] text-black hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 order-1 sm:order-2"
                                    >
                                        <span>下一步</span> <ChevronRight size={14} />
                                    </button>
                                ) : (
                                    <button
                                        disabled={isTesting}
                                        onClick={handleTestConnection}
                                        className="w-full sm:w-auto flex-[2] py-4 px-8 rounded-2xl bg-[#C8B085] text-black hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 order-1 sm:order-2"
                                    >
                                        {isTesting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                        <span>{isTesting ? '驗證中...' : '同步券商'}</span>
                                    </button>
                                )
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
                                <BrainCircuit size={18} />
                                <h4 className="text-sm font-bold uppercase tracking-widest">請選擇連線帳號</h4>
                            </div>
                            <button
                                onClick={() => {
                                    setAccountChoices([]);
                                    setErrorMsg(null);
                                }}
                                className="p-2 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                    您的憑證包含多個帳號，請選擇想同步的帳號。
                                </p>
                                {/* 全選 / 取消全選按鈕 */}
                                {(() => {
                                    // 計算可選帳號（排除已連線）
                                    const selectableAccounts = accountChoices.filter(acc => {
                                        const isConnected = configs.some(c => {
                                            const existing = (c.accounts || '').split(',').map(s => s.trim());
                                            const existingCodes = (c.branchCode || '').split(',').map(s => s.trim());
                                            return existing.includes(acc.account_id) || existingCodes.includes(acc.branch_code);
                                        });
                                        return !isConnected;
                                    });
                                    const allSelected = selectableAccounts.length > 0 && selectableAccounts.every(a => selectedIds.includes(a.account_id));
                                    return selectableAccounts.length > 1 && (
                                        <button
                                            onClick={() => {
                                                if (allSelected) {
                                                    setSelectedIds([]);
                                                } else {
                                                    setSelectedIds(selectableAccounts.map(a => a.account_id));
                                                }
                                            }}
                                            className="text-[10px] font-bold text-[#C8B085] hover:underline transition-colors px-2 py-1 rounded-lg hover:bg-[#C8B085]/5"
                                        >
                                            {allSelected ? '取消全選' : '全選'}
                                        </button>
                                    );
                                })()}
                            </div>

                            {/* 依 category 分組顯示 */}
                            {(() => {
                                // 將帳號依類別分組
                                const groups: Record<string, typeof accountChoices> = {};
                                accountChoices.forEach(acc => {
                                    const cat = (acc as any).category || 'Stock';
                                    if (!groups[cat]) groups[cat] = [];
                                    groups[cat].push(acc);
                                });
                                // 顯示順序：台股 → 期貨 → 複委託
                                const order = ['Stock', 'Futures', 'SubBrokerage'];
                                const groupLabels: Record<string, string> = {
                                    'Stock': '台股證券',
                                    'Futures': '期貨',
                                    'SubBrokerage': '複委託'
                                };
                                return order.filter(cat => groups[cat]?.length > 0).map(cat => (
                                    <div key={cat} className={`rounded-2xl border mb-3 overflow-hidden ${cat === 'SubBrokerage' ? 'border-purple-500/30 bg-purple-500/5'
                                            : cat === 'Futures' ? 'border-sky-500/30 bg-sky-500/5'
                                                : 'border-rose-500/30 bg-rose-500/5'
                                        }`}>
                                        {/* 群組標題 列 */}
                                        <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/5">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${cat === 'SubBrokerage' ? ACCOUNT_CATEGORY_THEMES.SUB.fullClass
                                                        : cat === 'Futures' ? ACCOUNT_CATEGORY_THEMES.FUTURES.fullClass
                                                            : ACCOUNT_CATEGORY_THEMES.STOCK.fullClass
                                                    }`}>
                                                    {groupLabels[cat] || cat}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold min-w-[124px] justify-end pr-2">
                                                <span className="w-14 text-center">簽署</span>
                                                <span className="w-14 text-center">驗證</span>
                                            </div>
                                        </div>

                                        {/* 帳號列表 */}
                                        <div className="flex flex-col divide-y divide-white/5">
                                            {groups[cat].map(acc => {
                                                const isConnected = configs.some(c => {
                                                    const existingAccounts = (c.accounts || '').split(',').map(s => s.trim());
                                                    const existingCodes = (c.branchCode || '').split(',').map(s => s.trim());
                                                    return existingAccounts.includes(acc.account_id) || existingCodes.includes(acc.branch_code);
                                                });

                                                const isSelected = selectedIds.includes(acc.account_id);
                                                const isSub = cat === 'SubBrokerage';

                                                const handleClick = () => {
                                                    if (isConnected || isTesting) return;
                                                    if (isSelected) {
                                                        setSelectedIds(prev => prev.filter(id => id !== acc.account_id));
                                                    } else {
                                                        setSelectedIds(prev => [...prev, acc.account_id]);
                                                    }
                                                };

                                                const branchName = acc.branch_name
                                                    ? acc.branch_name
                                                        .replace(/\s*\(.*\)/, '')
                                                        .replace(/永豐金-永豐金/g, '永豐金')
                                                        .trim()
                                                    : '分公司';
                                                const userName = acc.username || '用戶';
                                                // Shioaji 的 acc.signed 是複合旗標：
                                                //   true  = 已簽署 API 風險預告同意書 + 已通過 Python 模擬下單測試
                                                //   false = 尚未完成簽署 或 尚未通過測試
                                                const isSigned = acc.signed === true;
                                                // 驗證 = 已通過 Python 測試（同 signed），或已在本 App 成功連線
                                                const isVerified = acc.signed === true || isConnected || accountLoginStatus[acc.account_id]?.phase === 'success';

                                                return (
                                                    <div
                                                        key={acc.account_id}
                                                        onClick={handleClick}
                                                        className={`
                                                            w-full p-3 px-4 flex items-center gap-3 transition-all select-none
                                                            ${isConnected
                                                                ? cat === 'Futures'
                                                                    ? 'bg-gradient-to-br from-[#1E40AF]/20 to-zinc-950/50 border-t border-[#1E40AF]/40 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl cursor-default'
                                                                    : cat === 'SubBrokerage'
                                                                        ? 'bg-gradient-to-br from-zinc-800/30 to-zinc-950/60 border-t border-white/10 grayscale opacity-80 cursor-default'
                                                                        : 'bg-gradient-to-br from-[#D05A5A]/15 to-zinc-950/50 border-t border-[#D05A5A]/30 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl cursor-default'
                                                                : 'cursor-pointer hover:bg-white/5 active:bg-white/10'}
                                                            ${isSelected && !isConnected ? 'bg-[#C8B085]/10' : ''}
                                                        `}
                                                    >
                                                        {/* ① 最左側：Checkbox 或「已綁定」標記 */}
                                                        <div className="shrink-0 flex items-center justify-center w-6">
                                                            {isConnected ? (
                                                                <div className="flex flex-col items-center justify-between h-[38px] py-[1px] text-[10px] font-bold text-zinc-500/70 leading-none">
                                                                    <span>已</span>
                                                                    <span>綁</span>
                                                                    <span>定</span>
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected
                                                                            ? 'bg-[#C8B085] border-[#C8B085] shadow-[0_0_8px_rgba(200,176,133,0.3)]'
                                                                            : 'border-zinc-600 hover:border-zinc-400'
                                                                        }`}
                                                                >
                                                                    {isSelected && <Check size={12} className="text-black stroke-[4px]" />}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* ② 中間：券商名稱與帳號 */}
                                                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                                            <span className={`text-[13px] font-bold tracking-wide transition-colors truncate ${isSelected && !isConnected ? 'text-[#C8B085]' : 'text-zinc-300'}`}>
                                                                {branchName}
                                                            </span>
                                                            <span className="text-[11px] text-zinc-500 font-medium truncate">
                                                                {userName} - <span className="font-mono">{acc.account_id}</span>
                                                            </span>
                                                            {isSub && (
                                                                <span className="text-[9px] text-zinc-600 mt-0.5">尚未開放支援</span>
                                                            )}
                                                        </div>

                                                        {/* ③ 右側：簽署 + 驗證 互動按鈕 */}
                                                        <div className="shrink-0 flex items-center gap-2 min-w-[124px] justify-end pr-2">
                                                            {/* 簽署欄位 */}
                                                            <div className="w-14 flex justify-center">
                                                                {isSigned ? (
                                                                    <Check size={14} className="text-emerald-500 stroke-[3px]" />
                                                                ) : (
                                                                    <a
                                                                        href="https://www.sinotrade.com.tw/newweb/signCenter/S_openAPI/"
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={e => e.stopPropagation()}
                                                                        className="px-2.5 py-0.5 rounded-full text-[9px] font-bold border border-amber-500/30 text-amber-400 bg-amber-500/5 backdrop-blur-sm hover:bg-amber-500/15 hover:border-amber-500/50 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                                                                    >
                                                                        簽署
                                                                    </a>
                                                                )}
                                                            </div>
                                                            {/* 驗證欄位 */}
                                                            <div className="w-14 flex justify-center">
                                                                {isVerified ? (
                                                                    <Check size={14} className="text-emerald-500 stroke-[3px]" />
                                                                ) : accountLoginStatus[acc.account_id]?.phase === 'connecting' ? (
                                                                    <Loader2 size={14} className="animate-spin text-blue-400" />
                                                                ) : accountLoginStatus[acc.account_id]?.phase === 'authenticating' ? (
                                                                    <Loader2 size={14} className="animate-spin text-yellow-400" />
                                                                ) : accountLoginStatus[acc.account_id]?.phase === 'fetching_data' ? (
                                                                    <Loader2 size={14} className="animate-spin text-purple-400" />
                                                                ) : accountLoginStatus[acc.account_id]?.phase === 'error' ? (
                                                                    <X size={14} className="text-red-500 stroke-[4px]" />
                                                                ) : isVerifying === acc.account_id ? (
                                                                    <div className="px-2 py-0.5 rounded-full text-[9px] font-bold border border-blue-500/30 text-blue-400 bg-blue-500/5 backdrop-blur-sm flex items-center gap-1 whitespace-nowrap">
                                                                        <Loader2 size={9} className="animate-spin" /> 測試中
                                                                    </div>
                                                                ) : !isSigned ? (
                                                                    <span className="text-[10px] text-zinc-600">—</span>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (localConfig) handleVerifyAccount(localConfig, acc.account_id);
                                                                        }}
                                                                        className="px-2.5 py-0.5 rounded-full text-[9px] font-bold border border-sky-500/30 text-sky-400 bg-sky-500/5 backdrop-blur-sm hover:bg-sky-500/15 hover:border-sky-500/50 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                                                                    >
                                                                        測試
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ));
                            })()}

                            {/* ===== 條件警語 ===== */}
                            {(() => {
                                const hasUnsigned = accountChoices.some(a => a.signed === false);
                                const hasSignedButUnverified = accountChoices.some(a => {
                                    if (a.signed === false) return false;
                                    const isConn = configs.some(c => {
                                        const existAcc = (c.accounts || '').split(',').map(s => s.trim());
                                        const existCode = (c.branchCode || '').split(',').map(s => s.trim());
                                        return existAcc.includes(a.account_id) || existCode.includes(a.branch_code);
                                    });
                                    return !isConn && accountLoginStatus[a.account_id]?.phase !== 'success';
                                });
                                if (!hasUnsigned && !hasSignedButUnverified) return null;
                                return (
                                    <div className="flex flex-col gap-1.5 px-1 mt-1">
                                        {hasUnsigned && (
                                            <div className="flex items-start gap-2 text-[10px] text-amber-500/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
                                                <ShieldCheck size={13} className="shrink-0 mt-0.5" />
                                                <span>證券、期貨帳號需<strong>分開簽署</strong>，請至永豐金簽署中心依序完成。</span>
                                            </div>
                                        )}
                                        {hasSignedButUnverified && (
                                            <div className="flex items-start gap-2 text-[10px] text-sky-400/80 bg-sky-500/5 border border-sky-500/15 rounded-lg px-3 py-2">
                                                <ShieldCheck size={13} className="shrink-0 mt-0.5" />
                                                <span>首次使用須於<strong>營業日 8:00~20:00</strong> 進行驗證（模擬下單測試）。</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Error Message inside Modal */}
                        {errorMsg && (
                            <div className="px-5 pb-2">
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                    <span className="text-xs text-red-300 font-bold leading-relaxed">{errorMsg}</span>
                                </div>
                            </div>
                        )}

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
                                    // ✅ 直接使用 accountChoices（multiple_accounts 回應），不再逐帳號呼叫後端
                                    setIsTesting(true);
                                    setErrorMsg(null);
                                    setProgressMsg('');

                                    try {
                                        if (!localConfig) return;

                                        const selectedAccounts = accountChoices.filter(a => selectedIds.includes(a.account_id));

                                        if (selectedAccounts.length === 0) {
                                            throw new Error('請至少選擇一個帳號');
                                        }

                                        // 直接從 accountChoices 建構帳號資訊（無需額外 API 呼叫）
                                        setProgressMsg(`正在設定 ${selectedAccounts.length} 個帳號...`);

                                        // 為所有帳號立即標記成功
                                        const allStatus: Record<string, {
                                            phase: 'connecting' | 'authenticating' | 'fetching_data' | 'success' | 'error',
                                            message?: string,
                                            error?: string
                                        }> = {};
                                        selectedAccounts.forEach(acc => {
                                            allStatus[acc.account_id] = { phase: 'success', message: '綁定成功' };
                                        });
                                        setAccountLoginStatus(allStatus);

                                        // Build branchName for each account
                                        const successfulResults = selectedAccounts.map(account => {
                                            const branchOnly = account.branch_name.split('(')[0].replace('永豐金-', '').replace('永豐金', '').trim();
                                            const cat = (account as any).category;
                                            const type = String(account.account_type || '').toUpperCase();

                                            let branchName: string;
                                            if (cat === 'SubBrokerage') branchName = `${branchOnly}(複委託)`;
                                            else if (cat === 'Futures') branchName = `${branchOnly}(期貨)`;
                                            else if (cat === 'Stock') branchName = `${branchOnly}(台股)`;
                                            else if (type.includes('H') || type.includes('SUB')) branchName = `${branchOnly}(複委託)`;
                                            else if (type.includes('F') || type.includes('FUTURE') || branchOnly.includes('期貨')) branchName = `${branchOnly}(期貨)`;
                                            else branchName = `${branchOnly}(台股)`;

                                            return { account, branchName };
                                        });

                                        // Clear cache
                                        try {
                                            localStorage.removeItem('broker_configs_cache');
                                        } catch (e) { console.warn('Cache clear failed', e); }

                                        // Merge into existing or create new config
                                        const targetPersonId = localConfig.personId;
                                        const existingConfig = configs.find(c => c.personId === targetPersonId);

                                        let finalAccounts: string[] = [];
                                        let finalBranches: string[] = [];
                                        let finalCodes: string[] = [];
                                        // Use first account's data for environment/username
                                        const firstAcc = selectedAccounts[0];
                                        let baseConfig = existingConfig || {
                                            ...localConfig,
                                            id: `broker-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                            isConnected: true,
                                            environment: firstAcc.environment || 'production',
                                            brokerUsername: firstAcc.username || localConfig.brokerUsername
                                        };

                                        if (existingConfig) {
                                            finalAccounts = (existingConfig.accounts || '').split(',').map(s => s.trim()).filter(Boolean);
                                            finalBranches = (existingConfig.branch || '').split(',').map(s => s.trim()).filter(Boolean);
                                            finalCodes = (existingConfig.branchCode || '').split(',').map(s => s.trim()).filter(Boolean);
                                        } else {
                                            baseConfig = {
                                                ...baseConfig,
                                                id: `broker-${Date.now()}`,
                                                accounts: '',
                                                branch: '',
                                                branchCode: ''
                                            };
                                        }

                                        // Append new accounts (avoid duplicates)
                                        successfulResults.forEach(({ account, branchName }) => {
                                            const accId = account.account_id;
                                            const bCode = account.account_id || account.branch_code;
                                            if (!finalAccounts.includes(accId)) {
                                                finalAccounts.push(accId);
                                                finalBranches.push(branchName);
                                                finalCodes.push(bCode);
                                            }
                                        });

                                        // Build signed accounts list
                                        const signedIds = selectedAccounts
                                            .filter(a => a.signed === true)
                                            .map(a => a.account_id);
                                        const existingSignedIds = (baseConfig.signedAccounts || '').split(',').filter(Boolean);
                                        const allSignedIds = [...new Set([...existingSignedIds, ...signedIds])];

                                        const mergedConfig: BrokerConfig = {
                                            ...baseConfig,
                                            accounts: finalAccounts.join(','),
                                            branch: finalBranches.join(','),
                                            branchCode: finalCodes.join(','),
                                            isConnected: true,
                                            environment: firstAcc.environment || 'production',
                                            brokerUsername: firstAcc.username || baseConfig.brokerUsername,
                                            signedAccounts: allSignedIds.join(',')
                                        };

                                        if (existingConfig) {
                                            onUpdate(existingConfig.id, mergedConfig);
                                        } else {
                                            onAdd(mergedConfig);
                                        }

                                        // 重置 localConfig
                                        setLocalConfig({
                                            id: '',
                                            personId: '',
                                            provider: 'shioaji',
                                            apiKey: '',
                                            apiSecret: '',
                                            caPath: '',
                                            caPassword: '',
                                            caContent: '',
                                            accounts: '',
                                            branch: '',
                                            branchCode: '',
                                            isConnected: false,
                                            environment: 'simulation',
                                            brokerUsername: ''
                                        });

                                        // 顯示結果摘要面板
                                        const resultAccounts = selectedAccounts.map(acc => {
                                            const branchOnly = acc.branch_name?.split('(')[0]?.replace('永豐金-', '').replace('永豐金', '').trim() || '帳號';
                                            return {
                                                name: `${branchOnly} (${acc.account_id})`,
                                                success: true,
                                                error: undefined
                                            };
                                        });

                                        setLoginResult({
                                            show: true,
                                            successCount: selectedAccounts.length,
                                            failCount: 0,
                                            accounts: resultAccounts
                                        });

                                        setProgressMsg('');
                                        setIsTesting(false);
                                    } catch (error: any) {
                                        const classified = classifyError(error?.message || '設定失敗');
                                        setErrorMsg(classified.message);
                                        setIsTesting(false);
                                        setAccountLoginStatus({});
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
            )
            }
            {/* ===== LOGIN RESULT SUMMARY MODAL ===== */}
            {loginResult?.show && (
                <div className="fixed inset-0 z-[10006] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-[#1C1E22] rounded-3xl border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.1)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        {/* 成功圖示 */}
                        <div className="p-8 flex flex-col items-center gap-4 text-center">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-2 transition-all duration-700 ${loginResult.failCount === 0 ? 'bg-emerald-500/15 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'bg-amber-500/15 shadow-[0_0_40px_rgba(245,158,11,0.2)]'}`}>
                                {loginResult.failCount === 0 ? (
                                    <Check size={40} className="text-emerald-400 animate-in zoom-in-50 duration-500" strokeWidth={3} />
                                ) : (
                                    <AlertCircle size={40} className="text-amber-400 animate-in zoom-in-50 duration-500" />
                                )}
                            </div>

                            <h4 className="text-lg font-bold text-white">
                                {loginResult.failCount === 0
                                    ? `🎉 已成功連結 ${loginResult.successCount} 個帳號`
                                    : `✅ ${loginResult.successCount} 個成功，❌ ${loginResult.failCount} 個失敗`
                                }
                            </h4>

                            {/* 每帳號結果 */}
                            <div className="w-full space-y-2 mt-2">
                                {loginResult.accounts.map((acc, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all animate-in slide-in-from-bottom-2 ${acc.success
                                            ? 'bg-emerald-500/5 border-emerald-500/20'
                                            : 'bg-red-500/5 border-red-500/20'
                                            }`}
                                        style={{ animationDelay: `${i * 100}ms` }}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-bold text-zinc-200 block truncate">{acc.name}</span>
                                            {acc.error && (
                                                <span className="text-[10px] text-red-400 block mt-0.5">{acc.error}</span>
                                            )}
                                        </div>
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-2 ${acc.success ? 'bg-emerald-500/20' : 'bg-red-500/20'
                                            }`}>
                                            {acc.success ? (
                                                <Check size={12} className="text-emerald-400" strokeWidth={3} />
                                            ) : (
                                                <X size={12} className="text-red-400" strokeWidth={3} />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-white/5 bg-zinc-900/50">
                            <button
                                onClick={() => {
                                    setLoginResult(null);
                                    setIsEditing(null);
                                    setAccountChoices([]);
                                    setAccountLoginStatus({});
                                    setErrorMsg('');
                                }}
                                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${loginResult.failCount === 0
                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                    : 'bg-[#C8B085] hover:bg-[#E0C8A0] text-black shadow-[0_0_20px_rgba(200,176,133,0.2)]'
                                    }`}
                            >
                                <Check size={16} /> 完成
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* DELETE CONFIRMATION MODAL */}
            {
                deleteTarget && (
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
                                        // 清除 SyncDateModal 的帳號快取，避免顯示已刪除帳號
                                        try { localStorage.removeItem('broker_configs_cache'); } catch (e) { }
                                        setDeleteTarget(null);
                                    }}
                                    className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all"
                                >
                                    {lang === 'zh' ? '確認刪除' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* API Setup Helper Dialog */}
            {/* API Setup Helper Dialog - Full Guide */}
            <BrokerGuideModal
                isOpen={showApiHelper}
                onClose={() => setShowApiHelper(false)}
                lang={lang}
            />
        </div >
    );
};



// Simple Shield icon fallback as it might be missing from some lucide versions
const Shield = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);
