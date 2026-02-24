
import { BrokerConfig } from '../types';

/**
 * Mocks the Shioaji login/sync process or fetches from a local server.
 * Since browser cannot run Python directly, we simulate the behavior for now.
 * In a real scenario, this would call a local Python server endpoint like http://localhost:5000/sync
 */
export interface TransactionDetail {
    date: string;       // 成交日期
    category: string;   // 類別 (現股)
    code: string;       // 商品 (2890 永豐金)
    quantity: number;   // 成交數量
    price: number;      // 成交價格
    buyAmt: number;     // 買進金額
    sellAmt: number;    // 賣出金額
    pnl: number;        // 損益
    yield: number;      // 報酬率 (%)
    orderNo: string;    // 委託單號
    currency: string;   // 幣別
    entryPrice?: number; // 原幣買進價
    exitPrice?: number;  // 原幣賣出價
}

export interface BrokerSyncResult {
    totalPnl: number;
    dailyResults: { date: string, pnl: number }[];
    details: TransactionDetail[];
    caStatus?: 'activated' | 'not_activated';
    emptyReason?: 'ca_not_activated' | 'no_trades_in_range' | string | null;
}

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

export const fetchBrokerPnl = async (startDate: Date, endDate: Date, config: BrokerConfig): Promise<BrokerSyncResult> => {
    const startTime = performance.now();
    console.log('🔍 [PERF] fetchBrokerPnl 開始:', new Date().toISOString());
    console.log('📅 [PERF] 日期範圍:', startDate.toISOString().split('T')[0], '→', endDate.toISOString().split('T')[0]);

    if (!config.isConnected) {
        throw new Error('券商未連線 (Broker not connected)');
    }

    if (config.provider === 'mock') {
        return generateMockPnl(startDate, endDate);
    }

    if (config.provider === 'shioaji') {
        // ===== 實際使用 config 中的憑證 =====
        // 驗證必要欄位是否已填寫
        if (!config.apiKey || !config.apiSecret || !config.personId || !config.caPath) {
            throw new Error('P&L 擷取失敗：缺少必要憑證資訊 (Missing credentials)');
        }

        // ===== 嘗試呼叫 Python 後端 =====
        try {
            const payload = {
                apiKey: config.apiKey,
                apiSecret: config.apiSecret,
                personId: config.personId,
                caPath: config.caPath,
                caPassword: config.caPassword,
                caContent: config.caContent, // 傳送 Base64 憑證內容
                branchCode: config.branchCode, // ✅ 傳遞分公司代碼
                accountType: config.accountType, // ✅ 傳遞帳號類型 (S/F)
                environment: config.environment || 'production', // ✅ 傳遞環境設定
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            };

            // ... (Logging omitted for brevity) ...

            // 創建 AbortController 以支援取消和超時
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                console.warn('⏱️ [TIMEOUT] 請求超時（120秒）');
            }, 120000); // 120秒超時

            const fetchStartTime = performance.now();
            let response;
            try {
                response = await fetch(`${API_BASE}/api/broker/pnl`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal // 添加取消信號
                });

                clearTimeout(timeoutId); // 清除超時計時器
                // ... (Perf logging) ...
            } catch (fetchError: any) {
                clearTimeout(timeoutId);
                // Re-throw all errors in production mode (no demo fallback)
                throw fetchError;
            }

            const text = await response.text();
            let result: any;
            try {
                result = text ? JSON.parse(text) : {};
            } catch (e) {
                // JSON 解析失敗 - 不應靜默回退到假資料
                console.error('❌ [PNL] JSON Parse Error:', text.substring(0, 200));
                throw new Error(`後端回應格式錯誤，無法解析交易資料。請重試或檢查後端狀態。`);
            }

            if (!response.ok) {
                // 後端 500 系列錯誤 - 不應靜默回退到假資料
                if (response.status >= 500) {
                    throw new Error(`後端伺服器錯誤 (${response.status})，請稍後重試。`);
                }

                let errMsg = result.message || result.error || `後端錯誤 (${response.status})`;
                if (typeof errMsg === 'string') {
                    if (errMsg.includes('key:') && errMsg.includes('not exist')) {
                        errMsg = 'API Key 無效或不存在，請檢查憑證設定。 (Invalid API Key)';
                    } else if (result.ca_error || errMsg.includes('CA') || errMsg.includes('憑證未啟動')) {
                        errMsg = '⚠️ CA 憑證未啟動：請至「設定」→ 帳號設定 → 重新上傳 .pfx 憑證檔案。雲端部署不支援本地路徑。';
                    }
                }
                throw new Error(errMsg);
            }

            if (result.status === 'success' && result.details) {
                return {
                    totalPnl: result.total_pnl || 0,
                    dailyResults: result.daily_results || [],
                    details: result.details || [],
                    caStatus: result.ca_status,
                    emptyReason: result.empty_reason
                };
            }

            // 無法識別的回應格式
            throw new Error(`後端回應異常：無法識別的資料格式。請重試或聯絡支援。`);

        } catch (fetchError: any) {
            // 網路錯誤：後端不可達 - 拋出明確錯誤而非假資料
            if (fetchError.message?.includes('fetch') || fetchError.message?.includes('NetworkError') || fetchError.message?.includes('Backend unreachable')) {
                console.error('❌ [PNL] Backend unreachable');
                throw new Error('無法連接後端伺服器，請確認後端是否已啟動。');
            }
            throw fetchError;
        }
    }

    return { totalPnl: 0, dailyResults: [], details: [] };
};


