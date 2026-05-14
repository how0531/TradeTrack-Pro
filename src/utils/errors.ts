/**
 * 自訂錯誤類別
 * 
 * 用途：提供更精確的錯誤分類和處理
 */

/**
 * 券商連線相關錯誤
 */
export class BrokerConnectionError extends Error {
  constructor(
    message: string,
    public code: 
      | 'BACKEND_OFFLINE'      // 後端完全離線
      | 'BACKEND_WAKING'       // 後端喚醒中
      | 'API_UNAVAILABLE'      // API 端點不可用
      | 'TIMEOUT'              // 請求超時
      | 'NETWORK_ERROR'        // 網路錯誤
      | 'UNKNOWN'              // 未知錯誤
  ) {
    super(message);
    this.name = 'BrokerConnectionError';
    
    // 保留 stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BrokerConnectionError);
    }
  }
}

/**
 * 券商認證相關錯誤
 */
export class BrokerAuthError extends Error {
  constructor(
    message: string,
    public code:
      | 'INVALID_CREDENTIALS'   // 憑證無效
      | 'MISSING_FIELDS'        // 缺少必要欄位
      | 'INVALID_API_KEY'       // API Key 無效
      | 'INVALID_SECRET'        // Secret Key 無效
      | 'CA_ERROR'              // 憑證錯誤
      | 'ACCOUNT_NOT_ACCEPTABLE' // 帳號不可用
  ) {
    super(message);
    this.name = 'BrokerAuthError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BrokerAuthError);
    }
  }
}

/**
 * 券商 API 回應錯誤
 */
export class BrokerAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: any
  ) {
    super(message);
    this.name = 'BrokerAPIError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BrokerAPIError);
    }
  }
}

/**
 * 資料驗證錯誤
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public constraints?: string[]
  ) {
    super(message);
    this.name = 'ValidationError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

/**
 * 錯誤處理輔助函數
 */

/**
 * 從錯誤訊息中提取錯誤代碼
 */
export function extractErrorCode(error: Error): string {
  if (error instanceof BrokerConnectionError || error instanceof BrokerAuthError) {
    return error.code;
  }
  if (error instanceof BrokerAPIError) {
    return `HTTP_${error.statusCode}`;
  }
  return 'UNKNOWN';
}

/**
 * 根據錯誤類型提供用戶友善的訊息
 */
export function getUserFriendlyErrorMessage(error: Error, lang: 'zh' | 'en' = 'zh'): string {
  if (error instanceof BrokerConnectionError) {
    switch (error.code) {
      case 'BACKEND_OFFLINE':
        return lang === 'zh' 
          ? '後端服務離線，請確認網路連線或稍後再試'
          : 'Backend service is offline. Please check your connection or try again later.';
      case 'BACKEND_WAKING':
        return lang === 'zh'
          ? '後端服務啟動中，請稍候 30 秒後重試'
          : 'Backend is waking up. Please wait 30 seconds and try again.';
      case 'API_UNAVAILABLE':
        return lang === 'zh'
          ? 'API 服務暫時無法使用，請聯絡技術支援'
          : 'API service is temporarily unavailable. Please contact support.';
      case 'TIMEOUT':
        return lang === 'zh'
          ? '請求超時，請檢查網路連線後重試'
          : 'Request timed out. Please check your connection and try again.';
      case 'NETWORK_ERROR':
        return lang === 'zh'
          ? '網路錯誤，請檢查您的網路連線'
          : 'Network error occurred. Please check your internet connection.';
      default:
        return error.message;
    }
  }
  
  if (error instanceof BrokerAuthError) {
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        return lang === 'zh'
          ? '憑證無效，請檢查 API Key 與 Secret Key'
          : 'Invalid credentials. Please check your API Key and Secret Key.';
      case 'MISSING_FIELDS':
        return lang === 'zh'
          ? '請填寫所有必要欄位'
          : 'Please fill in all required fields.';
      case 'INVALID_API_KEY':
        return lang === 'zh'
          ? 'API Key 無效或不存在，請重新設定'
          : 'API Key is invalid or does not exist. Please reconfigure.';
      case 'CA_ERROR':
        return lang === 'zh'
          ? '憑證檔案錯誤，請確認檔案路徑與密碼'
          : 'Certificate error. Please verify file path and password.';
      case 'ACCOUNT_NOT_ACCEPTABLE':
        return lang === 'zh'
          ? '帳號授權失敗，請確認該帳號是否有效'
          : 'Account authorization failed. Please verify your account status.';
      default:
        return error.message;
    }
  }
  
  if (error instanceof BrokerAPIError) {
    return lang === 'zh'
      ? `API 錯誤 (${error.statusCode}): ${error.message}`
      : `API Error (${error.statusCode}): ${error.message}`;
  }
  
  if (error instanceof ValidationError) {
    if (error.field) {
      return lang === 'zh'
        ? `欄位「${error.field}」驗證失敗: ${error.message}`
        : `Field "${error.field}" validation failed: ${error.message}`;
    }
    return error.message;
  }
  
  return error.message || (lang === 'zh' ? '發生未知錯誤' : 'An unknown error occurred');
}

