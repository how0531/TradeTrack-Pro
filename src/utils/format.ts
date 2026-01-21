// [Manage] Last Updated: 2024-05-22
import { Lang, Frequency } from '../types';
import { THEME } from '../constants';

export const formatDecimal = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0.00';
    return Number(val).toFixed(2);
};

export const formatCurrency = (val: number | undefined | null, hideAmounts = false) => {
    if (hideAmounts) return '****';
    if (val === undefined || val === null || isNaN(val)) return '0';
    try {
        // Changed style from 'currency' to 'decimal' to remove the $ symbol
        return new Intl.NumberFormat('en-US', { 
            style: 'decimal', 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
        }).format(val);
    } catch (e) {
        return String(val);
    }
};

export const formatPnlK = (val: number, hideAmounts = false) => {
    if (hideAmounts) return '****';
    if (isNaN(val)) return '0';
    if (Math.abs(val) < 10000) return formatCurrency(val, false);
    return `${val >= 0 ? '+' : ''}${(val / 1000).toFixed(1)}K`;
};

// NEW: Global Compact Number Formatter (Taiwanese Logic: 萬/億)
export const formatCompactNumber = (val: number | undefined | null, forceSign = false) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    if (val === 0) return '0';
    
    const abs = Math.abs(val);
    const prefix = forceSign ? (val > 0 ? '+' : '-') : (val < 0 ? '-' : '');

    // Rule 1: < 10,000 -> Original number (with commas for readability)
    if (abs < 10000) {
        const formatted = new Intl.NumberFormat('en-US', {
            maximumFractionDigits: 2
        }).format(abs);
        return `${prefix}${formatted}`;
    }
    
    // Rule 2: 10,000 - 99,999,999 -> Wan (萬)
    if (abs < 100000000) {
        return `${prefix}${parseFloat((abs / 10000).toFixed(2))}萬`;
    }

    // Rule 3: >= 100,000,000 -> Yi (億)
    return `${prefix}${parseFloat((abs / 100000000).toFixed(2))}億`;
};

export const formatDate = (d: string | Date, lang: Lang = 'zh') => {
    if (!d || d === 'Start' || d === 'Initial') return lang === 'zh' ? '起點' : 'Start';
    try {
        if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, day] = d.split('-');
            return `${m}/${day}`;
        }
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return String(d); 
        return dateObj.toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { month: 'numeric', day: 'numeric' });
    } catch (e) {
        return String(d);
    }
};

// NEW: Chart Axis Formatter
export const formatChartAxisDate = (timestamp: number, freq: Frequency) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    const yyyy = date.getFullYear();
    const yy = String(yyyy).slice(-2);
    const mm = date.getMonth() + 1;
    const dd = date.getDate();

    switch (freq) {
        case 'yearly':
            return String(yyyy);
        case 'quarterly':
            const q = Math.ceil(mm / 3);
            return `${yy}Q${q}`;
        case 'monthly':
            return `${yy}/${String(mm).padStart(2, '0')}`;
        case 'weekly':
            return `${String(mm).padStart(2, '0')}/${String(dd).padStart(2, '0')}`;
        case 'daily':
        default:
            return `${String(mm).padStart(2, '0')}/${String(dd).padStart(2, '0')}`;
    }
};

export const getPnlColor = (val: number) => val >= 0 ? THEME.RED : THEME.LOSS_WHITE;

export const getLocalDateStr = (dateObj = new Date()) => {
    if (isNaN(dateObj.getTime())) {
        dateObj = new Date();
    }
    const offset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - offset).toISOString().split('T')[0];
};