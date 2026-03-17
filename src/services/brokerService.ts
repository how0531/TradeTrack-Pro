
import type { BrokerConfig } from '../types';
import { backendFetch } from './backendGateway';

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

export const fetchBrokerPnl = async (
    startDate: Date, 
    endDate: Date, 
    config: BrokerConfig,
    onProgress?: (current: number, total: number, currentStart: string, currentEnd: string) => void
): Promise<BrokerSyncResult> => {
    const startTime = performance.now();
    console.log('🔍 [PERF] fetchBrokerPnl 開始:', new Date().toISOString());
    // Helper to avoid timezone shift when using toISOString() on local dates
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
        // ===== 實際使用 config 中的憑證 =====
        // 驗證必要欄位是否已填寫
        if (!config.apiKey || !config.apiSecret || !config.personId || !config.caPath) {
            throw new Error('P&L 擷取失敗：缺少必要憑證資訊 (Missing credentials)');
        }

        // ===== 嘗試呼叫 Python 後端 (Date Chunking) =====
        try {
            // Function to generate date chunks (max 31 days per chunk)
            const getChunks = (start: Date, end: Date) => {
                const chunks = [];
                let currentStart = new Date(start);
                while (currentStart <= end) {
                    let currentEnd = new Date(currentStart);
                    currentEnd.setDate(currentStart.getDate() + 30); // 31 days inclusive
                    if (currentEnd > end) currentEnd = new Date(end);
                    chunks.push({ start: new Date(currentStart), end: new Date(currentEnd) });
                    currentStart = new Date(currentEnd);
                    currentStart.setDate(currentStart.getDate() + 1);
                }
                return chunks;
            };

            const dateChunks = getChunks(startDate, endDate);
            console.log(`⏱️ [CHUNK] 將查詢區間切分為 ${dateChunks.length} 個區塊`);

            let aggregatedResult: BrokerSyncResult = {
                totalPnl: 0,
                dailyResults: [],
                details: [],
            };

            const fetchStartTime = performance.now();

            // Sequentially fetch chunks to avoid overloading the server completely
            for (let i = 0; i < dateChunks.length; i++) {
                const chunk = dateChunks[i];
                const chunkStartStr = formatLocalYYYYMMDD(chunk.start);
                const chunkEndStr = formatLocalYYYYMMDD(chunk.end);
                
                console.log(`⏳ [CHUNK ${i+1}/${dateChunks.length}] 正在拉取: ${chunkStartStr} → ${chunkEndStr}`);
                
                // Invoke callback if provided
                if (onProgress) {
                    onProgress(i + 1, dateChunks.length, chunkStartStr, chunkEndStr);
                }

                const payload = {
                    apiKey: config.apiKey,
                    apiSecret: config.apiSecret,
                    personId: config.personId,
                    caPath: config.caPath,
                    caPassword: config.caPassword,
                    caContent: config.caContent, // 傳送 Base64 憑證內容
                    branchCode: config.branchCode, // 傳遞分公司代碼
                    accountType: config.accountType, // 傳遞帳號類型 (S/F)
                    environment: config.environment || 'production', // 傳遞環境設定
                    startDate: chunkStartStr,
                    endDate: chunkEndStr
                };

            // ... (Logging omitted for brevity) ...

            // ✅ 統一透過 Gateway 發送請求（自動 retry + 自動喚醒 + 統一 timeout）
            const { ok, status, data: result } = await backendFetch('/api/broker/pnl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                timeout: 120000, // PnL 查詢可能較慢，給 120s
            });

            if (!ok) {
                if (status >= 500) {
                    const errDetail = result.message || result.error || '';
                    throw new Error(`後端伺服器錯誤 (${status})${errDetail ? '：' + errDetail : ''}，請稍後重試。`);
                }

                let errMsg = result.message || result.error || `後端錯誤 (${status})`;
                if (typeof errMsg === 'string') {
                    if (errMsg.includes('key:') && errMsg.includes('not exist')) {
                        errMsg = 'API Key 無效或不存在，請檢查憑證設定。 (Invalid API Key)';
                    } else if (result.ca_error || errMsg.includes('CA') || errMsg.includes('憑證未啟動')) {
                        errMsg = '⚠️ CA 憑證未啟動：請至「設定」→ 帳號設定 → 重新上傳 .pfx 憑證檔案。雲端部署不支援本地路徑。';
                    }
                }
                throw new Error(errMsg);
            }

            // 處理 HTTP 200 但帶有業務邏輯錯誤
            if (result.status === 'error') {
                console.error(`❌ [PNL] Backend returned error status:`, result.message);
                throw new Error(result.message || result.error || '後端擷取資料失敗');
            }

                // Aggregation
                if (result.status === 'success' && result.details) {
                    aggregatedResult.details.push(...(result.details || []));
                    aggregatedResult.totalPnl += (result.total_pnl || 0);
                    // Combine daily results
                    if (result.daily_results) {
                        result.daily_results.forEach((dr: any) => {
                            const existing = aggregatedResult.dailyResults.find(d => d.date === dr.date);
                            if (existing) existing.pnl += dr.pnl;
                            else aggregatedResult.dailyResults.push(dr);
                        });
                    }
                    aggregatedResult.caStatus = result.ca_status; // Keep the latest status
                    
                    // If we get real details, we overwrite the emptyReason
                    if (result.details.length > 0) {
                        aggregatedResult.emptyReason = undefined; 
                    } else if (result.empty_reason && !aggregatedResult.details.length) {
                        aggregatedResult.emptyReason = result.empty_reason;
                    }
                } else {
                    // 無法識別的回應格式
                    throw new Error(`後端回應異常：無法識別的資料格式。請重試或聯絡支援。`);
                }
            } // end loop

            const totalTime = performance.now() - fetchStartTime;
            console.log(`✅ [PNL] 成功取得資料，共 ${aggregatedResult.details.length} 筆，總耗時: ${totalTime.toFixed(2)}ms`);

            // Sort finally
            aggregatedResult.details.sort((a, b) => b.date.localeCompare(a.date));
            aggregatedResult.dailyResults.sort((a, b) => b.date.localeCompare(a.date));

            return aggregatedResult;

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


/** @deprecated Dead code — only checks if fields are filled, no actual validation. */
export const validateBrokerConnection = async (config: BrokerConfig): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
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
 * Validates backend API readiness by checking server health.
 * 
 * 增強版狀態檢測：
 * - 簡化：只打 /health 節省 HTTP round-trip，捨棄無用的 server_only 狀態
 * - 嚴格：區分網路錯誤（offline）與超時或 50x（sleeping / 冷啟動）
 */
export const validateBackendStatus = async (
    maxRetries: number = 1 
): Promise<'ready' | 'offline' | 'sleeping'> => {
    const startTime = performance.now();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
            await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

            const healthResponse = await fetch(`${API_BASE}/health`, {
                signal: controller.signal,
                cache: 'no-cache',
            });
            clearTimeout(timeoutId);

            if (healthResponse.ok) {
                console.log(`✅ [BACKEND_CHECK] Health OK (${(performance.now() - startTime).toFixed(0)}ms)`);
                return 'ready';
            }

            if (healthResponse.status === 502 || healthResponse.status === 503) {
                if (attempt < maxRetries) continue;
                return 'sleeping';
            }
            
            if (attempt < maxRetries) continue;
            return 'offline';

        } catch (e: any) {
            if (e.name === 'AbortError') {
                if (attempt < maxRetries) continue;
                return 'sleeping'; // timeout = 可能在冷啟動中
            }
            if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
                if (attempt < maxRetries) continue;
                return 'offline'; // 網路層級的失敗 = offline
            }
            if (attempt < maxRetries) continue;
            return 'offline';
        }
    }

    return 'offline';
};

