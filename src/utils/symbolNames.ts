/**
 * 期貨商品代碼與中文名稱對照表
 * 用於當後端無法查詢到合約名稱時的 fallback
 */
export const FUTURES_NAME_MAP: Record<string, string> = {
    // 台指期貨系列
    'TXF': '台指期',
    'MTX': '小台指',
    
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
 * 格式化標的代碼，確保包含中文名稱
 * @param code 原始代碼（可能是 "TXFK6" 或 "TXFK6 台指期" 或 "2330 台積電"）
 * @returns 格式化後的代碼（確保有中文名稱）
 */
export const formatSymbolCode = (code: string | null | undefined): string => {
    // 處理 null/undefined/空字串
    if (!code || typeof code !== 'string') {
        console.warn('[formatSymbolCode] Invalid code:', code);
        return 'Unknown';
    }
    
    // 移除前後空白
    const trimmedCode = code.trim();
    if (!trimmedCode) {
        console.warn('[formatSymbolCode] Empty code after trim');
        return 'Unknown';
    }
    
    // 如果已經包含空格（表示已有名稱），直接返回
    if (trimmedCode.includes(' ')) {
        return trimmedCode;
    }
    
    // 嘗試猜測期貨名稱
    const futuresName = guessFuturesName(trimmedCode);
    if (futuresName) {
        return `${trimmedCode} ${futuresName}`;
    }
    
    // 如果無法猜測，返回原代碼
    return trimmedCode;
};

