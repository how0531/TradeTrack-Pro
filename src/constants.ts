
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

export const I18N: Record<Lang, Translation> = {
    zh,
    en
};
