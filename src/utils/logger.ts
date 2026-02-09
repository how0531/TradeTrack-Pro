/**
 * 統一的 Logger 系統
 * 
 * 用途：
 * - 開發環境顯示詳細 log
 * - 生產環境僅顯示 error 和 warn
 * - 統一格式，易於搜尋和過濾
 */

type LogLevel = 'debug' | 'perf' | 'info' | 'warn' | 'error';

interface LogOptions {
  data?: any;
  timestamp?: boolean;
}

class Logger {
  private isDev = import.meta.env.DEV;
  private isProduction = import.meta.env.PROD;

  private log(level: LogLevel, emoji: string, message: string, options: LogOptions = {}) {
    const { data, timestamp = true } = options;

    // 生產環境僅顯示 warn 和 error
    if (this.isProduction && !['warn', 'error'].includes(level)) {
      return;
    }

    const prefix = timestamp 
      ? `${emoji} [${level.toUpperCase()}] ${new Date().toISOString().split('T')[1].slice(0, 12)}` 
      : `${emoji} [${level.toUpperCase()}]`;

    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * 除錯訊息（僅開發環境）
   */
  debug(message: string, data?: any) {
    this.log('debug', '🐛', message, { data });
  }

  /**
   * 效能追蹤（僅開發環境）
   */
  perf(message: string, data?: any) {
    this.log('perf', '🔍', message, { data });
  }

  /**
   * 一般資訊（僅開發環境）
   */
  info(message: string, data?: any) {
    this.log('info', 'ℹ️', message, { data });
  }

  /**
   * 警告訊息（所有環境）
   */
  warn(message: string, data?: any) {
    this.log('warn', '⚠️', message, { data });
    if (this.isProduction && data instanceof Error) {
      // 生產環境可以串接 Sentry 或其他監控工具
      // Sentry.captureException(data);
    }
  }

  /**
   * 錯誤訊息（所有環境）
   */
  error(message: string, error?: any) {
    this.log('error', '❌', message, { data: error });
    if (this.isProduction && error) {
      // 生產環境可以串接 Sentry
      // Sentry.captureException(error);
    }
  }

  /**
   * 成功訊息（僅開發環境）
   */
  success(message: string, data?: any) {
    if (this.isDev) {
      console.log(`✅ [SUCCESS] ${message}`, data || '');
    }
  }

  /**
   * 計時器開始
   */
  timeStart(label: string) {
    if (this.isDev) {
      console.time(`⏱️ [TIME] ${label}`);
    }
  }

  /**
   * 計時器結束
   */
  timeEnd(label: string) {
    if (this.isDev) {
      console.timeEnd(`⏱️ [TIME] ${label}`);
    }
  }

  /**
   * 群組開始（用於折疊 log）
   */
  group(label: string) {
    if (this.isDev) {
      console.group(`📦 ${label}`);
    }
  }

  /**
   * 群組結束
   */
  groupEnd() {
    if (this.isDev) {
      console.groupEnd();
    }
  }
}

// 單例模式
export const logger = new Logger();

// 便利的 namespace logger
export const createNamespaceLogger = (namespace: string) => ({
  debug: (msg: string, data?: any) => logger.debug(`[${namespace}] ${msg}`, data),
  perf: (msg: string, data?: any) => logger.perf(`[${namespace}] ${msg}`, data),
  info: (msg: string, data?: any) => logger.info(`[${namespace}] ${msg}`, data),
  warn: (msg: string, data?: any) => logger.warn(`[${namespace}] ${msg}`, data),
  error: (msg: string, error?: any) => logger.error(`[${namespace}] ${msg}`, error),
  success: (msg: string, data?: any) => logger.success(`[${namespace}] ${msg}`, data),
});

// 專用 logger 實例（可選）
export const brokerLogger = createNamespaceLogger('BROKER');
export const perfLogger = createNamespaceLogger('PERF');
export const syncLogger = createNamespaceLogger('SYNC');
