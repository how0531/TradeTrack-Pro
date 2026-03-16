import { Translation } from '../types';

export const zh: Translation = {
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
    share_amountsHidden: '隱藏金額',
    share_amountsVisible: '顯示金額',
    share_chartOn: '顯示圖表',
    share_chartOff: '隱藏圖表',
    share_saveImage: '儲存圖片',
    share_generating: '生成中...'
};
