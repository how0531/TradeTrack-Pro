
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

  trades.forEach((trade, index) => {
    if (processed.has(trade.id)) return;

    const duplicates = trades.slice(index + 1).filter(other => {
      if (processed.has(other.id)) return false;

      // 方法 1: 使用 orderNo（最準確）
      if (trade.orderNo && other.orderNo) {
        return trade.orderNo === other.orderNo;
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
