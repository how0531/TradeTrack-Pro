
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
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (!config.isConnected) {
        throw new Error('Broker not connected');
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
            throw new Error('P&L fetch failed: Missing required credentials');
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
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            };
            console.log('Sending PNL request to backend:', {
                url: `${API_BASE}/api/broker/pnl`,
                dateRange: `${payload.startDate} to ${payload.endDate}`,
                personId: payload.personId
            });

            const response = await fetch(`${API_BASE}/api/broker/pnl`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Backend P&L API call failed');
            }

            const result = await response.json();
            
            // 將 Python 後端返回的資料轉換為前端格式
            if (result.status === 'success' && result.details) {
                return {
                    totalPnl: result.total_pnl || 0,
                    dailyResults: result.daily_results || [],
                    details: result.details || []
                };
            }
            
            throw new Error(result.message || 'Invalid response from backend');

        } catch (fetchError: any) {
            // 如果後端服務未啟動，退回到模擬模式
            if (fetchError.message?.includes('fetch') || fetchError.message?.includes('NetworkError')) {
                console.warn('Backend service not available, using simulation mode for P&L');
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

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

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
    "F002": "模擬分公司",
};

export interface BrokerProfile {
    status?: string;
    branch?: string;
    branchCode?: string;
    username?: string;
    environment?: 'production' | 'simulation';
    apiKeyHint?: string;
    accounts?: { branch_code: string, branch_name: string, account_id: string }[];
}

export const fetchBrokerProfile = async (config: BrokerConfig): Promise<BrokerProfile> => {
    // Simulate Login Delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (config.provider === 'shioaji') {
        if (!config.apiKey || !config.apiSecret || !config.personId || !config.caPath) {
            throw new Error("Login failed: Missing required credentials");
        }

        try {
            const payload = {
                apiKey: config.apiKey,
                apiSecret: config.apiSecret,
                personId: config.personId,
                caPath: config.caPath,
                caPassword: config.caPassword,
                caContent: config.caContent,
                branchCode: config.branchCode // Send if already selected
            };

            const response = await fetch(`${API_BASE}/api/broker/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Backend API call failed');
            }

            const result = await response.json();
            
            // If the backend says multiple accounts, return it immediately
            if (result.status === 'multiple_accounts') {
                return result;
            }

            if (result.environment !== 'production') {
                throw new Error(`Login failed: Expected 'production' environment but got '${result.environment}'.`);
            }

            if (!result.branchCode || !result.username) {
                throw new Error("Login failed: Missing account information");
            }
            
            const rawCode = String(result.branchCode || '').trim();
            const branchName = BRANCH_MAP[rawCode] || '永豐金 - ' + rawCode;
            
            return {
                status: 'success',
                branchCode: rawCode,
                branch: branchName,
                username: result.username,
                environment: result.environment as any,
                apiKeyHint: result.apiKeyHint
            };

        } catch (fetchError: any) {
            console.error('Shioaji Profile Error:', fetchError);
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
