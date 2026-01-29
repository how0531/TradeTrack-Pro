/**
 * 快取工具函數 - 用於券商帳號資料快取
 */

export interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live (毫秒)
}

/**
 * 儲存資料至快取
 * @param key 快取鍵值
 * @param data 要快取的資料
 * @param ttl 快取有效期 (毫秒)
 */
export function setCache<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
  const cached: CachedData<T> = {
    data,
    timestamp: Date.now(),
    ttl
  };
  
  try {
    localStorage.setItem(key, JSON.stringify(cached));
  } catch (e) {
    console.warn('Failed to set cache:', e);
  }
}

/**
 * 從快取讀取資料
 * @param key 快取鍵值
 * @returns 快取的資料,若過期或不存在則返回 null
 */
export function getCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const parsed: CachedData<T> = JSON.parse(cached);
    const now = Date.now();
    
    // 檢查是否過期
    if (now - parsed.timestamp > parsed.ttl) {
      localStorage.removeItem(key); // 清除過期快取
      return null;
    }
    
    return parsed.data;
  } catch (e) {
    console.warn('Failed to get cache:', e);
    return null;
  }
}

/**
 * 檢查快取是否存在且未過期
 * @param key 快取鍵值
 */
export function hasValidCache(key: string): boolean {
  return getCache(key) !== null;
}

/**
 * 清除特定快取
 * @param key 快取鍵值
 */
export function clearCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('Failed to clear cache:', e);
  }
}

/**
 * 清除所有快取 (以特定前綴)
 * @param prefix 前綴字串
 */
export function clearCacheByPrefix(prefix: string): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.warn('Failed to clear cache by prefix:', e);
  }
}
