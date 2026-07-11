
import type { BrokerConfig } from '../types';
import type { TransactionDetail, BrokerSyncResult } from '../types/broker';
import { backendFetch } from './backendGateway';
import {
    isPnlSuccessResponse,
    isJobCreateResponse,
    isJobStatusResponse,
    isBrokerProfileSuccess,
    isBrokerProfileMultiAccount,
    isBackendError,
} from './responseValidators';

export type { TransactionDetail, BrokerSyncResult };

const generateMockPnl = (startDate: Date, endDate: Date): BrokerSyncResult => {
    const details: TransactionDetail[] = [];
    let curr = new Date(startDate);
    while (curr <= endDate) {
        const dateStr = curr.toISOString().split('T')[0];
        if (Math.random() > 0.3) {
            const pnl = Math.floor(Math.random() * 20000) - 5000;
            details.push({
                date: dateStr,
                category: '現股',
                code: '2330 台積電',
                quantity: 1000,
                price: 600,
                buyAmt: 600000,
                sellAmt: 600000 + pnl,
                pnl: pnl,
                yield: Number((pnl / 600000 * 100).toFixed(2)),
                orderNo: 'M' + Math.random().toString(36).substring(7).toUpperCase(),
                currency: '台幣'
            });
        }
        curr.setDate(curr.getDate() + 1);
    }

    const dailyMap: Record<string, number> = {};
    let total = 0;
    details.forEach(d => {
        dailyMap[d.date] = (dailyMap[d.date] || 0) + d.pnl;
        total += d.pnl;
    });

    return {
        totalPnl: total,
        dailyResults: Object.keys(dailyMap).map(k => ({ date: k, pnl: dailyMap[k] })),
        details
    };
};

