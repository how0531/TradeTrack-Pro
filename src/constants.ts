
// 由 vite.config.ts 在 build time 從 package.json 注入，避免手動同步漏改。
export const APP_VERSION = `v${__APP_VERSION__}`;
export const THEME = {
    GOLD: '#C8B085',
    GOLD_BG: '#2A2824',
    BLUE: '#526D82',
    RED: '#D05A5A',
    GREEN: '#5B9A8B',
    GREEN_DARK: '#2C5F54',
    BG_DARK: '#0B0C10',
    BG_CARD: '#141619',
    TEXT_MAIN: '#E0E0E0',
    DD_GRADIENT_TOP: '#5B9A8B',
    DD_GRADIENT_BOTTOM: '#2C5F54',
    DEFAULT_LOSS: '#28573f',
    LOSS_WHITE: '#CBD5E1',
    BLUE_LOSS: '#3B82F6',
    PURPLE_LOSS: '#8B5CF6',
};

// Unified Account Category Styles
export const ACCOUNT_CATEGORY_THEMES = {
    STOCK: {
        label: '台股',
        text: 'text-rose-400',
        bg: 'bg-rose-500/10',
        borderColor: 'border-rose-500/20',
        fullClass: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
    },
    FUTURES: {
        label: '期貨',
        text: 'text-sky-400',
        bg: 'bg-sky-500/10',
        borderColor: 'border-sky-500/20',
        fullClass: 'text-sky-400 bg-sky-500/10 border-sky-500/20'
    },
    SUB: {
        label: '複委託',
        text: 'text-purple-400',
        bg: 'bg-purple-500/10',
        borderColor: 'border-purple-500/20',
        fullClass: 'text-purple-400 bg-purple-500/10 border-purple-500/20'
    }
} as const;

// 9 High-light Morandi Colors for Profit (Updated for higher contrast on dark bg)
export const PROFIT_PALETTE = [
    '#F0D080', // Champagne Gold (Brighter)
    '#FFB7B2', // Salmon Pink (More vibrant)
    '#E0C3FC', // Bright Lavender
    '#AED9E0', // Cyan Blue (Clearer)
    '#B5EAD7', // Mint Green (Pop)
    '#FFF59D', // Lemon Yellow
    '#FFCCBC', // Bright Peach
    '#FFAB91', // Vivid Orange
    '#E0E0E0'  // Bright Grey
];

// 9 Low-key Colors for Loss
export const LOSS_PALETTE = [
    '#2E4053', // Dark Blue Gray
    '#566573', // Iron Gray
    '#1C2833', // Midnight
    '#145A32', // Dark Emerald
    '#1B4F72', // Deep Navy
    '#641E16', // Dark Maroon
    '#4A235A', // Deep Purple
    '#424949', // Charcoal
    '#7B7D7D'  // Medium Gray
];

export const DEFAULT_PALETTE = PROFIT_PALETTE; // Fallback

export const TIME_RANGES = ['ALL', '1M', '3M', 'YTD', 'CUSTOM'] as const;
export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;

