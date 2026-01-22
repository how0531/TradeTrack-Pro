import { Translation } from '../types';

export const en: Translation = {
    stats: 'Stats', journal: 'Journal', logs: 'Logs', settings: 'Settings',
    initialCapital: 'Initial Capital', currentEquity: 'Total Equity', newPeak: 'New High',
    drawdown: 'Drawdown', currentDD: 'Current DD', winRate: 'Win Rate', profitFactor: 'Profit Factor',
    riskReward: 'Risk/Reward', avgWin: 'Avg Win', avgLoss: 'Avg Loss', maxDD: 'Max Drawdown',
    sharpe: 'Sharpe Ratio', strategies: 'Strategy Performance', strategyList: 'Strategies', mindsetList: 'Trade Types',
    addStrategy: 'Add Strategy...', addMindset: 'Add Type...', noData: 'No Data', monthlyPnl: 'Monthly PnL',
    trades: 'T', addTrade: 'Add Trade', editTrade: 'Edit Trade', profit: 'Profit', loss: 'Loss',
    save: 'Save', update: 'Update', notePlaceholder: 'Notes...', uncategorized: 'Uncategorized',
    language: 'Language', deleteTitle: 'Delete Trade', deleteConfirm: 'Are you sure you want to delete this trade? This cannot be undone.',
    cancel: 'Cancel', delete: 'Delete', allStrategies: 'All Strategies', allEmotions: 'All Types', selected: 'Selected',
    filterByStrategy: 'Filter by Strategy', selectStrategy: 'Select Strategy', strategyAnalysis: 'Strategy Analysis', riskSettings: 'Risk Management',
    ddThreshold: 'Max Drawdown Threshold', ddWarning: 'Warning Zone: 5% left', danger: 'Danger', warning: 'Warning',
    emptyStateTitle: 'Start Your Trading Legacy', emptyStateDesc: 'Log your first trade and pave the way to consistent profits.', mindset: 'Type',
    currentStreak: 'Current Streak', bestStreak: 'Best Streak', netProfit: 'Net Profit', riskStatus: 'Risk Status',
    time_all: 'All Time', time_1m: 'Last Month', time_3m: 'Last Quarter', time_ytd: 'YTD', time_custom: 'Custom',
    selectDateRange: 'Select Date Range', startDate: 'Start Date', endDate: 'End Date', confirm: 'Confirm', reset: 'Reset',
    dataManagement: 'Backup & Restore', 
    backupDownload: 'Export Backup', 
    backupImport: 'Import Backup',
    backupCloud: 'Backup Now',
    importSuccess: 'Import Successful!', importError: 'Import Failed. Check format.',
    freq_daily: 'Daily', freq_weekly: 'Weekly', freq_monthly: 'Monthly',
    freq_quarterly: 'Quarterly', freq_yearly: 'Yearly',
    status_newHigh: 'New High', status_safe: 'Safe', status_warning: 'Caution', status_broken: 'Broken',
    portfolio: 'Account', switchPortfolio: 'Switch Portfolio', addPortfolio: 'Add Portfolio', managePortfolios: 'Manage Portfolios',
    portfolioName: 'Account Name', selectAll: 'Select All', add: 'Add',
    short_daily: 'D', short_weekly: 'W', short_monthly: 'M', short_quarterly: 'Q', short_yearly: 'Y',
    preferences: 'Preferences', lossColor: 'Default Loss Color',
    strategyTip: 'Format: "Name_Note" (e.g. Breakout_AM). Text after underscore becomes a note.',
    mindsetTip: 'Categorizing trade types helps with performance analysis.',
    
    // Portfolio Selector Translations
    allAccounts: 'All Accounts',
    multiple: 'Multiple',

    // Cloud Backup specific
    syncTitle: 'Google Cloud Backup', 
    syncDesc: 'Sign in to enable automatic real-time backup', 
    syncing: 'Backing up...', 
    synced: 'Backed up to Google Cloud', 
    lastBackup: 'Last Backup',
    offline: 'Offline Mode', 
    saving: 'Uploading...', 
    saved: 'Saved', 
    syncError: 'Backup Error', 
    retry: 'Retry',
    
    loginWithGoogle: 'Login & Backup', loginWithApple: 'Sign in with Apple', logout: 'Logout',
    migrateConfirm: 'Found local data. Would you like to sync it to the cloud?',
    sort_date: 'Date', sort_pnl_high: 'High PnL', sort_pnl_low: 'Low PnL',
    dangerZone: 'Danger Zone', resetAll: 'Reset All Data', resetDesc: 'Permanently delete all trades and settings',
    resetConfirm: 'WARNING: Are you sure you want to delete EVERYTHING? This cannot be undone.',
    tagManagement: 'Tag Management',
    risk_dd_desc: 'Alert when Net Equity drops from peak by this %.',
    risk_streak_desc: 'Alert when consecutive losses exceed this limit.',
    maxLossStreak: 'Max Loss Streak',

    // Sync Conflict Modal
    syncConflictTitle: 'Data Conflict Detected',
    syncConflictDesc: 'We found local data on this device that is not synced. How would you like to proceed?',
    mergeOption: 'Merge & Sync',
    mergeDesc: 'Recommended. Keeps local data and uploads it to the cloud.',
    discardOption: 'Discard Local Data',
    discardDesc: 'Keep only cloud data. Local changes will be lost.',
    processing: 'Processing...',

    // Import Conflict Modal
    importConflictTitle: 'Existing Data Detected',
    importConflictDesc: 'You have existing trades on this device. Importing will overwrite them. Do you want to merge or overwrite?',
    overwriteOption: 'Overwrite',
    mergeImportOption: 'Merge',
    
    // Logs Filter
    filter_notes: 'Notes Only',

    // New Stats
    daysSincePeak: 'Max Stagnation (Days)',

    // Share Card Translations
    share_tradeResult: 'TRADE RESULT',
    share_performance: 'PERFORMANCE',
    share_winRate: 'WIN RATE',
    share_trades: 'TRADES',
    share_pf: 'PROFIT FACTOR',
    share_result: 'RESULT',
    share_win: 'WIN',
    share_loss: 'LOSS',
    share_amountsHidden: 'Amounts Hidden',
    share_amountsVisible: 'Amounts Visible',
    share_chartOn: 'Chart On',
    share_chartOff: 'Chart Off',
    share_saveImage: 'Save Image',
    share_generating: 'Generating...'
};