/**
 * Map an arbitrary thrown value (string / Error / unknown) to a user-friendly
 * message. Use this at every UI catch site to avoid leaking raw engineering
 * strings ("Job status polling failed", "Failed to fetch", "AbortError",
 * Shioaji tracebacks…) to end users.
 */
export function friendlyMessage(err: unknown, lang: 'zh' | 'en' = 'zh'): string {
  // Typed errors first — preserve the existing detailed handling.
  if (err instanceof BrokerConnectionError || err instanceof BrokerAuthError
      || err instanceof BrokerAPIError || err instanceof ValidationError) {
    return getUserFriendlyErrorMessage(err, lang);
  }

  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const lower = raw.toLowerCase();
  const zh = lang === 'zh';

  // Network / abort
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return zh ? '網路連線中斷，請確認網路後重試。' : 'Network unavailable. Please check your connection and retry.';
  }
  if (lower.includes('aborterror') || lower.includes('aborted')) {
    return zh ? '請求被取消。' : 'Request was cancelled.';
  }

  // Backend cold start / hibernation
  if (lower.includes('hibernat') || lower.includes('cold start')
      || lower.includes('冷啟動') || lower.includes('喚醒')) {
    return zh
      ? '後端正在喚醒中（首次啟動約需 30 秒），請稍候再試。'
      : 'Backend is waking up (first-boot takes ~30s). Please retry shortly.';
  }

  // HTTP-ish gateway codes that bubble up as strings
  if (/\b50[234]\b/.test(raw)) {
    return zh
      ? '後端暫時無法回應（HTTP 502/503/504），通常數十秒內會自動恢復。'
      : 'Backend temporarily unavailable (HTTP 502/503/504). Usually recovers in seconds.';
  }
  if (/\b401\b/.test(raw)) {
    return zh ? '帳號驗證失敗，請重新登入。' : 'Authentication failed. Please sign in again.';
  }
  if (/\b403\b/.test(raw)) {
    return zh ? '權限不足，無法存取此資源。' : 'You do not have permission for this resource.';
  }

  // Polling failures emitted by brokerService
  if (lower.includes('polling') || lower.includes('job status')) {
    return zh
      ? '同步任務查詢失敗，後端可能正在重啟。請 30 秒後重試。'
      : 'Sync job lookup failed; the backend may be restarting. Retry in 30 seconds.';
  }

  // Shioaji / broker-specific signals
  if (lower.includes('ca') && (lower.includes('expired') || lower.includes('過期') || lower.includes('未啟動'))) {
    return zh
      ? '券商憑證已過期或未啟動，請至「設定」重新上傳 .pfx 檔案。'
      : 'Broker certificate expired or inactive. Re-upload the .pfx file in Settings.';
  }
  if (lower.includes('begin_date') || lower.includes('incorrect type')) {
    return zh
      ? '日期範圍超過券商允許上限（證券 90 天）。請改用較短的區間。'
      : 'Date range exceeds broker limit (90 days for stocks). Try a shorter range.';
  }

  // Permission denied from Firebase
  if (lower.includes('permission-denied') || lower.includes('permission denied')) {
    return zh
      ? '雲端權限不足，請確認已用同一個 Google 帳號登入。'
      : 'Cloud permission denied. Make sure you signed in with the same Google account.';
  }

  // Fall back to the raw message; if there is none, supply a generic one.
  return raw || (zh ? '發生未知錯誤，請稍後重試。' : 'An unknown error occurred. Please try again.');
}

/**
 * 判斷錯誤是否可重試
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof BrokerConnectionError) {
    return ['BACKEND_WAKING', 'TIMEOUT', 'NETWORK_ERROR'].includes(error.code);
  }
  
  if (error instanceof BrokerAPIError) {
    // 5xx 錯誤通常可重試，4xx 通常不可重試
    return error.statusCode >= 500 && error.statusCode < 600;
  }
  
  return false;
}
