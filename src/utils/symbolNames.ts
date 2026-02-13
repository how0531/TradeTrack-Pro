/**
 * 期貨商品代碼與中文名稱對照表
 * 用於當後端無法查詢到合約名稱時的 fallback
 */
export const FUTURES_NAME_MAP: Record<string, string> = {
    // 台指期貨系列
    'TXF': '大台',
    'TX': '大台', 
    'MTX': '小台',
    'MXF': '小台',
    
    // 電子期貨系列
    'TE': '電子期',
    'MTE': '小電子期',
    
    // 金融期貨系列
    'TF': '金融期',
    
    // 其他商品
    'T5F': '櫃買期',
    'UNF': '非金電期',
    'GTF': '黃金期',
    'XIF': '東證期',
    'SP': 'S&P期',
    'ND': '那斯達克期',
};

/**
 * 從期貨代碼猜測商品名稱
 * 例如：TXFK6 -> TXF -> 台指期
 */
export const guessFuturesName = (code: string): string | null => {
    if (!code) return null;
    
    // 嘗試匹配前3碼
    const prefix3 = code.substring(0, 3).toUpperCase();
    if (FUTURES_NAME_MAP[prefix3]) {
        return FUTURES_NAME_MAP[prefix3];
    }
    
    // 嘗試匹配前2碼
    const prefix2 = code.substring(0, 2).toUpperCase();
    if (FUTURES_NAME_MAP[prefix2]) {
        return FUTURES_NAME_MAP[prefix2];
    }
    
    return null;
};

/**
 * 自定義期貨月份代碼表 (使用者專屬規則)
 * A=01, B=02, ... L=12
 */
export const CUSTOM_MONTH_MAP: Record<string, string> = {
    'A': '01', 'B': '02', 'C': '03', 'D': '04', 'E': '05', 'F': '06',
    'G': '07', 'H': '08', 'I': '09', 'J': '10', 'K': '11', 'L': '12'
};

/**
 * 解析自定義期貨代碼
 * 規則 1 (月選/期貨): 商品(TXF) + 月份(B) + 年份(6) -> TXFB6 -> 台指期02
 * 規則 2 (週選/期貨): 商品(TX) + 週次(1-5) -> TX1 -> 週小台1
 */
export const parseCustomFuturesCode = (code: string): string | null => {
    if (!code) return null;
    const cleanCode = code.toUpperCase().trim();

    // 1. 檢查週選規則: [Product][1-5] (e.g., TX1, MTX2)
    const weeklyRegex = /^([A-Z]+)([1-5])$/;
    const weeklyMatch = cleanCode.match(weeklyRegex);
    if (weeklyMatch) {
        const productPrefix = weeklyMatch[1];
        const weekNum = weeklyMatch[2];

        // 特殊規則: TX + 數字 = 週小台 (使用者定義)
        if (productPrefix === 'TX') {
            return `週小台W${weekNum}`;
        }
        
        // 一般規則: 名稱 + 週X
        const name = FUTURES_NAME_MAP[productPrefix];
        if (name) {
            return `${name}週${weekNum}`;
        }
    }

    // 2. 檢查月選規則: [Product][Month][Year] (e.g., TXFB6, TXFK5)
    // Regex: (商品前綴) + (自定義月份 A-L) + (年份 0-9)
    const monthlyRegex = /^([A-Z]+)([A-L])(\d)$/;
    const monthlyMatch = cleanCode.match(monthlyRegex);
    
    if (monthlyMatch) {
        const productCode = monthlyMatch[1]; // e.g., TXF
        const monthChar = monthlyMatch[2];   // e.g., B
        // const yearDigit = monthlyMatch[3]; // Year digit unused in display name currently
        
        let productName = FUTURES_NAME_MAP[productCode];
        
        // Fallback: Try removing last char (e.g., if TXF not found, try TX? Though TXF is mapped)
        if (!productName && productCode.length > 2) {
             const shortCode = productCode.substring(0, productCode.length - 1);
             productName = FUTURES_NAME_MAP[shortCode];
        }
        
        const monthNum = CUSTOM_MONTH_MAP[monthChar];
        
        if (productName && monthNum) {
            return `${productName}${monthNum}`;
        }
    }
    
    return null;
};

import { STOCK_NAME_MAP } from './stockMap';

// 忽略的系統預設名稱後綴 (Regex)
// 例如: "台指期", "小型臺指02"
const IGNORED_SUFFIX_REGEX = /^(台指期|小台指|小型台指|小型臺指|電子期|金融期|櫃買期|非金電期|黃金期|東證期|S&P期|那斯達克期)(\d+)?$/;

/**
 * 格式化標的代碼，確保包含中文名稱
 * @param code 原始代碼（可能是 "TXFK6" 或 "TXFK6 台指期" 或 "2330 台積電"）
 * @returns 格式化後的代碼（確保有中文名稱）
 */
export const formatSymbolCode = (code: string | null | undefined): string => {
    // 處理 null/undefined/空字串
    if (!code || typeof code !== 'string') {
        // console.warn('[formatSymbolCode] Invalid code:', code); // Remove warn to reduce noise
        return 'Unknown';
    }
    
    // 移除前後空白
    const trimmedCode = code.trim();
    if (!trimmedCode) return 'Unknown';
    
    // Check for space-separated suffix (e.g. "TXFC6 g3" or "TXFB6 台指期")
    if (trimmedCode.includes(' ')) {
        const parts = trimmedCode.split(/\s+/);
        const firstToken = parts[0];
        const rest = parts.slice(1).join(' ');
        
        // Try parsing the first token
        const parsedFirst = parseCustomFuturesCode(firstToken);
        if (parsedFirst) {
            // Check if trailing part is a known system suffix to ignore
            if (IGNORED_SUFFIX_REGEX.test(rest)) {
                 return parsedFirst; // Strip the redundant suffix
            }
            return `${parsedFirst} ${rest}`; // Keep user note (e.g. "g3")
        }
        
        // Try mapping stock code in first token (e.g. "2330 someNote")
        if (STOCK_NAME_MAP[firstToken]) {
            return `${firstToken} ${STOCK_NAME_MAP[firstToken]} ${rest}`;
        }
        
        return trimmedCode;
    }
    
    // 1. Stock Master Check (Exact Match)
    // e.g. "2330" -> "2330 台積電"
    if (STOCK_NAME_MAP[trimmedCode]) {
        return `${trimmedCode} ${STOCK_NAME_MAP[trimmedCode]}`;
    }
    
    // 2. Custom Futures Check
    // e.g. "TXFB6" -> "大台02"
    const customName = parseCustomFuturesCode(trimmedCode);
    if (customName) {
        return customName; 
    }
    
    // 3. Fallback Futures Guess
    const futuresName = guessFuturesName(trimmedCode);
    if (futuresName) {
        return `${trimmedCode} ${futuresName}`;
    }
    
    // 如果無法猜測，返回原代碼
    return trimmedCode;
};


