/**
 * futuresMultipliers.ts — 期貨每點價值查表（H4, v3.9.1）
 *
 * 取代散在 LogsView / SyncDateModal（初始處理 + autoMerge）三處的
 * includes() 判斷鏈。舊鏈有兩類錯誤：
 *   1. 誤配：'GTF'.includes('TF') → 黃金期誤用金融期乘數 1000（應 100）；
 *      'MTE'.includes('TE') → 小電子誤用電子期乘數 4000（應 500）。
 *   2. 漏配：Shioaji 實際回傳的 API 代碼（MXF/EXF/FXF/TMF...）不含
 *      TAIFEX 網站代號（MTX/TE/TF），整串 includes 全 miss → fallback 200，
 *      小台點數反推錯 4 倍。
 *
 * 查表法：先試前 3 字、再試前 2 字（長 prefix 優先，天然避免誤配），
 * 再退回中文名稱關鍵字，最後 fallback 大台 200。
 * 與 backend/core/pnl.py 的 _FUTURES_MULTIPLIERS 保持同步。
 */

const PREFIX_MULTIPLIERS: Record<string, number> = {
    // Shioaji API 代碼
    TXF: 200,   // 大台
    MXF: 50,    // 小台
    TMF: 10,    // 微台
    EXF: 4000,  // 電子
    ZEF: 500,   // 小電子
    FXF: 1000,  // 金融
    ZFF: 250,   // 小金融
    // TAIFEX 網站代號（歷史資料 / 手動輸入相容）
    MTX: 50,
    MTE: 500,
    TE: 4000,
    TF: 1000,
    T5F: 100,
    XIF: 200,
    GTF: 100,
    UNF: 200,
    TXO: 50,    // 台指選擇權
};

// 中文顯示名關鍵字（display_code 可能是「小台05」這種已轉譯的字串）
// 順序重要：長詞先比，避免「小台」被「台」搶先。
const NAME_KEYWORDS: Array<[string, number]> = [
    ['微台', 10],
    ['小台', 50],
    ['小電子', 500],
    ['電子', 4000],
    ['小金融', 250],
    ['金融', 1000],
    ['東證', 200],
    ['黃金', 100],
    ['櫃買', 100],
    ['非金電', 200],
    ['選', 50],
    ['大台', 200],
    ['台指', 200],
];

/**
 * 從期貨代碼或顯示名稱取得每點價值（NTD/點）。
 * @param code 例如 'MXF05'、'TXFF6'、'小台05'、'MXFF6 小台指'
 * @returns 每點新台幣價值；查無時回大台的 200
 */
export const getFuturesMultiplier = (code: string | null | undefined): number => {
    if (!code) return 200;
    const upper = String(code).toUpperCase().trim();

    // 1. 英文代碼 prefix（長的先查）
    for (const prefix of [upper.slice(0, 3), upper.slice(0, 2)]) {
        if (prefix in PREFIX_MULTIPLIERS) return PREFIX_MULTIPLIERS[prefix];
    }

    // 2. 中文名稱關鍵字
    for (const [kw, mult] of NAME_KEYWORDS) {
        if (code.includes(kw)) return mult;
    }

    return 200;
};
