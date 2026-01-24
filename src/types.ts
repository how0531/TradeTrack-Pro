
// [Manage] Last Updated: 2024-05-22
import React from 'react';

export interface Portfolio {
  id: string;
  name: string;
  initialCapital: number;
  profitColor: string;
  lossColor: string;
}

export interface BrokerConfig {
  id: string; // Unique identifier for the account
  alias?: string; // Optional user-defined name
  provider: 'mock' | 'shioaji';
  apiKey: string;
  apiSecret: string;
  personId: string;
  branch?: string; // e.g. "新店" or "9A95"
  brokerUsername?: string; // e.g. "SimulationUser"
  environment?: 'production' | 'simulation';
  caPath: string;
  caPassword: string;
  isConnected: boolean;
  apiKeyHint?: string; // Hint derived from the actual key used by the backend
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
  bestLoss: number; // Added bestLoss
  maxWin: number;   // Added maxWin alias if needed
  maxLoss: number;  // Added maxLoss alias if needed
}

export interface RiskStreaks {
    currentLoss: number;
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

export interface Translation {
    stats: string; journal: string; logs: string; settings: string;
    initialCapital: string; currentEquity: string; newPeak: string;
    drawdown: string; currentDD: string; winRate: string; profitFactor: string;
    riskReward: string; avgWin: string; avgLoss: string; maxDD: string;
    sharpe: string; strategies: string; strategyList: string; mindsetList: string;
    addStrategy: string; addMindset: string; noData: string; monthlyPnl: string;
    trades: string; addTrade: string; editTrade: string; profit: string; loss: string;
    save: string; update: string; notePlaceholder: string; uncategorized: string;
    language: string; deleteTitle: string; deleteConfirm: string;
    cancel: string; delete: string; allStrategies: string; allEmotions: string; selected: string;
    filterByStrategy: string; selectStrategy: string; strategyAnalysis: string; riskSettings: string;
    ddThreshold: string; ddWarning: string; danger: string; warning: string;
    emptyStateTitle: string; emptyStateDesc: string; mindset: string;
    currentStreak: string; bestStreak: string; netProfit: string; riskStatus: string;
    time_all: string; time_1m: string; time_3m: string; time_ytd: string; time_custom: string;
    selectDateRange: string; startDate: string; endDate: string; confirm: string; reset: string;
    dataManagement: string; 
    backupDownload: string; 
    backupImport: string;
    backupCloud: string;
    importSuccess: string; importError: string;
    freq_daily: string; freq_weekly: string; freq_monthly: string;
    freq_quarterly: string; freq_yearly: string;
    status_newHigh: string; status_safe: string; status_warning: string; status_broken: string;
    portfolio: string; switchPortfolio: string; addPortfolio: string; managePortfolios: string;
    portfolioName: string; selectAll: string; add: string;
    short_daily: string; short_weekly: string; short_monthly: string; short_quarterly: string; short_yearly: string;
    preferences: string; lossColor: string;
    strategyTip: string;
    mindsetTip: string;
    
    // Portfolio Selector Translations
    allAccounts: string;
    multiple: string;
    
    // Cloud Backup specific
    syncTitle: string; 
    syncDesc: string; 
    syncing: string; 
    synced: string; 
    lastBackup: string;
    offline: string; 
    saving: string; 
    saved: string; 
    syncError: string; 
    retry: string;
    
    loginWithGoogle: string; loginWithApple: string; logout: string;
    migrateConfirm: string;
    sort_date: string; sort_pnl_high: string; sort_pnl_low: string;
    dangerZone: string; resetAll: string; resetDesc: string;
    resetConfirm: string;
    tagManagement: string;
    risk_dd_desc: string;
    risk_streak_desc: string;
    maxLossStreak: string;
    
    // Sync Conflict Modal
    syncConflictTitle: string;
    syncConflictDesc: string;
    mergeOption: string;
    mergeDesc: string;
    discardOption: string;
    discardDesc: string;
    processing: string;

    // Import Conflict Modal
    importConflictTitle: string;
    importConflictDesc: string;
    overwriteOption: string;
    mergeImportOption: string;
    
    // Logs Filter
    filter_notes: string;

    // New Stats
    daysSincePeak: string;

    // Share Card Translations
    share_tradeResult: string;
    share_performance: string;
    share_winRate: string;
    share_trades: string;
    share_pf: string;
    share_result: string;
    share_win: string;
    share_loss: string;
    share_amountsHidden: string;
    share_amountsVisible: string;
    share_chartOn: string;
    share_chartOff: string;
    share_saveImage: string;
    share_generating: string;
}

// --- Component Props Interfaces ---

export interface TradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    form: Trade;
    setForm: (t: Trade) => void;
    onSubmit: (e: React.FormEvent) => void;
    isEditing: boolean;
    // Context provided: strategies, emotions, portfolios, lang, metrics
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
    showPurePnl?: boolean;
}
