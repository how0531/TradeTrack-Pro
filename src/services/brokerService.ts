
import type { BrokerConfig } from '../types';
import type { TransactionDetail, BrokerSyncResult } from '../types/broker';
import { backendFetch, validateBackendReady } from './backendGateway';

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
    onProgress?: (current: number, total: number, currentStart: string, currentEnd: string) => void
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

        try {
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

            // Outer loop: auto-retry if the server restarts mid-sync (max 2 retries)
            const MAX_JOB_RETRIES = 2;
            let jobResult: any = null;

            for (let jobAttempt = 0; jobAttempt <= MAX_JOB_RETRIES; jobAttempt++) {
                if (jobAttempt > 0) {
                    if (onProgress) onProgress(1, 100, `伺服器重啟，重新建立同步任務 (第 ${jobAttempt}/${MAX_JOB_RETRIES} 次)...`, "");
                    const woke = await validateBackendReady(
                        onProgress ? (msg: string) => onProgress!(1, 100, msg, "") : undefined
                    );
                    if (!woke) throw new Error('後端冷啟動失敗，無法重新建立同步任務，請稍後再試。');
                }

                // 1. 建立背景任務
                if (onProgress) onProgress(1, 100, "準備啟動同步任務...", "");

                const { ok, status, data: createResult } = await backendFetch('/api/jobs/pnl', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    timeout: 30000,
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

                const jobId = createResult.job_id;
                if (!jobId) {
                    throw new Error('未取得 Job ID，請確認後端是否支援。');
                }

                // 2. 輪詢進度
                let pollCount = 0;
                const maxPolls = 150; // 最大等 5 分鐘 (每2秒 1 次)
                let consecutiveFailures = 0;
                const MAX_CONSECUTIVE_FAILURES = 3;
                let serverRestarted = false;

                while (pollCount < maxPolls) {
                    await new Promise(r => setTimeout(r, 2000));
                    pollCount++;

                    try {
                        const { ok: statOk, data: statData, status: statStatus } = await backendFetch(`/api/jobs/${jobId}/status`, {
                            method: 'GET',
                            timeout: 10000,
                            autoWake: false // 不要因為 polling 失敗就觸發冷啟動重試
                        });

                        // 404 = in-memory 架構：伺服器重啟後 Job 消失
                        if (statStatus === 404) {
                            serverRestarted = true;
                            break;
                        }

                        if (statOk && statData.status === 'success') {
                            consecutiveFailures = 0;
                            const job = statData.job;

                            if (onProgress && job.progress > 0) {
                                onProgress(job.progress, 100, String(job.progress_msg), "");
                            }

                            if (job.status === 'done') {
                                // 3. 取得最終結果
                                const { ok: resOk, data: finalData } = await backendFetch(`/api/jobs/${jobId}/result`, {
                                    method: 'GET',
                                    timeout: 30000
                                });

                                if (resOk) {
                                    jobResult = finalData;
                                    break;
                                }
                            } else if (job.status === 'error') {
                                // SQLite 架構：啟動時將中斷任務標記為 error
                                if (job.error?.includes('重新啟動') || job.error?.includes('任務中斷')) {
                                    serverRestarted = true;
                                    break;
                                }
                                throw new Error(job.error || '背景任務執行失敗');
                            }
                        } else {
                            consecutiveFailures++;
                        }
                    } catch (pollErr: any) {
                        if (pollErr.message?.includes('執行失敗')) {
                            throw pollErr;
                        }
                        consecutiveFailures++;
                        console.warn(`[POLLING] Job ${jobId} poll #${pollCount} failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, pollErr.message);
                    }

                    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                        throw new Error(`連線中斷：連續 ${MAX_CONSECUTIVE_FAILURES} 次無法取得同步狀態，請確認後端是否正常運作後重試。`);
                    }
                }

                if (serverRestarted) {
                    if (jobAttempt < MAX_JOB_RETRIES) continue;
                    throw new Error('伺服器已重新啟動，同步任務遺失，自動重試失敗。請稍後再試。');
                }

                if (jobResult) break;
            }

            if (!jobResult) {
                throw new Error('同步任務超時 (超過 5 分鐘)，伺服器可能因過載中斷。請稍後再試。');
            }

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

            if (result.status === 'error') {
                throw new Error(result.message || result.error || '後端回報錯誤 (Backend reported an error)');
            }

            // If the backend says multiple accounts, return it immediately
            if (result.status === 'multiple_accounts') {
                return result;
            }

            if (result.environment !== 'production') {
                throw new Error(`登入失敗：預期 'production' 環境，但得到 '${result.environment}'`);
            }

            if (!result.branchCode || !result.username) {
                throw new Error("登入失敗：缺少帳號資訊 (Missing account info)");
            }

            const rawCode = String(result.branchCode || '').trim();

            return {
                status: 'success',
                branchCode: rawCode,
                branch: result.branch || rawCode,
                username: result.username,
                environment: result.environment as any,
                apiKeyHint: result.apiKeyHint,
                accountId: result.account_id || result.accountId, // Backend may return account_id or accountId
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
