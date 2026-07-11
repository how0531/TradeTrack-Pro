import Dexie, { Table } from 'dexie';
import { Trade, Portfolio } from '../types';

export interface StrategyRecord {
  id?: number;
  name: string;
}

export interface EmotionRecord {
  id?: number;
  name: string;
}

export class TradeTrackDB extends Dexie {
  trades!: Table<Trade, string>; // id as primary key
  portfolios!: Table<Portfolio, string>;
  strategies!: Table<StrategyRecord, number>;
  emotions!: Table<EmotionRecord, number>;

  constructor() {
    super('TradeTrackDB');

    // ┌─ Schema versioning ─────────────────────────────────────────────────┐
    // │ 新增欄位請新增一個 .version(N) 而不是改既有的；Dexie 會依序套用，    │
    // │ 並可在 .upgrade() 內 backfill 既有資料的預設值，避免 v1 → v2 升級   │
    // │ 時讀到 undefined。                                                  │
    // │                                                                     │
    // │ 範例：                                                              │
    // │   this.version(2).stores({                                          │
    // │     trades: 'id, date, pnl, portfolioId, strategy, emotion, ' +     │
    // │             'timestamp, riskPercentage'                             │
    // │   }).upgrade(tx =>                                                  │
    // │     tx.table('trades').toCollection().modify(t => {                 │
    // │       if (t.riskPercentage == null) t.riskPercentage = 0;           │
    // │     })                                                              │
    // │   );                                                                │
    // └─────────────────────────────────────────────────────────────────────┘

    this.version(1).stores({
      trades: 'id, date, pnl, portfolioId, strategy, emotion, timestamp',
      portfolios: 'id, name',
      strategies: '++id, &name', // & = unique constraint
      emotions: '++id, &name'
    });

    // v3.9.3 dirty-flag 同步：既有列 backfill syncedAt = updatedAt（視為 clean）。
    // 沒有這個 backfill，升級後全表 !syncedAt → 全部 dirty → 每台裝置整表
    // 重推歷史交易；久未開啟的裝置會把陳舊副本以 serverTimestamp LWW 蓋過
    // 其他裝置的較新編輯（大規模靜默回滾）。v2 時代真的還沒推送的少數變更
    // 會被視為 clean —— 代價可接受：下次編輯即重新變 dirty。
    this.version(2).stores({
      trades: 'id, date, pnl, portfolioId, strategy, emotion, timestamp',
      portfolios: 'id, name',
      strategies: '++id, &name',
      emotions: '++id, &name'
    }).upgrade(tx => {
      // 缺 updatedAt 的舊列（legacy localStorage 遷移、舊版匯入）也要 backfill —
      // 跳過的話這批列升級後仍整批 dirty，休眠裝置重推會以 serverTimestamp
      // LWW 蓋掉他機較新編輯。isTradeDirty 對「有 syncedAt、無 updatedAt」判
      // clean，語意正確。
      const nowIso = new Date().toISOString();
      return tx.table('trades').toCollection().modify((t: any) => {
        if (!t.syncedAt) t.syncedAt = t.updatedAt || t.timestamp || nowIso;
      });
    });
  }
}

export const db = new TradeTrackDB();