/**
 * Legacy function for backward compatibility
 */
export const pingBackend = async (): Promise<boolean> => {
    const status = await validateBackendStatus();
    return status === 'ready';
};

/**
 * 喚醒後端——漸進式輪詢 (Adaptive Polling)
 * 前幾次 ping 得比較密集，以抓緊 Render 15-30s 的啟動窗口，
 * 提升使用者體驗。
 */
export const wakeUpBackend = async (
    onProgress?: (attempt: number, maxAttempts: number) => void
): Promise<{ success: boolean; error?: string }> => {
    const url = `${API_BASE}/health`;
    const MAX_ATTEMPTS = 15;  

    console.log(`🔔 [WAKE] Starting adaptive polling wake-up (max ${MAX_ATTEMPTS} attempts)`);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        onProgress?.(attempt, MAX_ATTEMPTS);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout per ping

            const response = await fetch(url, {
                signal: controller.signal,
                cache: 'no-cache',
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                console.log(`✅ [WAKE] Backend is awake on attempt ${attempt}`);
                return { success: true };
            }

            console.log(`⏳ [WAKE] Attempt ${attempt}/${MAX_ATTEMPTS}: HTTP ${response.status}, waiting...`);
        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.log(`⏳ [WAKE] Attempt ${attempt}/${MAX_ATTEMPTS}: timeout, retrying...`);
            } else {
                console.log(`⏳ [WAKE] Attempt ${attempt}/${MAX_ATTEMPTS}: ${e.message}, retrying...`);
            }
        }

        // 如果還沒喚醒，依據嘗試次數使用漸進式等待時間 (Adaptive Delay)
        if (attempt < MAX_ATTEMPTS) {
            let delay = 10000; // default 10s
            if (attempt <= 4) delay = 3000;       // 前 4 次等 3 秒
            else if (attempt <= 8) delay = 5000;  // 第 5~8 次等 5 秒
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    console.warn('❌ [WAKE] Backend did not wake up within timeout');
    return { success: false, error: '後端冷啟動超時，請確認部署狀態後再試' };
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
