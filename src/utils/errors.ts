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
