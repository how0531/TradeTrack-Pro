
// [Manage] Last Updated: 2024-05-22
import React from 'react';

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
  timestamp?: string;
  amount?: string;
  type?: 'profit' | 'loss';
}

export interface AppConfig {
  appId: string;
}

export interface Metrics {
  curve: any[];
  drawdown: any[];
  currentEq: number;
  eqChange: number;
  eqChangePct: number;
  netProfit: number;     // Added: Net Profit for the filtered range
  netProfitPct: number;  // Added: Net Profit % for the filtered range
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
}

export interface MonthlyStats {
  pnl: number;
  winRate: number;
  count: number;
}

export type TimeRange = 'ALL' | '1M' | '3M' | 'YTD' | 'CUSTOM';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type Lang = 'zh' | 'en';
export type ViewMode = 'stats' | 'calendar' | 'logs' | 'settings';
export type SyncStatus = 'synced' | 'saving' | 'error' | 'offline';

export interface CalendarDay {
    key: string;
    day: number | string;
    pnl: number;
}

export interface User {
    uid: string;
    isAnonymous: boolean;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
}

// --- Component Props Interfaces ---

export interface TradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    form: Trade;
    setForm: (t: Trade) => void;
    onSubmit: (e: React.FormEvent) => void;
    isEditing: boolean;
    strategies: string[];
    emotions: string[];
    portfolios: Portfolio[];
    lang: Lang;
    metrics?: Metrics; // Added for Share Card context
}

export interface StrategyDetailModalProps {
    strategy: string | null;
    metrics: Metrics | null; // Updated to use proper Metrics type
    onClose: () => void;
    lang: Lang;
    hideAmounts: boolean;
    ddThreshold: number;
}

export interface SettingsViewProps {
    lang: Lang;
    setLang: (l: Lang) => void;
    trades: Trade[];
    actions: any;
    ddThreshold: number;
    setDdThreshold: (v: number) => void;
    maxLossStreak: number;
    setMaxLossStreak: (v: number) => void;
    lossColor: string;
    setLossColor: (c: string) => void;
    strategies: string[];
    emotions: string[];
    portfolios: Portfolio[];
    activePortfolioIds: string[];
    setActivePortfolioIds: (ids: string[]) => void;
    onBack: () => void;
    currentUser: User | null;
    onLogin: () => void;
    onLogout: () => void;
    lastBackupTime?: Date | null;
    isImportModalOpen?: boolean;
}

export interface LogsViewProps {
    trades: Trade[];
    lang: Lang;
    hideAmounts: boolean;
    portfolios: Portfolio[];
    onEdit: (t: Trade) => void;
    onDelete: (id: string) => void;
}

export interface CalendarViewProps {
    dailyPnlMap: Record<string, number>;
    currentMonth: Date;
    setCurrentMonth: (d: Date) => void;
    onDateClick: (date: string) => void;
    monthlyStats: MonthlyStats;
    hideAmounts: boolean;
    lang: Lang;
    streaks: Streaks;
    strategies: string[];
    emotions: string[];
    filterStrategy: string[];
    setFilterStrategy: (s: string[]) => void;
    filterEmotion: string[];
    setFilterEmotion: (e: string[]) => void;
}

export interface StatsChartProps {
    metrics: Metrics;
    portfolios: Portfolio[];
    activePortfolioIds: string[];
    frequency: Frequency;
    lang: Lang;
    hideAmounts: boolean;
    chartHeight: number;
    setChartHeight: (h: number) => void;
    onZoom?: (start: string, end: string) => void;
}
