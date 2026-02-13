import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useEffect } from 'react';
import { db } from '../db';
import { Trade, Portfolio } from '../types';
import { THEME } from '../constants';
import { useLocalStorage } from './useLocalStorage';
import { migrateFromLocalStorage, needsMigration } from '../utils/migration';

const INITIAL_PORTFOLIO: Portfolio = { 
  id: 'main', 
  name: 'Main Account', 
  initialCapital: 100000, 
  profitColor: THEME.RED, 
  lossColor: THEME.DEFAULT_LOSS 
};

export const useIndexedDBData = () => {
  // 自動執行遷移（僅第一次）
  useEffect(() => {
    if (needsMigration()) {
      console.log('⚠️  偵測到 localStorage 資料，開始自動遷移...');
      migrateFromLocalStorage().then(result => {
        if (result.success) {
          console.log('✅ 自動遷移完成');
        }
      });
    }
  }, []);

  // 使用 Dexie 的 useLiveQuery 自動訂閱資料變更
  const trades = useLiveQuery(() => db.trades.toArray(), []) || [];
  const portfolios = useLiveQuery(() => db.portfolios.toArray(), []) || [];
  
  const strategies = useLiveQuery(
    () => db.strategies.toArray().then(arr => arr.map(s => s.name)),
    [],
    ['動能突破', '急殺抄底', '波段趨勢'] // 預設值
  );
  
  const emotions = useLiveQuery(
    () => db.emotions.toArray().then(arr => arr.map(e => e.name)),
    [],
    ['短線', '事件', '產業', '波段'] // 預設值
  );

  // UI 偏好設定仍使用 localStorage
  const [activePortfolioIds, setActivePortfolioIds] = useLocalStorage<string[]>('active_portfolio_ids', ['main']);
  const [lossColor, setLossColor] = useLocalStorage('loss_color', THEME.DEFAULT_LOSS);

  // 初始化預設帳戶組合
  useEffect(() => {
    db.portfolios.count().then(count => {
      if (count === 0) {
        db.portfolios.add(INITIAL_PORTFOLIO);
      }
    });
  }, []);

  // 初始化預設策略
  useEffect(() => {
    db.strategies.count().then(count => {
      if (count === 0) {
        const defaultStrategies = ['動能突破', '急殺抄底', '波段趨勢'];
        db.strategies.bulkAdd(defaultStrategies.map(name => ({ name })));
      }
    });
  }, []);

  // 初始化預設情緒
  useEffect(() => {
    db.emotions.count().then(count => {
      if (count === 0) {
        const defaultEmotions = ['短線', '事件', '產業', '波段'];
        db.emotions.bulkAdd(defaultEmotions.map(name => ({ name })));
      }
    });
  }, []);

  const actions = useMemo(() => ({
    saveTrade: async (trade: Trade, editingId: string | null) => {
      if (editingId) {
        await db.trades.update(editingId, trade);
      } else {
        const newTrade = { 
          ...trade, 
          id: `trade-${Date.now()}`,
          timestamp: new Date().toISOString() 
        };
        await db.trades.add(newTrade);
      }
    },

    saveTrades: async (trades: Omit<Trade, 'id' | 'timestamp'>[]) => {
      const now = Date.now();
      const newTrades = trades.map((t, index) => ({
        ...t,
        id: `trade-${now}-${index}`,
        timestamp: new Date().toISOString()
      }));
      await db.trades.bulkAdd(newTrades as Trade[]);
    },

    deleteTrade: async (id: string) => {
      await db.trades.delete(id);
    },

    updatePortfolio: async (id: string, key: keyof Portfolio, value: any) => {
      await db.portfolios.update(id, { [key]: value });
    },

    updateSettings: async (key: string, value: any) => {
      if (key === 'portfolios') {
        const newPortfolios = value as Portfolio[];
        // 先清空再批量新增
        await db.portfolios.clear();
        await db.portfolios.bulkAdd(newPortfolios);
      }
    },

    addPortfolio: async (p: Portfolio) => {
      await db.portfolios.add(p);
    },

    deletePortfolio: async (id: string) => {
      await db.portfolios.delete(id);
    },

    addStrategy: async (s: string) => {
      try {
        await db.strategies.add({ name: s });
      } catch (error) {
        // 忽略重複錯誤（unique constraint)
        console.debug('Strategy already exists:', s);
      }
    },

    addEmotion: async (e: string) => {
      try {
        await db.emotions.add({ name: e });
      } catch (error) {
        console.debug('Emotion already exists:', e);
      }
    },

    deleteStrategy: async (s: string) => {
      const record = await db.strategies.where('name').equals(s).first();
      if (record?.id) {
        await db.strategies.delete(record.id);
      }
    },

    deleteEmotion: async (e: string) => {
      const record = await db.emotions.where('name').equals(e).first();
      if (record?.id) {
        await db.emotions.delete(record.id);
      }
    },

    clearLocalData: async () => {
      await db.trades.clear();
      await db.portfolios.clear();
      await db.strategies.clear();
      await db.emotions.clear();
      
      // 重新初始化預設資料
      await db.portfolios.add(INITIAL_PORTFOLIO);
      await db.strategies.bulkAdd(['動能突破', '急殺抄底', '波段趨勢'].map(name => ({ name })));
      await db.emotions.bulkAdd(['短線', '事件', '產業', '波段'].map(name => ({ name})));
      
      console.log('✅ 已清除所有 IndexedDB 資料並重新初始化');
    },

    downloadBackup: () => {
      console.warn('⚠️  downloadBackup 功能需要額外實作');
      // TODO: 實作 IndexedDB 資料匯出
    },

    // 暴露 setters 供 Sync/Import 邏輯使用
    setTrades: async (trades: Trade[]) => {
      await db.trades.clear();
      await db.trades.bulkAdd(trades);
    },
    
    setStrategies: async (strategies: string[]) => {
      await db.strategies.clear();
      await db.strategies.bulkAdd(strategies.map(name => ({ name })));
    },
    
    setEmotions: async (emotions: string[]) => {
      await db.emotions.clear();
      await db.emotions.bulkAdd(emotions.map(name => ({ name })));
    },
    
    setPortfolios: async (portfolios: Portfolio[]) => {
      await db.portfolios.clear();
      await db.portfolios.bulkAdd(portfolios);
    },
  }), []);

  return {
    trades,
    portfolios,
    strategies: strategies || [],
    emotions: emotions || [],
    activePortfolioIds,
    setActivePortfolioIds,
    lossColor,
    setLossColor,
    actions,
    // 仍需保留的 setters (for Sync功能)
    setTrades: actions.setTrades,
    setStrategies: actions.setStrategies,
    setEmotions: actions.setEmotions,
    setPortfolios: actions.setPortfolios
  };
};
