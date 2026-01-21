
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
];

export const TIME_RANGES = ['ALL', '1M', '3M', 'YTD', 'CUSTOM'] as const;
export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;

export const I18N = {
    zh: {
        stats: '總覽', journal: '日誌', logs: '記錄', settings: '設定',
        initialCapital: '初始資金', currentEquity: '總權益', newPeak: '創歷史新高',
        drawdown: '回撤', currentDD: '當前回撤', winRate: '勝率', profitFactor: '獲利因子',
        riskReward: '賺賠比', avgWin: '平均獲利', avgLoss: '平均虧損', maxDD: '最大回撤',
        sharpe: '夏普比率', strategies: '策略績效', strategyList: '策略標籤', mindsetList: '心態標籤',
        addStrategy: '新增策略...', addMindset: '新增心態...', noData: '尚無數據', monthlyPnl: '本月損益',
        trades: '筆', addTrade: '新增交易', editTrade: '編輯交易', profit: '獲利', loss: '虧損',
        save: '儲存', update: '更新', notePlaceholder: '交易筆記 / 檢討...', uncategorized: '未分類',
        language: '語言 / Language', deleteTitle: '刪除交易', deleteConfirm: '確定要刪除這筆交易紀錄嗎？此動作無法復原。',
        cancel: '取消', delete: '刪除', allStrategies: '全部策略', allEmotions: '全部心態', selected: '已選',
        filterByStrategy: '策略篩選', selectStrategy: '選擇策略', strategyAnalysis: '策略分析', riskSettings: '風險管理設定',
        ddThreshold: '當前DD風控閥值', ddWarning: '警戒區：閥值前 5%', danger: '危險', warning: '警戒',
        emptyStateTitle: '開啟您的交易傳奇', emptyStateDesc: '記錄第一筆交易，邁向穩定獲利之路。', mindset: '當下心態',
        currentStreak: '目前連勝', bestStreak: '最長連勝', netProfit: '淨利', riskStatus: '風控',
        time_all: '全期間', time_1m: '近一月', time_3m: '近一季', time_ytd: '今年', time_custom: '自訂',
        selectDateRange: '選擇日期區間', startDate: '起始日', endDate: '結束日', confirm: '確認', reset: '重置',
        dataManagement: '數據管理', exportCSV: '匯出 CSV', importCSV: '匯入 CSV',
        importSuccess: '匯入成功！', importError: '匯入失敗，請檢查格式。',
        freq_daily: '日 (Daily)', freq_weekly: '周 (Weekly)', freq_monthly: '月 (Monthly)',
        freq_quarterly: '季 (Quarterly)', freq_yearly: '年 (Yearly)',
        status_newHigh: '創新高', status_safe: '安全', status_warning: '需注意', status_broken: '破MDD',
        portfolio: '歸屬帳戶', switchPortfolio: '切換帳戶', addPortfolio: '新增帳戶', managePortfolios: '管理帳戶',
        portfolioName: '帳戶名稱', selectAll: '全選', add: '新增',
        short_daily: '日', short_weekly: '周', short_monthly: '月', short_quarterly: '季', short_yearly: '年',
        appearance: '外觀設定', lossColor: '虧損顏色',
        syncTitle: '雲端同步', syncDesc: '登入以將資料備份至 Google 雲端', 
        syncing: '正在同步...', synced: '已同步', offline: '離線模式',
        loginWithGoogle: '使用 Google 登入', loginWithApple: '使用 Apple 登入', logout: '登出帳號',
        migrateConfirm: '發現本地有未同步的資料，是否要將其上傳至雲端？'
    },
    en: {
        stats: 'Stats', journal: 'Journal', logs: 'Logs', settings: 'Settings',
        initialCapital: 'Initial Capital', currentEquity: 'Total Equity', newPeak: 'New High',
        drawdown: 'Drawdown', currentDD: 'Current DD', winRate: 'Win Rate', profitFactor: 'Profit Factor',
        riskReward: 'Risk/Reward', avgWin: 'Avg Win', avgLoss: 'Avg Loss', maxDD: 'Max Drawdown',
        sharpe: 'Sharpe Ratio', strategies: 'Strategy Performance', strategyList: 'Strategies', mindsetList: 'Mindset Tags',
        addStrategy: 'Add Strategy...', addMindset: 'Add Mindset...', noData: 'No Data', monthlyPnl: 'Monthly PnL',
        trades: 'T', addTrade: 'Add Trade', editTrade: 'Edit Trade', profit: 'Profit', loss: 'Loss',
        save: 'Save', update: 'Update', notePlaceholder: 'Notes...', uncategorized: 'Uncategorized',
        language: 'Language', deleteTitle: 'Delete Trade', deleteConfirm: 'Are you sure you want to delete this trade? This cannot be undone.',
        cancel: 'Cancel', delete: 'Delete', allStrategies: 'All Strategies', allEmotions: 'All Mindsets', selected: 'Selected',
        filterByStrategy: 'Filter by Strategy', selectStrategy: 'Select Strategy', strategyAnalysis: 'Strategy Analysis', riskSettings: 'Risk Management',
        ddThreshold: 'Drawdown Limit', ddWarning: 'Warning Zone: 5% left', danger: 'Danger', warning: 'Warning',
        emptyStateTitle: 'Start Your Trading Legacy', emptyStateDesc: 'Log your first trade and pave the way to consistent profits.', mindset: 'Mindset',
        currentStreak: 'Current Streak', bestStreak: 'Best Streak', netProfit: 'Net Profit', riskStatus: 'Risk Status',
        time_all: 'All Time', time_1m: 'Last Month', time_3m: 'Last Quarter', time_ytd: 'YTD', time_custom: 'Custom',
        selectDateRange: 'Select Date Range', startDate: 'Start Date', endDate: 'End Date', confirm: 'Confirm', reset: 'Reset',
        dataManagement: 'Data Management', exportCSV: 'Export CSV', importCSV: 'Import CSV',
        importSuccess: 'Import Successful!', importError: 'Import Failed. Check format.',
        freq_daily: 'Daily', freq_weekly: 'Weekly', freq_monthly: 'Monthly',
        freq_quarterly: 'Quarterly', freq_yearly: 'Yearly',
        status_newHigh: 'New High', status_safe: 'Safe', status_warning: 'Caution', status_broken: 'Broken',
        portfolio: 'Account', switchPortfolio: 'Switch Portfolio', addPortfolio: 'Add Portfolio', managePortfolios: 'Manage Portfolios',
        portfolioName: 'Account Name', selectAll: 'Select All', add: 'Add',
        short_daily: 'D', short_weekly: 'W', short_monthly: 'M', short_quarterly: 'Q', short_yearly: 'Y',
        appearance: 'Appearance', lossColor: 'Loss Color',
        syncTitle: 'Cloud Sync', syncDesc: 'Sign in to backup your data to Google Cloud',
        syncing: 'Syncing...', synced: 'Synced', offline: 'Offline Mode',
        loginWithGoogle: 'Login with Google', loginWithApple: 'Sign in with Apple', logout: 'Logout',
        migrateConfirm: 'Found local data. Would you like to sync it to the cloud?'
    }
};
