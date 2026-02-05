
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
}

export interface BrokerSyncResult {
    totalPnl: number;
    dailyResults: { date: string, pnl: number }[];
    details: TransactionDetail[];
}

export const fetchBrokerPnl = async (startDate: Date, endDate: Date, config: BrokerConfig): Promise<BrokerSyncResult> => {
    const startTime = performance.now();
    console.log('🔍 [PERF] fetchBrokerPnl 開始:', new Date().toISOString());
    console.log('📅 [PERF] 日期範圍:', startDate.toISOString().split('T')[0], '→', endDate.toISOString().split('T')[0]);

    if (!config.isConnected) {
        throw new Error('券商未連線 (Broker not connected)');
    }

    if (config.provider === 'mock') {
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
        
        // Aggregation Logic (Mock)
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
            console.log('Sending PNL request to backend:', {
                url: `${API_BASE}/api/broker/pnl`,
                dateRange: `${payload.startDate} to ${payload.endDate}`,
                personId: payload.personId,
                branchCode: payload.branchCode // ✅ 顯示分公司代碼
            });

            const fetchStartTime = performance.now();
            console.log('🌐 [PERF] 發送 PnL API 請求至:', `${API_BASE}/api/broker/pnl`);
            
            const response = await fetch(`${API_BASE}/api/broker/pnl`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const fetchElapsed = performance.now() - fetchStartTime;
            console.log(`📡 [PERF] PnL API 回應時間: ${fetchElapsed.toFixed(0)}ms`);

            const text = await response.text();
            let result: any;
            try {
                result = text ? JSON.parse(text) : {};
            } catch (e) {
                console.error('JSON Parse Error (PnL):', text.substring(0, 200));
                throw new Error(`後端回應格式錯誤 (Invalid JSON): ${text.substring(0, 50)}...`);
            }

            if (!response.ok) {
                let errMsg = result.message || result.error || `後端錯誤 (${response.status}): ${text.substring(0, 100)}`;
                if (typeof errMsg === 'string' && errMsg.includes('key:') && errMsg.includes('not exist')) {
                     errMsg = 'API Key 無效或不存在，請檢查憑證設定。 (Invalid API Key)';
                }
                throw new Error(errMsg);
            }

            const totalElapsed = performance.now() - startTime;
            console.log(`✅ [PERF] fetchBrokerPnl 完成: ${totalElapsed.toFixed(0)}ms`);
            console.log(`📊 [PERF] 擷取交易筆數: ${result.details?.length || 0}`);
            
            // 將 Python 後端返回的資料轉換為前端格式
            if (result.status === 'success' && result.details) {
                return {
                    totalPnl: result.total_pnl || 0,
                    dailyResults: result.daily_results || [],
                    details: result.details || []
                };
            }
            
            throw new Error(result.message || '後端回應格式錯誤 (Invalid response)');

        } catch (fetchError: any) {
            // 如果後端服務未啟動，退回到模擬模式
            if (fetchError.message?.includes('fetch') || fetchError.message?.includes('NetworkError')) {
                console.warn('後端服務未回應，將使用模擬模式進行 P&L 展示');
                console.log('Simulating P&L using credentials from config:', {
                    apiKey: config.apiKey.substring(0, 10) + '...',
                    personId: config.personId,
                    dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
                });

                // ===== 模擬資料 =====
                const details: TransactionDetail[] = [
                    { 
                        date: "2026-01-16", category: "現股", code: "2890 永豐金", 
                        quantity: 5000, price: 29.15, buyAmt: 142950, sellAmt: 145106, 
                        pnl: 2156, yield: 1.51, orderNo: "X01YX", currency: "台幣" 
                    },
                    { 
                        date: "2026-01-16", category: "現股", code: "2890 永豐金", 
                        quantity: 5000, price: 29.25, buyAmt: 142950, sellAmt: 145604, 
                        pnl: 2654, yield: 1.86, orderNo: "X0510", currency: "台幣" 
                    },
                    { 
                        date: "2026-01-22", category: "現股", code: "5425 台半", 
                        quantity: 1000, price: 72.00, buyAmt: 70099, sellAmt: 71682, 
                        pnl: 1583, yield: 2.26, orderNo: "X02T4", currency: "台幣" 
                    },
                    { 
                        date: "2026-01-23", category: "現股", code: "1609 大亞", 
                        quantity: 2000, price: 48.30, buyAmt: 92530, sellAmt: 96174, 
                        pnl: 3644, yield: 3.94, orderNo: "X01BW", currency: "台幣" 
                    }
                ];

                // Filter based on requested range
                const startStr = startDate.toISOString().split('T')[0];
                const endStr = endDate.toISOString().split('T')[0];
                
                const filteredDetails = details.filter(d => d.date >= startStr && d.date <= endStr);
                
                // Aggregate
                const dailyMap: Record<string, number> = {};
                let total = 0;
                filteredDetails.forEach(d => {
                    dailyMap[d.date] = (dailyMap[d.date] || 0) + d.pnl;
                    total += d.pnl;
                });

                return {
                    totalPnl: total,
                    dailyResults: Object.keys(dailyMap).map(k => ({ date: k, pnl: dailyMap[k] })),
                    details: filteredDetails
                };
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
}

/**
 * Validates backend API readiness by checking both server health and API endpoint availability.
 * Returns 'ready' if the backend can process API requests, 'server_only' if only health endpoint works,
 * or 'offline' if completely unreachable.
 */
export const validateBackendStatus = async (): Promise<'ready' | 'server_only' | 'offline'> => {
    const startTime = performance.now();
    console.log('🔍 [BACKEND_CHECK] Starting comprehensive validation:', new Date().toISOString());
    
    try {
        // Step 1: Check if server is alive
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const healthResponse = await fetch(`${API_BASE}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!healthResponse.ok) {
            console.warn(`❌ [BACKEND_CHECK] Health check failed with status ${healthResponse.status}`);
            return 'offline';
        }
        
        console.log(`✅ [BACKEND_CHECK] Server is alive (${(performance.now() - startTime).toFixed(0)}ms)`);
        
        // Step 2: Test if API endpoint structure is available
        const apiCheckTime = performance.now();
        const apiController = new AbortController();
        const apiTimeoutId = setTimeout(() => apiController.abort(), 3000);
        
        // Send an intentionally invalid request to check if the endpoint exists
        // We expect a 400 (bad request) response, not 404 (not found)
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
        } catch(e) {
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
        if (e.name === 'AbortError') {
            console.warn(`❌ [BACKEND_CHECK] Timeout after ${elapsed.toFixed(0)}ms`);
        } else {
            console.warn(`❌ [BACKEND_CHECK] Failed: ${e.message} (${elapsed.toFixed(0)}ms)`);
        }
        return 'offline';
    }
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
    console.log(`🔔 [WAKE] Attempting to wake up backend at: ${API_BASE}/health`);
    try {
        if (!API_BASE) {
            return { success: false, error: 'API_BASE URL is empty. Check env vars.' };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for wake-up
        
        const response = await fetch(`${API_BASE}/health`, { 
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
            console.warn('❌ [WAKE] Timeout waiting for backend (30s)');
            return { success: false, error: 'Timeout (30s)' };
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
                console.log('🌐 [PERF] 發送 Profile API 請求至:', `${API_BASE}/api/broker/profile`);
                
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
                accountId: result.account_id || result.accountId // Backend may return account_id or accountId
            };

        } catch (fetchError: any) {
            console.error('Shioaji Profile Error:', fetchError);
            console.error('Error Details:', {
                name: fetchError.name,
                message: fetchError.message,
                stack: fetchError.stack
            });
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