export const I18N = {
    zh: {
        stats: '總覽', journal: '日誌', logs: '記錄', settings: '設定',
        initialCapital: '初始資金', currentEquity: '總權益', newPeak: '創歷史新高',
        drawdown: '回撤', currentDD: '當前回撤', winRate: '勝率', profitFactor: '獲利因子',
        riskReward: '賺賠比', avgWin: '平均獲利', avgLoss: '平均虧損', maxDD: '最大回撤',
        sharpe: '夏普比率', expectancy: '期望值', strategies: '策略績效', strategyList: '策略標籤', mindsetList: '交易類型',
        addStrategy: '新增策略...', addMindset: '新增類型...', noData: '尚無數據', monthlyPnl: '本月損益',
        trades: '次', totalTrades: '交易筆數', addTrade: '新增交易', editTrade: '編輯交易', profit: '獲利', loss: '虧損',
        save: '儲存', update: '更新', notePlaceholder: '交易筆記 / 檢討...', uncategorized: '未分類',
        language: '語言 / Language', deleteTitle: '刪除交易', deleteConfirm: '確定要刪除這筆交易紀錄嗎？此動作無法復原。',
        trade_code_placeholder: '商品代號 (e.g. TXFB6)',
        trade_code_ph: '商品名稱或股號',
        trade_pnl_ph: '損益%數/點數',
        trade_qty_ph: '部位大小',
        trade_label_code: '商品',
        trade_label_pnl: '損益',
        trade_label_qty: '部位',
        cancel: '取消', delete: '刪除', allStrategies: '全部策略', allEmotions: '全部類型', selected: '已選',
        filterByStrategy: '策略篩選', selectStrategy: '選擇策略', strategyAnalysis: '策略分析', riskSettings: '風險管理',
        ddThreshold: '最大回撤閥值', ddWarning: '警戒區：閥值前 5%', danger: '危險', warning: '警戒',
        emptyStateTitle: '開啟您的交易傳奇', emptyStateDesc: '記錄第一筆交易，邁向穩定獲利之路。', mindset: '類型',
        currentStreak: '目前連勝', bestStreak: '最長連勝', netProfit: '淨利', riskStatus: '風控',
        time_all: '全期間', time_1m: '近一月', time_3m: '近一季', time_ytd: '今年', time_custom: '自訂',
        selectDateRange: '選擇日期區間', startDate: '起始日', endDate: '結束日', confirm: '確認', reset: '重置',
        dataManagement: '資料備份與還原',
        backupDownload: '匯出備份',
        backupImport: '匯入備份',
        cloudBackupSection: 'Google 雲端備份',
        googleSignIn: 'Google 登入',
        cloudBackup: '雲端備份',
        systemDiagnostics: '系統診斷與修復',
        backupCloud: '立即備份',
        importSuccess: '匯入成功！', importError: '匯入失敗，請檢查格式。',
        freq_daily: '日 (Daily)', freq_weekly: '周 (Weekly)', freq_monthly: '月 (Monthly)',
        freq_quarterly: '季 (Quarterly)', freq_yearly: '年 (Yearly)',
        status_newHigh: '創新高', status_safe: '安全', status_warning: '需注意', status_broken: '破MDD',
        portfolio: '歸屬帳戶', switchPortfolio: '切換帳戶', addPortfolio: '新增帳戶', managePortfolios: '帳戶設定',
        portfolioName: '帳戶名稱', selectAll: '全選', add: '新增',
        short_daily: '日', short_weekly: '周', short_monthly: '月', short_quarterly: '季', short_yearly: '年',
        preferences: '偏好設定', lossColor: '預設虧損色',
        strategyTip: '格式:「名稱_備註」（如：突破_早盤），底線後文字會自動變成備註。',
        mindsetTip: '分類交易類型有助績效剖析。',

        // Portfolio Selector Translations
        allAccounts: '全部帳戶',
        multiple: '多個帳戶',

        // Cloud Backup specific
        syncTitle: 'Google 雲端備份',
        syncDesc: '登入以啟用自動備份，確保資料安全',
        syncing: '備份中...',
        synced: '已備份至 Google Cloud',
        lastBackup: '最後備份',
        offline: '離線模式 (僅本地)',
        saving: '上傳中...',
        saved: '已儲存',
        syncError: '備份失敗',
        retry: '重試',

        loginWithGoogle: '使用 Google 登入並備份', loginWithApple: '使用 Apple 登入', logout: '登出帳號',
        migrateConfirm: '發現本地有未同步的資料，是否要將其上傳至雲端？',
        sort_date: '日期', sort_pnl_high: '獲利優先', sort_pnl_low: '虧損優先',
        dangerZone: '危險區域', resetAll: '重置所有資料', resetDesc: '此操作將永久刪除所有交易記錄與設定',
        resetConfirm: '警告：您確定要刪除所有資料嗎？此操作無法復原。',
        tagManagement: '標籤管理',
        risk_dd_desc: '當總淨值自高點回撤超過閥值時警告。',
        risk_streak_desc: '當連續虧損次數超過設定數值時警告。',
        maxLossStreak: '連續虧損次數',

        // Sync Conflict Modal
        syncConflictTitle: '發現資料差異',
        syncConflictDesc: '雲端與本機的資料不一致，請選擇處理方式：',
        useCloudOption: '使用雲端版本',
        useLocalOption: '覆蓋雲端',
        smartMergeOption: '智慧合併（推薦）',
        syncStats: '本機 {local} 筆 / 雲端 {cloud} 筆 / 重複 {dup} 筆',
        processing: '處理中...',

        // Import Conflict Modal
        importConflictTitle: '發現現有資料',
        importConflictDesc: '您目前的裝置上已有交易紀錄。直接匯入將會覆蓋現有資料。您希望合併資料還是完全覆蓋？',
        overwriteOption: '覆蓋 (Overwrite)',
        mergeImportOption: '合併 (Merge)',

        // Logs Filter
        filter_notes: '只顯示筆記',

        // New Stats
        daysSincePeak: '未創高天數',

        // Share Card Translations (Added)
        share_tradeResult: '交易戰績',
        share_performance: '帳戶績效',
        share_winRate: '勝率',
        share_trades: '交易筆數',
        share_pf: '獲利因子',
        share_result: '結果',
        share_win: '獲利',
        share_loss: '虧損',
        share_pnlTitle: '交易損益',
        share_displayAmount: '顯示: 金額',
        share_displayPercent: '顯示: %',
        share_displayHidden: '顯示: 隱藏',
        share_showDaily: '顯示日損益',
        share_hideDaily: '隱藏日損益',
        share_showChart: '顯示圖表',
        share_hideChart: '隱藏圖表',
        share_amountsHidden: '隱藏金額',
        share_amountsVisible: '顯示金額',
        share_chartOn: '顯示圖表',
        share_chartOff: '隱藏圖表',
        share_saveImage: '儲存圖片',
        share_generating: '生成中...'
    },
    en: {
        stats: 'Stats', journal: 'Journal', logs: 'Logs', settings: 'Settings',
        initialCapital: 'Initial Capital', currentEquity: 'Total Equity', newPeak: 'New High',
        drawdown: 'Drawdown', currentDD: 'Current DD', winRate: 'Win Rate', profitFactor: 'Profit Factor',
        riskReward: 'Risk/Reward', avgWin: 'Avg Win', avgLoss: 'Avg Loss', maxDD: 'Max Drawdown',
        sharpe: 'Sharpe Ratio', expectancy: 'Expectancy', strategies: 'Strategy Performance', strategyList: 'Strategies', mindsetList: 'Trade Types',
        addStrategy: 'Add Strategy...', addMindset: 'Add Type...', noData: 'No Data', monthlyPnl: 'Monthly PnL',
        trades: 'T', totalTrades: 'Total Trades', addTrade: 'Add Trade', editTrade: 'Edit Trade', profit: 'Profit', loss: 'Loss',
        save: 'Save', update: 'Update', notePlaceholder: 'Notes...', uncategorized: 'Uncategorized',
        language: 'Language', deleteTitle: 'Delete Trade', deleteConfirm: 'Are you sure you want to delete this trade? This cannot be undone.',
        trade_code_placeholder: 'Product Code (e.g. TXFB6)',
        trade_code_ph: 'Symbol / Code',
        trade_pnl_ph: 'PnL % / Pts',
        trade_qty_ph: 'Size',
        trade_label_code: 'Symbol',
        trade_label_pnl: 'PnL',
        trade_label_qty: 'Size',
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
        cloudBackupSection: 'Google Cloud Backup',
        googleSignIn: 'Sign in with Google',
        cloudBackup: 'Cloud Backup',
        systemDiagnostics: 'System Diagnostics',
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
        syncConflictTitle: 'Data Difference Detected',
        syncConflictDesc: 'Cloud and local data are different. Choose how to proceed:',
        useCloudOption: 'Use Cloud Version',
        useLocalOption: 'Use Local Version',
        smartMergeOption: 'Smart Merge (Recommended)',
        syncStats: 'Local: {local} / Cloud: {cloud} / Duplicates: {dup}',
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
        share_pnlTitle: 'Trade P&L',
        share_displayAmount: 'Show: Amount',
        share_displayPercent: 'Show: %',
        share_displayHidden: 'Show: Hidden',
        share_showDaily: 'Show daily P&L',
        share_hideDaily: 'Hide daily P&L',
        share_showChart: 'Show chart',
        share_hideChart: 'Hide chart',
        share_amountsHidden: 'Amounts Hidden',
        share_amountsVisible: 'Amounts Visible',
        share_chartOn: 'Chart On',
        share_chartOff: 'Chart Off',
        share_saveImage: 'Save Image',
        share_generating: 'Generating...'
    }
};
