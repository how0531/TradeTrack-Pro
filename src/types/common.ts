/**
 * 應用程式通用型別定義
 */

export interface AppConfig {
  appId: string;
}

export interface User {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export type TimeRange = 'ALL' | '1M' | '3M' | 'YTD' | 'CUSTOM';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type Lang = 'zh' | 'en';
export type ViewMode = 'stats' | 'calendar' | 'logs' | 'settings';
export type SyncStatus = 'synced' | 'saving' | 'error' | 'offline';
