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
  }
}

export const db = new TradeTrackDB();