export const validateBrokerConnection = async (config: BrokerConfig): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Simple validation: check if fields are filled
    if (!config.apiKey || !config.apiSecret || !config.personId || !config.caPath) {
        return false;
    }
    return true;
};

// Enhanced API Configuration for Cloud Deployment
const getApiBase = () => {
    const env = (import.meta as any).env;
    // 1. Priority: Full URL explicitly set
    if (env?.VITE_API_URL && env.VITE_API_URL.startsWith('http')) {
        return env.VITE_API_URL;
    }
    // 2. Fallback: Hostname provided by Render (force HTTPS)
    if (env?.VITE_API_HOST) {
        return `https://${env.VITE_API_HOST}`;
    }
    // 3. Localhost fallback
    return '';
};

const API_BASE = getApiBase();
console.log('🔗 [CONFIG] API Base URL:', API_BASE || '(Local/Relative)');

const BRANCH_MAP: Record<string, string> = {
    "9A95": "經紀部",
    "9A91": "松山",
    "9A92": "萬盛",
    "9A89": "敦北",
    "9A9d": "古亭",
    "9A9D": "忠孝",
    "9A9g": "內湖",
    "9A9G": "天母",
    "9A9R": "信義",
    "9A9S": "南京",
    "9A9U": "中正",
    "9A9Z": "復興",
    "9A9B": "中和",
    "9A9H": "新莊",
    "9A9i": "新店",
    "9A9J": "板新",
    "9A9K": "三重",
    "9A9Y": "板盛",
    "9A98": "大園",
    "9A99": "中壢",
    "9A9N": "桃盛",
    "9A9x": "桃園",
    "9A97": "新竹",
    "9A9X": "竹科",
    "9A9P": "竹北",
    "9A9Q": "豐原",
    "9A9L": "台中",
    "9A9W": "市政",
    "9A9M": "南投",
    "9A79": "埔里",
    "9A9s": "彰化",
    "9A9C": "員林",
    "9A9j": "嘉義",
    "9A9b": "虎尾",
    "9A9c": "永康",
    "9A9h": "台南",
    "9A9e": "高雄",
    "9A9r": "北高雄",
    "9A61": "鳳山",
    "9A9a": "苓雅",
    "9A9q": "潮州",
    "9A69": "屏東",
    "9A81": "匯立",
    "F002": "期貨",
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

/**
 * Validates backend API readiness by checking both server health and API endpoint availability.
 * 
 * 增強版狀態檢測：
 * - 重試機制：網路錯誤時自動重試避免誤判
 * - 嚴格判定：檢查 health 端點的回應內容，而非僅檢查狀態碼
 * - 錯誤區分：區分網路錯誤（offline）、超時（sleeping）、部署問題（server_only）
 * 
 * @param maxRetries 最大重試次數（預設 2 次）
 * @returns 'ready' | 'server_only' | 'offline' | 'sleeping'
 */
export const validateBackendStatus = async (
    maxRetries: number = 2
): Promise<'ready' | 'server_only' | 'offline' | 'sleeping'> => {
    const startTime = performance.now();
    console.log('🔍 [BACKEND_CHECK] Starting comprehensive validation:', new Date().toISOString());
    console.log(`🔁 [BACKEND_CHECK] Max retries: ${maxRetries}`);

    // 重試邏輯
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
            const waitTime = 1000 * attempt; // 漸進式延遲：1s, 2s
            console.log(`🔁 [BACKEND_CHECK] Retry attempt ${attempt}/${maxRetries}, waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        try {
            // Step 1: Check if server is alive with health endpoint
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s for Render free-tier cold boot

            const healthResponse = await fetch(`${API_BASE}/health`, { signal: controller.signal });
            clearTimeout(timeoutId);

            // 檢查狀態碼
            if (!healthResponse.ok) {
                console.warn(`❌ [BACKEND_CHECK] Health check failed with status ${healthResponse.status}`);

                // 502/503 通常表示後端正在啟動或休眠
                if (healthResponse.status === 502 || healthResponse.status === 503) {
                    if (attempt < maxRetries) {
                        console.log(`⏳ [BACKEND_CHECK] Server may be waking up (${healthResponse.status}), retrying...`);
                        continue; // 重試
                    }
                    return 'sleeping';
                }

                // 其他錯誤視為離線
                if (attempt < maxRetries) continue;
                return 'offline';
            }

            // 檢查 health 端點的回應內容
            let healthData: any = {};
            try {
                const healthText = await healthResponse.text();
                healthData = healthText ? JSON.parse(healthText) : {};
            } catch (e) {
                console.warn(`⚠️ [BACKEND_CHECK] Health endpoint returned non-JSON response`);
                // 即使回應不是 JSON，只要狀態碼是 200 就繼續
            }

            // 驗證 health 回應的結構（可選的額外驗證）
            if (healthData.status && healthData.status !== 'healthy' && healthData.status !== 'ok') {
                console.warn(`⚠️ [BACKEND_CHECK] Health status is: ${healthData.status}`);
            }

            console.log(`✅ [BACKEND_CHECK] Server is alive (${(performance.now() - startTime).toFixed(0)}ms)`);

            // Step 2: Test if API endpoint structure is available
            const apiCheckTime = performance.now();
            const apiController = new AbortController();
            const apiTimeoutId = setTimeout(() => apiController.abort(), 5000); // 5s timeout for API check

            // Send an intentionally invalid request to check if the endpoint exists
            // We expect a 400 (bad request) response, not 404 (not found)
            console.log('🔍 [BACKEND_CHECK] Probing API endpoint accessibility...');
            const apiResponse = await fetch(`${API_BASE}/api/broker/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}), // Empty payload to trigger validation error
                signal: apiController.signal
            });

            clearTimeout(apiTimeoutId);

            // If we get 400, it means the endpoint exists and is validating input (good!)
            // If we get 404, the API route doesn't exist
            // If we get 500, there might be a configuration issue
            if (apiResponse.status === 404) {
                console.warn(`⚠️ [BACKEND_CHECK] API endpoint not found - deployment might be incomplete`);
                return 'server_only';
            }

            if (apiResponse.status === 400) {
                console.log(`✅ [BACKEND_CHECK] API is functional (${(performance.now() - apiCheckTime).toFixed(0)}ms)`);
                return 'ready';
            }

            // Try to read the response to get more details
            const text = await apiResponse.text();
            let parsed: any = {};
            try {
                parsed = text ? JSON.parse(text) : {};
            } catch (e) {
                console.warn(`⚠️ [BACKEND_CHECK] Non-JSON response from API: ${text.substring(0, 100)}`);
            }

            // If we get a proper error response with message, API is working
            if (parsed.message || parsed.error) {
                console.log(`✅ [BACKEND_CHECK] API is responding (${(performance.now() - apiCheckTime).toFixed(0)}ms)`);
                return 'ready';
            }

            console.warn(`⚠️ [BACKEND_CHECK] Unexpected API response: ${apiResponse.status}`);
            return 'server_only';

        } catch (e: any) {
            const elapsed = performance.now() - startTime;

            // 超時錯誤
            if (e.name === 'AbortError') {
                console.warn(`😴 [BACKEND_CHECK] Timeout after ${elapsed.toFixed(0)}ms on attempt ${attempt + 1}`);

                // 如果還有重試機會，繼續重試
                if (attempt < maxRetries) {
                    console.log(`⏳ [BACKEND_CHECK] Will retry (timeout may indicate sleeping server)...`);
                    continue;
                }

                return 'sleeping';
            }

            // 網路錯誤（Failed to fetch）
            if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
                console.error(`❌ [BACKEND_CHECK] Network error on attempt ${attempt + 1}: ${e.message}`);

                // 如果還有重試機會，繼續重試
                if (attempt < maxRetries) {
                    console.log(`⏳ [BACKEND_CHECK] Will retry due to network error...`);
                    continue;
                }

                console.warn('💡 Hint: This usually means the server is down or there are CORS issues.');
                return 'offline';
            }

            // 其他未知錯誤
            console.error(`❌ [BACKEND_CHECK] Unexpected error on attempt ${attempt + 1}:`, e);

            if (attempt < maxRetries) {
                console.log(`⏳ [BACKEND_CHECK] Will retry due to unexpected error...`);
                continue;
            }

            return 'offline';
        }
    }

    // 理論上不會到這裡，但為了類型安全
    console.error(`❌ [BACKEND_CHECK] All ${maxRetries + 1} attempts exhausted`);
    return 'offline';
};

