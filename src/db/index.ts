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
    
    this.version(1).stores({
      trades: 'id, date, pnl, portfolioId, strategy, emotion, timestamp',
      portfolios: 'id, name',
      strategies: '++id, &name', // & = unique constraint
      emotions: '++id, &name'
    });
  }
}

export const db = new TradeTrackDB();
