/**
 * 統一型別匯出
 * 
 * 用途：集中管理所有型別定義，提供單一匯入點
 * 
 * 使用範例：
 * import { Trade, BrokerConfig, Lang } from '@/types';
 */

// 券商相關
export * from './broker';

// 交易相關
export * from './trade';

// 通用型別
export * from './common';

// 多語言
export * from './i18n';

// 組件 Props
export * from './components';
