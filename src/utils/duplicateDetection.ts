
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
      
      // 方法 2: 回退方案 - 同日期 + 同成交金額
      const sameDate = new Date(trade.date).toDateString() === 
                       new Date(other.date).toDateString();
      const sameAmount = trade.amount && 
                        other.amount && 
                        trade.amount === other.amount;
      
      return sameDate && sameAmount;
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
