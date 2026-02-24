/**
 * 交易相關核心型別定義
 */

export interface Portfolio {
  id: string;
  name: string;
  initialCapital: number;
  profitColor: string;
  lossColor: string;
}

export interface Trade {
  id: string;
  date: string;
  pnl: number;
  strategy?: string;
  emotion?: string;
  note?: string;
  image?: string;
  portfolioId?: string;
  orderNo?: string;
  timestamp?: string;
  amount?: string;
  type?: 'profit' | 'loss';
  code?: string;
  entryPrice?: number;
  exitPrice?: number;
  quantity?: number;
  category?: string;
  raw_yield?: number;
  yield?: number;
  points?: string; // e.g. "+150 pts" or "+5.2%"
}

export interface Metrics {
  curve: any[];
  drawdown: any[];
  currentEq: number;
  eqChange: number;
  eqChangePct: number;
  netProfit: number;     // Net Profit for the filtered range
  netProfitPct: number;  // Net Profit % for the filtered range
  currentDD: number;
  maxDD: number;
  winRate: number;
  pf: number;
  riskReward: number;
  stratStats: Record<string, StrategyStat>;
  isPeak: boolean;
  sharpe: number;
  avgWin: number;
  avgLoss: number;
  totalTrades: number;
  maxStagnationDays: number;
  expectancy: number; // Avg profit per trade
}

export interface StrategyStat {
  pnl: number;
  trades: number;
  winRate: number;
  mddPct: number;
  curDDPct: number;
  isNewHigh: boolean;
  riskReward: number;
  avgWin: number;
  avgLoss: number;
}

export interface Streaks {
  currentWin: number;
  currentLoss: number;
  bestWin: number;
  bestLoss: number;
  maxWin: number;
  maxLoss: number;
}

export interface RiskStreaks {
  currentLoss: number;
}

export interface MonthlyStats {
  pnl: number;
  winRate: number;
  count: number;
}

export interface CalendarDay {
  key: string;
  day: number | string;
  pnl: number;
}
