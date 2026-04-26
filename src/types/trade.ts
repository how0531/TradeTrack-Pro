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
  price?: number;
  category?: string;
  raw_yield?: number;
  yield?: number;
  points?: string; // e.g. "+150 pts" or "+5.2%"
  // Incremental Sync Fields
  updatedAt?: string;   // ISO string — 每次建立或修改都更新，供增量同步使用
  isDeleted?: boolean;  // 軟刪除旗標，刪除時設為 true 而非真正移除
}

/**
 * 一個權益曲線資料點。每個 portfolio 額外的正/負欄位透過 index signature 容納
 * (`${portfolioId}_pos` / `${portfolioId}_neg`)，因此保留 index signature，
 * 但核心欄位是強型別。
 */
export interface EquityPoint {
  date: string;          // 顯示用 (e.g. "2026/04/15") 或 'Start'
  fullDate: string;      // ISO YYYY-MM-DD 或 'Start'
  timestamp: number;     // epoch ms，圖表 X 軸用
  equity: number;
  peak: number;
  pnl: number;           // 本期 PnL
  cumulativePnl: number; // equity - initialCapital
  isNewPeak: boolean;
  ddPct: number;
  ddAmt: number;
  // portfolio 拆色用的動態欄位 (例: portfolio-1_pos, portfolio-2_neg)
  [key: string]: string | number | boolean | undefined;
}

export interface DrawdownPoint {
  date: string;
  timestamp: number;
  ddPct: number;  // 通常為負值（畫在 0 以下）
}

export interface Metrics {
  curve: EquityPoint[];
  drawdown: DrawdownPoint[];
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
