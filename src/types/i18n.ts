/**
 * 多語言翻譯型別定義
 */

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
  trade_code_placeholder: string;
  trade_code_ph: string;
  trade_pnl_ph: string;
  trade_qty_ph: string;
  trade_label_code: string;
  trade_label_pnl: string;
  trade_label_qty: string;
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
  cloudBackupSection?: string;
  googleSignIn?: string;
  cloudBackup?: string;
  systemDiagnostics?: string;
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
  useCloudOption: string;
  useLocalOption: string;
  smartMergeOption: string;
  syncStats: string;
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
  share_pnlTitle?: string;
  share_displayAmount?: string;
  share_displayPercent?: string;
  share_displayHidden?: string;
  share_showDaily?: string;
  share_hideDaily?: string;
  share_showChart?: string;
  share_hideChart?: string;
  share_amountsHidden: string;
  share_amountsVisible: string;
  share_chartOn: string;
  share_chartOff: string;
  share_saveImage: string;
  share_generating: string;
}