/**
 * Legacy function for backward compatibility - simple health check only
 */
export const pingBackend = async (): Promise<boolean> => {
    const status = await validateBackendStatus();
    return status !== 'offline';
};

/**
 * Pre-emptively wake up Render backend if it's sleeping
 * This should be called before attempting login to reduce wait time
 */
export const wakeUpBackend = async (): Promise<{ success: boolean; error?: string }> => {
    const url = `${API_BASE}/health`;
    console.log(`🔔 [WAKE] Attempting to wake up backend at: ${url}`);
    try {
        const controller = new AbortController();
        // 免費 tier 後端冷啟動可能需要 30-60 秒，給 65 秒 timeout
        const timeoutId = setTimeout(() => controller.abort(), 65000);

        const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-cache'
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            console.log('✅ [WAKE] Backend is awake');
            return { success: true };
        }
        console.warn(`⚠️ [WAKE] Backend responded with status: ${response.status}`);
        return { success: false, error: `HTTP ${response.status} ${response.statusText}` };
    } catch (e: any) {
        const errorMsg = e.message || 'Unknown network error';
        if (e.name === 'AbortError') {
            console.warn('❌ [WAKE] Timeout waiting for backend (65s)');
            return { success: false, error: 'Timeout (65s) - 後端可能正在冷啟動' };
        }
        console.warn('❌ [WAKE] Failed to wake backend:', errorMsg);
        return { success: false, error: errorMsg };
    }
};

