
// [Manage] Last Updated: 2024-05-22
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
};

export const DEFAULT_PALETTE = [
    '#C8B085', '#526D82', '#D05A5A', '#8884d8', '#c97e59', '#1F618D', '#5DADE2', '#a3526d', '#E74C3C',
    '#5B9A8B', '#2C5F54', '#28573f' // Added Greens for selection
];

export const TIME_RANGES = ['ALL', '1M', '3M', 'YTD', 'CUSTOM'] as const;
export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;

export const I18N = {
    zh: {
        stats: '總覽', journal: '日誌', logs: '記錄', settings: '設定',
        initialCapital: '初始資金', currentEquity: '總權益', newPeak: '創歷史新高',
        drawdown: '回撤', currentDD: '當前回撤', winRate: '勝率', profitFactor: '獲利因子',
        riskReward: '賺賠比', avgWin: '平均獲利', avgLoss: '平均虧損', maxDD: '最大回撤',
        sharpe: '夏普比率', strategies: '策略績效', strategyList: '策略標籤', mindsetList: '交易類型',
        addStrategy: '新增策略...', addMindset: '新增類型...', noData: '尚無數據', monthlyPnl: '本月損益',
        trades: '筆', addTrade: '新增交易', editTrade: '編輯交易', profit: '獲利', loss: '虧損',
        save: '儲存', update: '更新', notePlaceholder: '交易筆記 / 檢討...', uncategorized: '未分類',
        language: '語言 / Language', deleteTitle: '刪除交易', deleteConfirm: '確定要刪除這筆交易紀錄嗎？此動作無法復原。',
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
        backupCloud: '立即備份',
        importSuccess: '匯入成功！', importError: '匯入失敗，請檢查格式。',
        freq_daily: '日 (Daily)', freq_weekly: '周 (Weekly)', freq_monthly: '月 (Monthly)',
        freq_quarterly: '季 (Quarterly)', freq_yearly: '年 (Yearly)',
        status_newHigh: '創新高', status_safe: '安全', status_warning: '需注意', status_broken: '破MDD',
        portfolio: '歸屬帳戶', switchPortfolio: '切換帳戶', addPortfolio: '新增帳戶', managePortfolios: '管理帳戶',
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
        syncConflictTitle: '發現資料衝突',
        syncConflictDesc: '我們發現您的裝置上有未同步的本地資料。請問您希望如何處理？',
        mergeOption: '合併並備份',
        mergeDesc: '推薦。保留本地資料並上傳至雲端。',
        discardOption: '捨棄本地資料',
        discardDesc: '僅保留雲端上的舊資料，本地新資料將被刪除。',
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
    }
};
