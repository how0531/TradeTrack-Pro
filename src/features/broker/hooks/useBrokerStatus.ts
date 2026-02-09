/**
 * 券商後端狀態監控 Hook
 * 
 * 用途：封裝後端健康檢查與喚醒邏輯
 */

import { useState, useEffect, useCallback } from 'react';
import type { BackendStatus } from '../../../types/broker';
import { validateBackendStatus, wakeUpBackend } from '../../../services/brokerService';
import { logger } from '../../../utils/logger';

interface UseBrokerStatusOptions {
  autoCheck?: boolean;  // 是否自動檢查
  checkInterval?: number; // 檢查間隔(ms)
}

export function useBrokerStatus(options: UseBrokerStatusOptions = {}) {
  const { autoCheck = false, checkInterval = 30000 } = options;
  
  const [status, setStatus] = useState<BackendStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  /**
   * 檢查後端狀態
   */
  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    logger.debug('[useBrokerStatus] Checking backend status...');
    
    try {
      const newStatus = await validateBackendStatus();
      setStatus(newStatus);
      setLastChecked(new Date());
      logger.success(`[useBrokerStatus] Status: ${newStatus}`);
    } catch (error) {
      logger.error('[useBrokerStatus] Status check failed', error);
      setStatus('offline');
    } finally {
      setIsChecking(false);
    }
  }, []);

  /**
   * 喚醒後端
   */
  const wakeUp = useCallback(async () => {
    logger.info('[useBrokerStatus] Waking up backend...');
    setStatus('checking');
    
    const result = await wakeUpBackend();
    
    if (result.success) {
      await checkStatus();
    } else {
      logger.error('[useBrokerStatus] Wake up failed', result.error);
      setStatus('offline');
    }
    
    return result;
  }, [checkStatus]);

  /**
   * 自動定期檢查
   */
  useEffect(() => {
    if (!autoCheck) return;

    checkStatus();
    const interval = setInterval(checkStatus, checkInterval);

    return () => clearInterval(interval);
  }, [autoCheck, checkInterval, checkStatus]);

  return {
    status,
    lastChecked,
    isChecking,
    checkStatus,
    wakeUp,
  };
}
