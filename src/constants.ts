
// [Manage] Last Updated: 2024-05-22
import { Translation, Lang } from './types';

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

export const DEFAULT_PALETTE = [
    '#C8B085', '#526D82', '#D05A5A', '#8884d8', '#c97e59', '#1F618D', '#5DADE2', '#a3526d', '#E74C3C',
    '#5B9A8B', '#2C5F54', '#28573f' // Added Greens for selection
];

export const TIME_RANGES = ['ALL', '1M', '3M', 'YTD', 'CUSTOM'] as const;
export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;

import { zh } from './locales/zh';
import { en } from './locales/en';
    zh: {
        stats: 'ç¸½è¦½', journal: '?¥è?', logs: 'è¨˜é?', settings: 'è¨­å?',
        initialCapital: '?å?è³‡é?', currentEquity: 'ç¸½æ???, newPeak: '?µæ­·?²æ–°é«?,
        drawdown: '?æ’¤', currentDD: '?¶å??æ’¤', winRate: '?ç?', profitFactor: '?²åˆ©? å?',
        riskReward: 'è³ºè?æ¯?, avgWin: 'å¹³å??²åˆ©', avgLoss: 'å¹³å??§æ?', maxDD: '?€å¤§å???,
        sharpe: 'å¤æ™®æ¯”ç?', strategies: 'ç­–ç•¥ç¸¾æ?', strategyList: 'ç­–ç•¥æ¨™ç±¤', mindsetList: 'äº¤æ?é¡å?',
        addStrategy: '?°å?ç­–ç•¥...', addMindset: '?°å?é¡å?...', noData: 'å°šç„¡?¸æ?', monthlyPnl: '?¬æ??ç?',
        trades: 'ç­?, addTrade: '?°å?äº¤æ?', editTrade: 'ç·¨è¼¯äº¤æ?', profit: '?²åˆ©', loss: '?§æ?',
        save: '?²å?', update: '?´æ–°', notePlaceholder: 'äº¤æ?ç­†è? / æª¢è?...', uncategorized: '?ªå?é¡?,
        language: 'èªè? / Language', deleteTitle: '?ªé™¤äº¤æ?', deleteConfirm: 'ç¢ºå?è¦åˆª?¤é€™ç?äº¤æ?ç´€?„å?ï¼Ÿæ­¤?•ä??¡æ?å¾©å???,
        cancel: '?–æ?', delete: '?ªé™¤', allStrategies: '?¨éƒ¨ç­–ç•¥', allEmotions: '?¨éƒ¨é¡å?', selected: 'å·²é¸',
        filterByStrategy: 'ç­–ç•¥ç¯©é¸', selectStrategy: '?¸æ?ç­–ç•¥', strategyAnalysis: 'ç­–ç•¥?†æ?', riskSettings: 'é¢¨éšªç®¡ç?',
        ddThreshold: '?€å¤§å??¤é–¥??, ddWarning: 'è­¦æ??€ï¼šé–¥?¼å? 5%', danger: '?±éšª', warning: 'è­¦æ?',
        emptyStateTitle: '?‹å??¨ç?äº¤æ??³å?', emptyStateDesc: 'è¨˜é?ç¬¬ä?ç­†äº¤?“ï??å?ç©©å??²åˆ©ä¹‹è·¯??, mindset: 'é¡å?',
        currentStreak: '?®å????', bestStreak: '?€?·é€??', netProfit: 'æ·¨åˆ©', riskStatus: 'é¢¨æ§',
        time_all: '?¨æ???, time_1m: 'è¿‘ä???, time_3m: 'è¿‘ä?å­?, time_ytd: 'ä»Šå¹´', time_custom: '?ªè?',
        selectDateRange: '?¸æ??¥æ??€??, startDate: 'èµ·å???, endDate: 'çµæ???, confirm: 'ç¢ºè?', reset: '?ç½®',
        dataManagement: 'è³‡æ??™ä»½?‡é???, 
        backupDownload: '?¯å‡º?™ä»½', 
        backupImport: '?¯å…¥?™ä»½',
        backupCloud: 'ç«‹å³?™ä»½',
        importSuccess: '?¯å…¥?å?ï¼?, importError: '?¯å…¥å¤±æ?ï¼Œè?æª¢æŸ¥?¼å???,
        freq_daily: '??(Daily)', freq_weekly: '??(Weekly)', freq_monthly: '??(Monthly)',
        freq_quarterly: 'å­?(Quarterly)', freq_yearly: 'å¹?(Yearly)',
        status_newHigh: '?µæ–°é«?, status_safe: 'å®‰å…¨', status_warning: '?€æ³¨æ?', status_broken: '?´MDD',
        portfolio: 'æ­¸å±¬å¸³æˆ¶', switchPortfolio: '?‡æ?å¸³æˆ¶', addPortfolio: '?°å?å¸³æˆ¶', managePortfolios: 'ç®¡ç?å¸³æˆ¶',
        portfolioName: 'å¸³æˆ¶?ç¨±', selectAll: '?¨é¸', add: '?°å?',
        short_daily: '??, short_weekly: '??, short_monthly: '??, short_quarterly: 'å­?, short_yearly: 'å¹?,
        preferences: '?å¥½è¨­å?', lossColor: '?è¨­?§æ???,
        strategyTip: '?¼å?:?Œå?ç¨±_?™è¨»?ï?å¦‚ï?çªç ´_?©ç›¤ï¼‰ï?åº•ç?å¾Œæ?å­—æ??ªå?è®Šæ??™è¨»??,
        mindsetTip: '?†é?äº¤æ?é¡å??‰åŠ©ç¸¾æ??–æ???,
        
        // Portfolio Selector Translations
        allAccounts: '?¨éƒ¨å¸³æˆ¶',
        multiple: 'å¤šå€‹å¸³??,
        
        // Cloud Backup specific
        syncTitle: 'Google ?²ç«¯?™ä»½', 
        syncDesc: '?»å…¥ä»¥å??¨è‡ª?•å?ä»½ï?ç¢ºä?è³‡æ?å®‰å…¨', 
        syncing: '?™ä»½ä¸?..', 
        synced: 'å·²å?ä»½è‡³ Google Cloud', 
        lastBackup: '?€å¾Œå?ä»?,
        offline: '?¢ç?æ¨¡å? (?…æœ¬??', 
        saving: 'ä¸Šå‚³ä¸?..', 
        saved: 'å·²å„²å­?, 
        syncError: '?™ä»½å¤±æ?', 
        retry: '?è©¦',
        
        loginWithGoogle: 'ä½¿ç”¨ Google ?»å…¥ä¸¦å?ä»?, loginWithApple: 'ä½¿ç”¨ Apple ?»å…¥', logout: '?»å‡ºå¸³è?',
        migrateConfirm: '?¼ç¾?¬åœ°?‰æœª?Œæ­¥?„è??™ï??¯å¦è¦å??¶ä??³è‡³?²ç«¯ï¼?,
        sort_date: '?¥æ?', sort_pnl_high: '?²åˆ©?ªå?', sort_pnl_low: '?§æ??ªå?',
        dangerZone: '?±éšª?€??, resetAll: '?ç½®?€?‰è???, resetDesc: 'æ­¤æ?ä½œå?æ°¸ä??ªé™¤?€?‰äº¤?“è??„è?è¨­å?',
        resetConfirm: 'è­¦å?ï¼šæ‚¨ç¢ºå?è¦åˆª?¤æ??‰è??™å?ï¼Ÿæ­¤?ä??¡æ?å¾©å???,
        tagManagement: 'æ¨™ç±¤ç®¡ç?',
        risk_dd_desc: '?¶ç¸½æ·¨å€¼è‡ªé«˜é??æ’¤è¶…é??¥å€¼æ?è­¦å???,
        risk_streak_desc: '?¶é€???§æ?æ¬¡æ•¸è¶…é?è¨­å??¸å€¼æ?è­¦å???,
        maxLossStreak: '????§æ?æ¬¡æ•¸',
        
        // Sync Conflict Modal
        syncConflictTitle: '?¼ç¾è³‡æ?è¡ç?',
        syncConflictDesc: '?‘å€‘ç™¼?¾æ‚¨?„è?ç½®ä??‰æœª?Œæ­¥?„æœ¬?°è??™ã€‚è??æ‚¨å¸Œæ?å¦‚ä??•ç?ï¼?,
        mergeOption: '?ˆä½µä¸¦å?ä»?,
        mergeDesc: '?¨è–¦?‚ä??™æœ¬?°è??™ä¸¦ä¸Šå‚³?³é›²ç«¯ã€?,
        discardOption: '?¨æ??¬åœ°è³‡æ?',
        discardDesc: '?…ä??™é›²ç«¯ä??„è?è³‡æ?ï¼Œæœ¬?°æ–°è³‡æ?å°‡è¢«?ªé™¤??,
        processing: '?•ç?ä¸?..',

export const I18N: Record<Lang, Translation> = {
    zh,
    en
};
