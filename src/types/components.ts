/**
 * React 組件 Props 型別定義
 */

import React from 'react';
import type { Trade, Metrics, Portfolio, Streaks, MonthlyStats } from './trade';
import type { Lang, Frequency } from './common';
import type { User } from './common';

export interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: Trade;
  setForm: (t: Trade) => void;
  onSubmit: (e: React.FormEvent) => void;
  isEditing: boolean;
  // Context provided: strategies, emotions, portfolios, lang, metrics
}

export interface StrategyDetailModalProps {
  strategy: string | null;
  metrics: Metrics | null;
  onClose: () => void;
  lang: Lang;
  hideAmounts: boolean;
  ddThreshold: number;
}

export interface SettingsViewProps {
  lang: Lang;
  setLang: (l: Lang) => void;
  trades: Trade[];
  actions: any;
  ddThreshold: number;
  setDdThreshold: (v: number) => void;
  maxLossStreak: number;
  setMaxLossStreak: (v: number) => void;
  lossColor: string;
  setLossColor: (c: string) => void;
  strategies: string[];
  emotions: string[];
  portfolios: Portfolio[];
  activePortfolioIds: string[];
  setActivePortfolioIds: (ids: string[]) => void;
  onBack: () => void;
  currentUser: User | null;
  onLogin: () => void;
  onLogout: () => void;
  lastBackupTime?: Date | null;
  isImportModalOpen?: boolean;
}

export interface LogsViewProps {
  trades: Trade[];
  lang: Lang;
  hideAmounts: boolean;
  portfolios: Portfolio[];
  onEdit: (t: Trade) => void;
  onDelete: (id: string) => void;
}

export interface CalendarViewProps {
  dailyPnlMap: Record<string, number>;
  currentMonth: Date;
  setCurrentMonth: (d: Date) => void;
  onDateClick: (date: string) => void;
  monthlyStats: MonthlyStats;
  hideAmounts: boolean;
  lang: Lang;
  streaks: Streaks;
  strategies: string[];
  emotions: string[];
  filterStrategy: string[];
  setFilterStrategy: (s: string[]) => void;
  filterEmotion: string[];
  setFilterEmotion: (e: string[]) => void;
}

export interface StatsChartProps {
  metrics: Metrics;
  portfolios: Portfolio[];
  activePortfolioIds: string[];
  frequency: Frequency;
  lang: Lang;
  hideAmounts: boolean;
  chartHeight: number;
  setChartHeight: (h: number) => void;
  onZoom?: (start: string, end: string) => void;
  showPurePnl?: boolean;
}
