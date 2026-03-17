/**
 * backendGateway.ts
 *
 * 統一後端 API 閘道 (Unified Backend Gateway)
 *
 * 所有後端 API 請求都透過此閘道，提供：
 *   1. 自動重試：fetch 失敗時自動重試 (含指數退避)
 *   2. 自動喚醒：遇到 502/503 時，自動喚醒後端再重試
 *   3. 統一超時：預設 30s timeout，可自訂
 *   4. 狀態追蹤：全局追蹤後端是否就緒
 *   5. Pre-emptive Keep-Alive：App 載入時背景預先喚醒
 */

// ─── API Base Config ───

const getApiBase = (): string => {
  const env = (import.meta as any).env;
  if (env?.VITE_API_URL && env.VITE_API_URL.startsWith('http')) {
    return env.VITE_API_URL;
  }
  if (env?.VITE_API_HOST) {
    return `https://${env.VITE_API_HOST}`;
  }
  return '';
};

export const API_BASE = getApiBase();

// ─── Types ───

export type BackendGatewayStatus = 'unknown' | 'waking' | 'online' | 'offline';

interface BackendFetchOptions extends Omit<RequestInit, 'signal'> {
  /** 超時毫秒數，預設 30000 (30s) */
  timeout?: number;
  /** 最大重試次數，預設 2 */
  maxRetries?: number;
  /** 是否在 502/503 時自動喚醒後端，預設 true */
  autoWake?: boolean;
  /** 進度回報 */
  onProgress?: (msg: string) => void;
}

interface BackendFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  raw?: string;
}

// ─── 全局狀態 ───

let _status: BackendGatewayStatus = 'unknown';
let _wakePromise: Promise<boolean> | null = null;
const _listeners: Set<(status: BackendGatewayStatus) => void> = new Set();

const setStatus = (s: BackendGatewayStatus) => {
  if (_status === s) return;
  _status = s;
  _listeners.forEach(fn => fn(s));
};

/** 訂閱後端狀態變化，返回 unsubscribe 函式 */
export const onBackendStatusChange = (fn: (status: BackendGatewayStatus) => void) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};

/** 取得目前後端狀態 */
export const getBackendStatus = () => _status;

// ─── 核心：健康檢查 ───

const healthCheck = async (timeoutMs = 8000): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${API_BASE}/health`, {
      signal: controller.signal,
      cache: 'no-cache',
    });
    clearTimeout(tid);
    return res.ok;
  } catch {
    return false;
  }
};

// ─── 核心：喚醒後端（Singleton — 同一時間只有一個喚醒流程） ───

const doWakeUp = async (onProgress?: (msg: string) => void): Promise<boolean> => {
  // 如果已有喚醒流程 → 等待結果而非重複喚醒
  if (_wakePromise) {
    return _wakePromise;
  }

  setStatus('waking');
  _wakePromise = (async () => {
    const MAX = 15;  // 15 x 6s = 90s
    const INTERVAL = 6000;

    for (let i = 1; i <= MAX; i++) {
      onProgress?.(`正在喚醒後端... (${i}/${MAX})`);
      const alive = await healthCheck(5000);
      if (alive) {
        setStatus('online');
        _wakePromise = null;
        return true;
      }
      if (i < MAX) {
        await new Promise(r => setTimeout(r, INTERVAL));
      }
    }

    setStatus('offline');
    _wakePromise = null;
    return false;
  })();

  return _wakePromise;
};

// ─── Pre-emptive Keep-Alive（App 載入時呼叫）───

let _preemptiveDone = false;

/**
 * 在 App 載入時呼叫一次。
 * 背景發一次 health check，若後端休眠則自動喚醒，不 block UI。
 */
export const preemptiveWake = () => {
  if (_preemptiveDone) return;
  _preemptiveDone = true;

  // 完全不 block — fire and forget
  healthCheck(6000).then(alive => {
    if (alive) {
      setStatus('online');
    } else {
      // 後端沒回應 → 背景喚醒
      console.log('[Gateway] Pre-emptive wake: backend not ready, waking in background...');
      doWakeUp();
    }
  });
};

// ─── 主要 API：backendFetch ───

/**
 * 統一後端 fetch 閘道。
 *
 * 自動處理：
 *  - 超時控制
 *  - 502/503 自動喚醒 + 重試
 *  - 網路斷線重試
 *  - 錯誤分類成友善訊息
 */
export const backendFetch = async <T = any>(
  path: string,
  options: BackendFetchOptions = {}
): Promise<BackendFetchResult<T>> => {
  const {
    timeout = 30000,
    maxRetries = 2,
    autoWake = true,
    onProgress,
    ...fetchInit
  } = options;

  const url = `${API_BASE}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 退避延遲（第一次不等）
    if (attempt > 0) {
      const backoff = Math.min(3000 * attempt, 10000);
      onProgress?.(`重試中... (${attempt}/${maxRetries})`);
      await new Promise(r => setTimeout(r, backoff));
    }

    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchInit,
        signal: controller.signal,
      });
      clearTimeout(tid);

      // 502/503/504 → 後端可能在冷啟動
      if ((response.status === 502 || response.status === 503 || response.status === 504) && autoWake) {
        onProgress?.('後端正在冷啟動，自動喚醒中...');

        // 自動喚醒
        const woke = await doWakeUp(onProgress);
        if (woke && attempt < maxRetries) {
          continue; // 喚醒成功 → 重試這次請求
        }

        // 喚醒失敗
        throw new Error(`後端冷啟動失敗 (HTTP ${response.status})，請稍後再試。`);
      }

      // 正常回應 → parse JSON
      const text = await response.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        // 非 JSON 回應
        const isHtml = text.trimStart().startsWith('<');
        throw new Error(
          isHtml
            ? '後端回傳了 HTML 頁面，可能正在部署中或冷啟動尚未完成。'
            : `後端回應格式錯誤：${text.substring(0, 80)}...`
        );
      }

      // 後端回應成功 → 標記 online
      if (response.ok) {
        setStatus('online');
      }

      return {
        ok: response.ok,
        status: response.status,
        data,
        raw: text,
      };

    } catch (e: any) {
      lastError = e;

      // AbortError = timeout
      if (e.name === 'AbortError') {
        if (attempt < maxRetries) continue;
        throw new Error(`請求超時 (${timeout / 1000}s)，後端可能正在冷啟動或忙碌中。`);
      }

      // 網路斷線
      if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
        if (autoWake && attempt === 0) {
          // 第一次網路失敗 → 嘗試喚醒
          onProgress?.('無法連接後端，嘗試喚醒...');
          const woke = await doWakeUp(onProgress);
          if (woke) continue;
        }
        if (attempt < maxRetries) continue;
        setStatus('offline');
        throw new Error('無法連接後端伺服器，請檢查網路連線或等待後端冷啟動完成。');
      }

      // 已分類的錯誤直接拋出
      if (attempt >= maxRetries) throw e;
    }
  }

  throw lastError || new Error('未知錯誤');
};

// ─── 向下相容的便利函式 ───

/**
 * 檢查後端是否就緒（簡單版），結合 gateway 狀態
 */
export const validateBackendReady = async (): Promise<boolean> => {
  if (_status === 'online') return true;

  const alive = await healthCheck(8000);
  if (alive) {
    setStatus('online');
    return true;
  }

  return false;
};

/**
 * 手動喚醒後端（供 UI 使用）
 */
export const wakeUpBackendViaGateway = async (
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; error?: string }> => {
  const result = await doWakeUp(onProgress);
  return result
    ? { success: true }
    : { success: false, error: '後端冷啟動超時，請確認部署狀態後再試。' };
};
