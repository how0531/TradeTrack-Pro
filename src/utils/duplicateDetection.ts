
import { Trade } from '../types';

export interface DuplicateGroup {
  original: Trade;
  duplicates: Trade[];
}

export interface DetectionOptions {
  useOrderNoOnly?: boolean;
}

/**
 * 檢測重複交易
 * 判斷標準：
 * 1. 優先使用 orderNo（委託單號）- 券商的唯一識別碼
 * 2. 回退方案：同日期 + 同成交金額 (amount)
 */
export function detectDuplicates(
  trades: Trade[],
  options: DetectionOptions = {}
): DuplicateGroup[] {
  const { useOrderNoOnly = false } = options;
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  // 舊版 SyncDateModal 在 Shioaji 未回傳單號時會塞合成的 `unknown-{i}`，
  // 不同批次都從 unknown-0 開始發號，純字串相等比對會錯誤命中。這裡判斷
  // 「是否為真正的券商單號」時，先過濾掉這些合成值。
  const isRealOrderNo = (no?: string | null): no is string =>
    !!no && !no.startsWith('unknown');

  trades.forEach((trade, index) => {
    if (processed.has(trade.id)) return;

    const duplicates = trades.slice(index + 1).filter(other => {
      if (processed.has(other.id)) return false;

      // 方法 1: 使用 orderNo — 僅當兩邊都是真實單號才採用「正向命中」。
      // H7 (v3.9.1): orderNo 相等還必須同日 + 同代號才判定重複。
      // Shioaji ProfitLoss 的 id 是查詢結果的列序號（0,1,2,...），
      // 不是全域唯一單號 — 不同帳號/不同批次的第 N 筆都會拿到相同
      // orderNo，只比 orderNo 會把兩筆無關的真實交易誤判成重複，
      // removeDuplicates 一鍵直接刪掉其中一筆。
      // v3.9.4: 方法1 只做正向命中，不命中時「落到方法2」而非直接判非重複 —
      // 列序號跨批次會位移，同一筆交易兩次同步可能拿到不同序號，
      // 舊邏輯在單號不同時 return false，真重複永遠抓不到。
      if (isRealOrderNo(trade.orderNo) && isRealOrderNo(other.orderNo)) {
        if (trade.orderNo === other.orderNo) {
          const dateA = new Date(trade.date).toISOString().split('T')[0];
          const dateB = new Date(other.date).toISOString().split('T')[0];
          const codeA = trade.code ? trade.code.split(' ')[0].trim() : '';
          const codeB = other.code ? other.code.split(' ')[0].trim() : '';
          if (dateA === dateB && codeA === codeB) return true;
        }
      }

      // 若設定為僅用 orderNo，則跳過其他條件
      if (useOrderNoOnly) return false;

      // 方法 2: 回退方案 - 同日期 + 同標的代號 + 同損益
      // qty/price 僅在「兩邊都有非零值」時才加入比對，避免舊資料缺欄位導致誤判
      const sameDate = new Date(trade.date).toISOString().split('T')[0] ===
        new Date(other.date).toISOString().split('T')[0];
      if (!sameDate) return false;

      // 比對標的代號（提取純代號部分）
      const tradeCode = trade.code ? trade.code.split(' ')[0].trim() : '';
      const otherCode = other.code ? other.code.split(' ')[0].trim() : '';
      const sameCode = !!(tradeCode && otherCode && tradeCode === otherCode);
      if (!sameCode) return false;

      // 比對損益 (±2 容差，容錯手續費差異)
      const samePnl = Math.abs(trade.pnl - other.pnl) < 2;
      if (!samePnl) return false;

      // 數量：僅當兩邊都有非零值時才要求相符
      const tQty = trade.quantity ?? 0;
      const oQty = other.quantity ?? 0;
      if (tQty !== 0 && oQty !== 0 && Math.abs(tQty - oQty) >= 0.001) return false;

      // 價格：僅當兩邊都有非零值時才要求相符
      const tPrice = trade.price ?? 0;
      const oPrice = other.price ?? 0;
      if (tPrice !== 0 && oPrice !== 0 && Math.abs(tPrice - oPrice) >= 0.01) return false;

      return true;
    });

    if (duplicates.length > 0) {
      groups.push({
        original: trade,
        duplicates: duplicates
      });

      processed.add(trade.id);
      duplicates.forEach(d => processed.add(d.id));
    }
  });

  return groups;
}

/**
 * 合併重複交易（刪除重複筆數）
 * 保留第一筆（original），刪除後續重複筆數
 */
export function mergeDuplicates(
  trades: Trade[],
  duplicateGroups: DuplicateGroup[]
): Trade[] {
  const toRemove = new Set<string>();

  duplicateGroups.forEach(group => {
    group.duplicates.forEach(d => toRemove.add(d.id));
  });

  return trades.filter(t => !toRemove.has(t.id));
}

/**
 * 取得重複交易的統計資訊
 */
export function getDuplicateStats(duplicateGroups: DuplicateGroup[]) {
  const totalDuplicates = duplicateGroups.reduce(
    (sum, group) => sum + group.duplicates.length,
    0
  );

  return {
    groupCount: duplicateGroups.length,
    totalDuplicates: totalDuplicates,
    tradeIds: duplicateGroups.map(g => g.original.id)
  };
}
