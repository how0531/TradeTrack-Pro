import { db } from '../db';
import { Trade, Portfolio } from '../types';

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

    // 1. 遷移 Trades
    const tradesStr = localStorage.getItem('local_trades');
    if (tradesStr) {
      const trades: Trade[] = JSON.parse(tradesStr);
      if (trades.length > 0) {
        await db.trades.bulkAdd(trades);
        migrated += trades.length;
        console.log(`✅ 已遷移 ${trades.length} 筆交易`);
      }
    }

    // 2. 遷移 Portfolios
    const portfoliosStr = localStorage.getItem('local_portfolios');
    if (portfoliosStr) {
      const portfolios: Portfolio[] = JSON.parse(portfoliosStr);
      if (portfolios.length > 0) {
        await db.portfolios.bulkAdd(portfolios);
        console.log(`✅ 已遷移 ${portfolios.length} 個帳戶組合`);
      }
    }

    // 3. 遷移 Strategies
    const strategiesStr = localStorage.getItem('local_strategies');
    if (strategiesStr) {
      const strategies: string[] = JSON.parse(strategiesStr);
      if (strategies.length > 0) {
        await db.strategies.bulkAdd(strategies.map(name => ({ name })));
        console.log(`✅ 已遷移 ${strategies.length} 個策略`);
      }
    }

    // 4. 遷移 Emotions
    const emotionsStr = localStorage.getItem('local_emotions');
    if (emotionsStr) {
      const emotions: string[] = JSON.parse(emotionsStr);
      if (emotions.length > 0) {
        await db.emotions.bulkAdd(emotions.map(name => ({ name })));
        console.log(`✅ 已遷移 ${emotions.length} 個情緒標籤`);
      }
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