/**
 * Retry wrapper with exponential backoff
 */
const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    onProgress?: (attempt: number, maxRetries: number) => void
): Promise<T> => {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (onProgress) onProgress(attempt, maxRetries);
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Don't retry on validation errors (400)
            if (error.message?.includes('缺少必要') || error.message?.includes('Missing')) {
                throw error;
            }

            if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5s
                console.log(`⏳ [RETRY] Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
};

export const fetchBrokerProfile = async (
    config: BrokerConfig,
    onProgress?: (message: string) => void
): Promise<BrokerProfile> => {
    const startTime = performance.now();
    console.log('🔍 [PERF] fetchBrokerProfile 開始:', new Date().toISOString());

    if (config.provider === 'shioaji') {
        if (!config.apiKey || !config.apiSecret || !config.personId || !config.caPath) {
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

            // Wrap the fetch call with retry logic
            const result = await retryWithBackoff(async () => {
                if (onProgress) onProgress('正在連接券商 API...');

                const fetchStartTime = performance.now();
                console.log('🌐 [PERF] 發送 Profile API 請求至:', `${API_BASE}/api/broker/profile`, {
                    hasCA: !!payload.caContent,
                    caLength: payload.caContent ? payload.caContent.length : 0
                });

                const response = await fetch(`${API_BASE}/api/broker/profile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const fetchElapsed = performance.now() - fetchStartTime;
                console.log(`📡 [PERF] Profile API 回應時間: ${fetchElapsed.toFixed(0)}ms`);

                const text = await response.text();
                let result: any;
                try {
                    result = text ? JSON.parse(text) : {};
                } catch (e) {
                    console.error('JSON Parse Error:', text.substring(0, 200));
                    throw new Error(`後端回應格式錯誤 (Invalid JSON): ${text.substring(0, 50)}...`);
                }

                if (!response.ok) {
                    let errMsg = result.message || result.error || `後端錯誤 (${response.status}): ${text.substring(0, 100)}`;

                    // Improve error message for known Shioaji errors
                    if (typeof errMsg === 'string') {
                        if (errMsg.includes('key:') && errMsg.includes('not exist')) {
                            errMsg = 'API Key 無效或不存在，請檢查憑證設定。 (Invalid API Key)';
                        } else if (errMsg.includes('Account Not Acceptable')) {
                            errMsg = '帳號授權失敗，請確認該帳號是否有效 (Account Not Acceptable)';
                        } else if (errMsg.includes('缺少必要欄位')) {
                            // Validation error - don't retry
                            throw new Error(errMsg);
                        }
                    }

                    throw new Error(errMsg);
                }

                return result;
            }, 3, (attempt, max) => {
                if (onProgress) onProgress(`連接中 (嘗試 ${attempt}/${max})...`);
            });

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
            const codes = rawCode.split(',').map(c => c.trim()).filter(Boolean);
            const branchName = codes.length > 0
                ? codes.map(c => BRANCH_MAP[c] || c).join(', ')
                : (BRANCH_MAP[rawCode] || '永豐金 - ' + rawCode);

            return {
                status: 'success',
                branchCode: rawCode,
                branch: branchName,
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

        const response = await fetch(`${API_BASE}/api/broker/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        return result;
    } catch (error: any) {
        console.error('[VERIFY] Error:', error);
        return { status: 'error', message: error.message || '連線後端失敗' };
    }
};
