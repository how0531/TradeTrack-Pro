import { db } from '../db';
import { Trade, Portfolio } from '../types';

// 防呆驗證：localStorage 是使用者瀏覽器的舊資料，不能信任結構正確
// 任何欄位異常都跳過該筆，並把錯誤統一收進回傳的 droppedItems[]，避免靜默 corrupt IndexedDB
function safeParseArray<T>(raw: string | null, label: string): { items: T[]; parseError?: string } {
  if (!raw) return { items: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { items: [], parseError: `${label}: 不是陣列 (got ${typeof parsed})` };
    }
    return { items: parsed as T[] };
  } catch (e: any) {
    return { items: [], parseError: `${label}: JSON 解析失敗 (${e?.message || e})` };
  }
}

function isValidTrade(t: any): t is Trade {
  return !!t && typeof t === 'object' &&
    typeof t.id === 'string' && t.id.length > 0 &&
    typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    typeof t.pnl === 'number' && !Number.isNaN(t.pnl);
}

function isValidPortfolio(p: any): p is Portfolio {
  return !!p && typeof p === 'object' &&
    typeof p.id === 'string' && p.id.length > 0 &&
    typeof p.name === 'string' &&
    typeof p.initialCapital === 'number' && !Number.isNaN(p.initialCapital);
}

/**
 * 從 localStorage 遷移資料到 IndexedDB
 */
export const migrateFromLocalStorage = async () => {
  console.log('🔄 開始從 localStorage 遷移資料到 IndexedDB...');

  try {
    // 檢查是否已經遷移過
    const tradeCount = await db.trades.count();
    if (tradeCount > 0) {
      console.log('ℹ️  IndexedDB 已有資料，跳過遷移');
      return { success: true, skipped: true, count: tradeCount };
    }

    let migrated = 0;
    const droppedItems: string[] = [];
    const parseErrors: string[] = [];

    // 1. 遷移 Trades — 驗證欄位後再寫入，跳過壞資料
    const { items: trades, parseError: tradeParseErr } = safeParseArray<any>(
      localStorage.getItem('local_trades'), 'trades'
    );
    if (tradeParseErr) parseErrors.push(tradeParseErr);
    if (trades.length > 0) {
      const validTrades = trades.filter((t: any) => {
        if (isValidTrade(t)) return true;
        droppedItems.push(`trade ${t?.id || '<unknown>'} (date=${t?.date}, pnl=${t?.pnl})`);
        return false;
      });
      if (validTrades.length > 0) {
        await db.trades.bulkAdd(validTrades);
        migrated += validTrades.length;
      }
      console.log(`✅ 已遷移 ${validTrades.length} 筆交易 (跳過 ${trades.length - validTrades.length} 筆無效)`);
    }

    // 2. 遷移 Portfolios
    const { items: portfolios, parseError: portfolioParseErr } = safeParseArray<any>(
      localStorage.getItem('local_portfolios'), 'portfolios'
    );
    if (portfolioParseErr) parseErrors.push(portfolioParseErr);
    if (portfolios.length > 0) {
      const validPortfolios = portfolios.filter((p: any) => {
        if (isValidPortfolio(p)) return true;
        droppedItems.push(`portfolio ${p?.id || '<unknown>'} (name=${p?.name})`);
        return false;
      });
      if (validPortfolios.length > 0) {
        await db.portfolios.bulkAdd(validPortfolios);
      }
      console.log(`✅ 已遷移 ${validPortfolios.length} 個帳戶組合 (跳過 ${portfolios.length - validPortfolios.length} 筆無效)`);
    }

    // 3. 遷移 Strategies — 簡單字串陣列，過濾掉非字串
    const { items: strategies, parseError: stratErr } = safeParseArray<any>(
      localStorage.getItem('local_strategies'), 'strategies'
    );
    if (stratErr) parseErrors.push(stratErr);
    if (strategies.length > 0) {
      const validStrats = strategies.filter((s: any) => typeof s === 'string' && s.length > 0);
      if (validStrats.length > 0) {
        await db.strategies.bulkAdd(validStrats.map(name => ({ name })));
      }
      console.log(`✅ 已遷移 ${validStrats.length} 個策略`);
    }

    // 4. 遷移 Emotions
    const { items: emotions, parseError: emoErr } = safeParseArray<any>(
      localStorage.getItem('local_emotions'), 'emotions'
    );
    if (emoErr) parseErrors.push(emoErr);
    if (emotions.length > 0) {
      const validEmos = emotions.filter((e: any) => typeof e === 'string' && e.length > 0);
      if (validEmos.length > 0) {
        await db.emotions.bulkAdd(validEmos.map(name => ({ name })));
      }
      console.log(`✅ 已遷移 ${validEmos.length} 個情緒標籤`);
    }

    if (droppedItems.length > 0) {
      console.warn(`⚠️ 遷移過程跳過 ${droppedItems.length} 筆無效資料：`, droppedItems.slice(0, 10));
    }
    if (parseErrors.length > 0) {
      console.warn(`⚠️ JSON 解析錯誤：`, parseErrors);
    }

    // 5. 標記遷移完成（保留 localStorage 作為備份）
    localStorage.setItem('migration_to_indexeddb_completed', 'true');
    localStorage.setItem('migration_timestamp', new Date().toISOString());
    
    console.log(`🎉 遷移完成！共遷移 ${migrated} 筆交易資料`);
    console.log('ℹ️  原 localStorage 資料已保留作為備份');
    
    return { success: true, count: migrated };
    
  } catch (error: any) {
    console.error('❌ 遷移失敗:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 檢查是否需要遷移
 */
export const needsMigration = (): boolean => {
  const hasLocalStorageData = localStorage.getItem('local_trades') !== null;
  const migrationCompleted = localStorage.getItem('migration_to_indexeddb_completed') === 'true';
  
  return hasLocalStorageData && !migrationCompleted;
};

/**
 * 清除 localStorage 備份（謹慎使用！）
 */
export const clearLocalStorageBackup = () => {
  const keysToRemove = [
    'local_trades',
    'local_strategies',
    'local_emotions',
    'local_portfolios'
  ];
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log('🗑️  已清除 localStorage 備份資料');
};