export const fetchBrokerPnl = async (
    startDate: Date,
    endDate: Date,
    config: BrokerConfig,
    onProgress?: (current: number, total: number, currentStart: string, currentEnd: string) => void,
    // B1e (v3.9.2): 外部取消訊號 — modal 關閉時 abort 會真正中斷
    // sync 請求與 async polling，而非只丟棄結果讓網路鏈跑滿 5 分鐘。
    abortSignal?: AbortSignal
): Promise<BrokerSyncResult> => {
    const startTime = performance.now();
    console.log('🔍 [PERF] fetchBrokerPnl 開始:', new Date().toISOString());

    const formatLocalYYYYMMDD = (d: Date) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const startStr = formatLocalYYYYMMDD(startDate);
    const endStr = formatLocalYYYYMMDD(endDate);
    console.log('📅 [PERF] 日期範圍:', startStr, '→', endStr);

    if (!config.isConnected) {
        throw new Error('券商未連線 (Broker not connected)');
    }

    if (config.provider === 'mock') {
        return generateMockPnl(startDate, endDate);
    }

    if (config.provider === 'shioaji') {
        if (!config.apiKey || !config.apiSecret || !config.personId || (!config.caPath && !config.caContent)) {
            throw new Error('P&L 擷取失敗：缺少必要憑證資訊 (Missing credentials)');
        }

        const payload = {
            apiKey: config.apiKey,
            apiSecret: config.apiSecret,
            personId: config.personId,
            caPath: config.caPath,
            caPassword: config.caPassword,
            caContent: config.caContent,
            branchCode: config.branchCode,
            environment: config.environment || 'production',
            startDate: startStr,
            endDate: endStr
        };

        // ════════════════════════════════════════════════════════════
        // 🚀 SYNC FIRST：直接打同步 endpoint /api/broker/pnl
        //
        // 為什麼放棄 v3.0.4 引入的 async + polling？
        //   Render free tier 的 container 磁碟是 ephemeral，每次容器
        //   重啟（休眠/被殺/redeploy）都會把 SQLite 整個吃掉。async 模式
        //   依賴後端跨多次 polling 記住 job 狀態，這在 ephemeral 環境
        //   是不可靠的；這就是 v3.2.0/3.2.1/3.2.3 都修不掉、用戶持續看到
        //   404 + 「同步任務遺失」的根因。
        //
        //   單次同步 HTTP 請求只要連線開著，Render 就不會把 worker 殺掉
        //   (gunicorn timeout=120s 仍受保護)，根本繞開了「跨請求記憶」
        //   這個問題層。登入 (/api/broker/profile) 就是這樣可靠運作的。
        //
        // 若同步請求超時或網路錯誤再退回 async 路徑當保險。
        // ════════════════════════════════════════════════════════════
        // sentinel：sync 路徑的後端 4xx 錯誤；用 sentinel 避免被 try/catch 誤吞
        let syncBackendError: Error | null = null;
        try {
            if (onProgress) onProgress(5, 100, "正在連線券商...", "");

            const { ok, status, data: syncResult } = await backendFetch('/api/broker/pnl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                timeout: 110000, // 110s：留 10s buffer 在 gunicorn 120s 之內
                abortSignal,
            });

            if (ok && isPnlSuccessResponse(syncResult)) {
                if (onProgress) onProgress(95, 100, "整理交易資料...", "");
                const totalTime = performance.now() - startTime;
                console.log(`✅ [PNL Sync] 取得 ${syncResult.details.length} 筆，耗時: ${totalTime.toFixed(0)}ms`);
                return {
                    totalPnl: syncResult.total_pnl,
                    dailyResults: syncResult.daily_results,
                    details: [...syncResult.details].sort((a, b) => b.date.localeCompare(a.date)),
                    caStatus: syncResult.ca_status,
                    emptyReason: syncResult.empty_reason,
                    accountSummaries: syncResult.account_summaries,
                    emptyDiagnostic: syncResult.empty_diagnostic,
                    dateRangeUsed: syncResult.date_range_used,
                };
            }

            // 4xx 後端邏輯錯誤（憑證、帳號、日期型別等）— 用 sentinel 帶出 try
            // 而不是直接 throw，避免被自己的 catch 接住誤判為網路錯誤
            if (status >= 400 && status < 500 && syncResult?.status === 'error') {
                let errMsg = syncResult.message || syncResult.error || `後端錯誤 (${status})`;
                if (typeof errMsg === 'string') {
                    if (errMsg.includes('key:') && errMsg.includes('not exist')) {
                        errMsg = 'API Key 無效或不存在，請檢查憑證設定。 (Invalid API Key)';
                    } else if (syncResult?.ca_error || errMsg.includes('CA') || errMsg.includes('憑證未啟動')) {
                        errMsg = '⚠️ CA 憑證未啟動：請至「設定」→ 帳號設定 → 重新上傳 .pfx 憑證檔案。雲端部署不支援本地路徑。';
                    }
                }
                syncBackendError = new Error(errMsg);
            } else {
                // 5xx 或網路問題 → 落到 async 路徑試一次
                console.warn(`[PNL Sync] failed status=${status}, falling back to async job path`);
            }
        } catch (syncErr: any) {
            const msg = String(syncErr?.message || '');
            // 外部取消 → 直接拋，不 fallback（caller 已經不要結果了）
            if (msg.includes('請求已取消') || abortSignal?.aborted) {
                throw syncErr;
            }
            // 只有純網路 / timeout 才退回 async；其他錯誤直接拋。
            // B1a (v3.9.2): backendGateway 拋的是「中文」訊息（請求超時 /
            // 無法連接後端伺服器 / 後端冷啟動失敗），原本只比對英文關鍵字
            // 全部 miss — async fallback 從未被觸發過，超時被誤判為後端
            // 邏輯錯誤直接拋給使用者。
            const isNetworkOrTimeout =
                msg.includes('fetch') ||
                msg.includes('NetworkError') ||
                msg.includes('timeout') ||
                msg.includes('Timeout') ||
                msg.includes('aborted') ||
                msg.includes('Failed to fetch') ||
                msg.includes('請求超時') ||
                msg.includes('無法連接後端') ||
                msg.includes('冷啟動');
            if (!isNetworkOrTimeout) {
                syncBackendError = syncErr;
            } else {
                console.warn('[PNL Sync] network/timeout, falling back to async:', msg);
            }
        }

        // 後端明確 4xx → 直接拋，不浪費時間走 async fallback（同樣 bug 會重現）
        if (syncBackendError) {
            throw syncBackendError;
        }

        try {
            // ── ASYNC FALLBACK ──
            // 只在同步路徑無法完成時走（罕見情境：超大區間、極多帳號、或 5xx）。
            if (onProgress) onProgress(1, 100, "切換為背景同步任務 (大量資料)...", "");

            // 1. 建立背景任務
            const { ok, status, data: createResult } = await backendFetch('/api/jobs/pnl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                timeout: 30000,
                abortSignal,
            });

            if (!ok || createResult?.status === 'error') {
                if (status >= 500) {
                    throw new Error(`建立同步任務失敗 (${status})，請稍後重試。`);
                }
                let errMsg = createResult?.message || createResult?.error || `後端錯誤 (${status})`;
                if (typeof errMsg === 'string') {
                    if (errMsg.includes('key:') && errMsg.includes('not exist')) {
                        errMsg = 'API Key 無效或不存在，請檢查憑證設定。 (Invalid API Key)';
                    } else if (createResult?.ca_error || errMsg.includes('CA') || errMsg.includes('憑證未啟動')) {
                        errMsg = '⚠️ CA 憑證未啟動：請至「設定」→ 帳號設定 → 重新上傳 .pfx 憑證檔案。雲端部署不支援本地路徑。';
                    }
                }
                throw new Error(errMsg);
            }

            // 驗證 createResult 的 shape — 後端 schema 改了會在這裡 throw 而非 silent undefined
            if (!isJobCreateResponse(createResult)) {
                throw new Error('未取得 Job ID，請確認後端是否支援。');
            }
            const jobId = createResult.job_id;

            // 2. 輪詢進度 — 指數退避
            // 前 5 次 1.5s 頻繁抓早期進度；之後依進度拉長到最多 5s，
            // 在 5 分鐘總預算內明顯減少後端 polling request 數（免費雲端省 CPU / egress）。
            let jobResult: any = null;
            // 後端回報的 job error — 用 sentinel 而不是 throw，避免被 inner try/catch 誤吞
            // (v3.3.0 regression: throw 在 try 內被自己的 catch 接住，consecutiveFailures
            //  又被下一輪重置，造成 polling 永不停止直到 5 分鐘 timeout)
            let jobErrorMsg: string | null = null;
            let pollCount = 0;
            let elapsedMs = 0;
            const MAX_TOTAL_MS = 5 * 60 * 1000;
            let consecutiveFailures = 0;
            const MAX_CONSECUTIVE_FAILURES = 3;
            // 免費雲端 (Render / Zeabur free) 冷啟動或短暫重啟時，後端可能
            // 短時間內回 404（job 尚未寫入 DB / DB 尚未讀到）。先連續重試幾次再放棄。
            let consecutive404 = 0;
            const MAX_CONSECUTIVE_404 = 3;
            let lastProgress = 0;
            const pollIntervalMs = (polls: number, progress: number) => {
                if (polls < 5) return 1500;
                const factor = Math.min(1, Math.max(0, progress) / 100);
                return Math.round(1500 + factor * 3500);
            };

            while (elapsedMs < MAX_TOTAL_MS) {
                // B1e: 外部取消 → 立即停止 polling（modal 已關閉）
                if (abortSignal?.aborted) {
                    throw new Error('請求已取消 (aborted)');
                }
                const wait = pollIntervalMs(pollCount, lastProgress);
                await new Promise(r => setTimeout(r, wait));
                if (abortSignal?.aborted) {
                    throw new Error('請求已取消 (aborted)');
                }
                elapsedMs += wait;
                pollCount++;

                try {
                    const { ok: statOk, data: statData, status: statStatus } = await backendFetch(`/api/jobs/${jobId}/status`, {
                        method: 'GET',
                        timeout: 10000,
                        autoWake: false, // 不要因為 polling 失敗就觸發冷啟動重試
                        abortSignal,
                    });

                    // 404 = Job 在後端不存在。
                    // 可能原因：
                    //   a) 後端（免費雲端）冷啟動中，DB 尚未就緒 → 稍等再試
                    //   b) 後端真的重啟、任務狀態已被標為 error（新版會保留紀錄）
                    //   c) 任務已過期被清理
                    if (statStatus === 404) {
                        consecutive404++;
                        if (consecutive404 >= MAX_CONSECUTIVE_404) {
                            throw new Error(
                                '雲端後台疑似休眠或重啟，且任務狀態已遺失。' +
                                '免費方案閒置一段時間後會暫停服務，請重新執行同步；' +
                                '若持續發生，可考慮升級後台方案或縮短同步日期範圍。'
                            );
                        }
                        console.warn(`[POLLING] Job ${jobId} returned 404 (${consecutive404}/${MAX_CONSECUTIVE_404}) — 後端可能正在冷啟動，稍後重試`);
                        continue;
                    }
                    consecutive404 = 0;

                    if (statOk && isJobStatusResponse(statData)) {
                        consecutiveFailures = 0; // 重置失敗計數
                        const job = statData.job;
                        lastProgress = job.progress;

                        // 回報進度給 UI
                        if (onProgress && job.progress > 0) {
                            onProgress(job.progress, 100, String(job.progress_msg), "");
                        }

                        if (job.status === 'done') {
                            // 3. 取得最終結果
                            const { ok: resOk, data: finalData } = await backendFetch(`/api/jobs/${jobId}/result`, {
                                method: 'GET',
                                timeout: 30000,
                                abortSignal,
                            });

                            if (resOk) {
                                jobResult = finalData;
                                break;
                            }
                        } else if (job.status === 'error') {
                            // 用 sentinel 帶出迴圈，避免在 try 內 throw 被同層 catch 誤吞
                            jobErrorMsg = job.error || '背景任務執行失敗';
                            break;
                        }
                    } else {
                        consecutiveFailures++;
                    }
                } catch (pollErr: any) {
                    // 外部取消 / 雲端休眠的明確錯誤直接往上拋
                    if (
                        pollErr.message?.includes('請求已取消') ||
                        pollErr.message?.includes('雲端後台') ||
                        pollErr.message?.includes('伺服器在同步過程中重啟')
                    ) {
                        throw pollErr;
                    }
                    consecutiveFailures++;
                    console.warn(`[POLLING] Job ${jobId} poll #${pollCount} failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, pollErr.message);
                }

                if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    throw new Error(`連線中斷：連續 ${MAX_CONSECUTIVE_FAILURES} 次無法取得同步狀態，請確認後端是否正常運作後重試。`);
                }
            }

            // Job 明確失敗（後端已寫入 error）—— 直接拋出，不再走 timeout 路徑
            if (jobErrorMsg) {
                throw new Error(jobErrorMsg);
            }

            if (!jobResult) {
                throw new Error('同步任務超時 (超過 5 分鐘)，伺服器可能因過載中斷。請稍後再試。');
            }

            // 取代原本的單一 result
            const result = jobResult;

            if (result.status === 'error') {
                throw new Error(result.message || result.error || '後端擷取資料失敗');
            }

            const totalTime = performance.now() - startTime;
            console.log(`✅ [PNL] 成功取得 ${result.details?.length || 0} 筆，耗時: ${totalTime.toFixed(0)}ms`);

            const syncResult: BrokerSyncResult = {
                totalPnl: result.total_pnl || 0,
                dailyResults: result.daily_results || [],
                details: (result.details || []).sort((a: any, b: any) => b.date.localeCompare(a.date)),
                caStatus: result.ca_status,
                emptyReason: result.empty_reason,
                accountSummaries: result.account_summaries,
                emptyDiagnostic: result.empty_diagnostic,
                dateRangeUsed: result.date_range_used,
            };
            return syncResult;

        } catch (fetchError: any) {
            if (fetchError.message?.includes('fetch') || fetchError.message?.includes('NetworkError')) {
                throw new Error('無法連接後端伺服器，請確認後端是否已啟動。');
            }
            throw fetchError;
        }
    }

    return { totalPnl: 0, dailyResults: [], details: [] };
};


export interface BrokerProfile {
    status?: string;
    branch?: string;
    branchCode?: string;
    username?: string;
    environment?: 'production' | 'simulation';
    apiKeyHint?: string;
    accountId?: string; // Individual account ID for single account login
    accounts?: { branch_code: string, branch_name: string, account_id: string, account_type?: string }[];
    signedAccounts?: string[]; // Array of signed account IDs
}


export const fetchBrokerProfile = async (
    config: BrokerConfig,
    onProgress?: (message: string) => void
): Promise<BrokerProfile> => {
    const startTime = performance.now();
    console.log('🔍 [PERF] fetchBrokerProfile 開始:', new Date().toISOString());

    if (config.provider === 'shioaji') {
        if (!config.apiKey || !config.apiSecret || !config.personId || (!config.caPath && !config.caContent)) {
            throw new Error("登入失敗：缺少必要憑證資訊 (Missing credentials)");
        }

        try {
            const payload = {
                apiKey: config.apiKey,
                apiSecret: config.apiSecret,
                personId: config.personId,
                caPath: config.caPath,
                caPassword: config.caPassword,
                caContent: config.caContent,
                branchCode: config.branchCode,
                environment: config.environment || 'production'
            };

            // ✅ 統一透過 Gateway 發送請求
            if (onProgress) onProgress('連接中...');

            const { ok, status, data: result } = await backendFetch('/api/broker/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                timeout: 45000,
                maxRetries: 3,
                onProgress: (msg) => { if (onProgress) onProgress(msg); },
            });

            if (!ok) {
                let errMsg = result.message || result.error || `後端錯誤 (${status})`;
                if (typeof errMsg === 'string') {
                    if (errMsg.includes('key:') && errMsg.includes('not exist')) {
                        errMsg = 'API Key 無效或不存在，請檢查憑證設定。 (Invalid API Key)';
                    } else if (errMsg.includes('Account Not Acceptable')) {
                        errMsg = '帳號授權失敗，請確認該帳號是否有效 (Account Not Acceptable)';
                    }
                }
                throw new Error(errMsg);
            }

            const totalElapsed = performance.now() - startTime;
            console.log(`✅ [PERF] fetchBrokerProfile 完成: ${totalElapsed.toFixed(0)}ms`);

            if (isBackendError(result)) {
                throw new Error(result.message || result.error || '後端回報錯誤 (Backend reported an error)');
            }

            // If the backend says multiple accounts, return it immediately
            if (isBrokerProfileMultiAccount(result)) {
                return result as any;
            }

            // 走到這裡應該是 success — 用 type guard 確認 shape，否則 throw 含 dump
            if (!isBrokerProfileSuccess(result)) {
                throw new Error('後端 profile 回應格式不符預期，可能版本不相容。');
            }

            if (result.environment !== 'production') {
                throw new Error(`登入失敗：預期 'production' 環境，但得到 '${result.environment}'`);
            }

            const rawCode = result.branchCode.trim();

            return {
                status: 'success',
                branchCode: rawCode,
                branch: (result as any).branch || rawCode,
                username: result.username,
                environment: result.environment as any,
                apiKeyHint: result.apiKeyHint,
                accountId: (result as any).account_id || result.accountId,
                signedAccounts: result.signedAccounts || []
            };

        } catch (fetchError: any) {
            console.error('Shioaji Profile Error:', fetchError);

            // Re-throw error for production mode (no demo fallback)
            throw fetchError;
        }
    }

    if (config.provider === 'mock') {
        return {
            status: 'success',
            branchCode: 'F002',
            branch: '模擬分公司',
            username: 'SimulationUser',
            environment: 'simulation'
        };
    }

    return {};
};

/**
 * 執行模擬下單以開通 API 權限
 */
export const verifyBrokerAccount = async (config: BrokerConfig, accountId: string): Promise<{ status: string; message: string }> => {
    console.log(`🚀 [VERIFY] Initiating verification for account: ${accountId}`);
    try {
        const payload = {
            apiKey: config.apiKey,
            apiSecret: config.apiSecret,
            personId: config.personId,
            caPath: config.caPath,
            caPassword: config.caPassword,
            caContent: config.caContent,
            accountId: accountId
        };

        // ✅ 統一透過 Gateway 發送請求
        const { data: result } = await backendFetch('/api/broker/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeout: 30000,
        });

        return result;
    } catch (error: any) {
        console.error('[VERIFY] Error:', error);
        return { status: 'error', message: error.message || '連線後端失敗' };
    }
};
