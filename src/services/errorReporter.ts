/**
 * 全局错误报告服务
 * - 监听 window.onerror、window.onunhandledrejection
 * - 写入环形缓冲区（最多50条）
 * - 提供 getRecentErrors() API 用于诊断面板
 * - 不弹窗，只记录与控制台输出
 */

export interface ErrorRecord {
  id: string;
  timestamp: string;
  type: 'error' | 'unhandledrejection' | 'react' | 'network';
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  route: string;
  userAgent: string;
}

const BUFFER_SIZE = 50;
const errorBuffer: ErrorRecord[] = [];
let isInitialized = false;

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 添加错误到环形缓冲区
 */
function addError(record: ErrorRecord): void {
  if (errorBuffer.length >= BUFFER_SIZE) {
    errorBuffer.shift(); // 移除最旧的
  }
  errorBuffer.push(record);
}

/**
 * 创建错误记录
 */
function createErrorRecord(
  type: ErrorRecord['type'],
  message: string,
  options: Partial<ErrorRecord> = {}
): ErrorRecord {
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    type,
    message,
    route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    ...options,
  };
}

/**
 * 处理全局 error 事件
 */
function handleGlobalError(
  message: string | Event,
  source?: string,
  lineno?: number,
  colno?: number,
  error?: Error
): boolean {
  const errorMessage = error?.message || (typeof message === 'string' ? message : 'Unknown error');
  
  const record = createErrorRecord('error', errorMessage, {
    stack: error?.stack,
    source,
    lineno,
    colno,
  });

  addError(record);

  // 控制台输出（保持原有行为）
  console.error('[ErrorReporter] Global error:', {
    message: errorMessage,
    source,
    lineno,
    colno,
    stack: error?.stack,
  });

  // 返回 false 允许默认处理继续
  return false;
}

/**
 * 处理未捕获的 Promise rejection
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const reason = event.reason;
  const message = reason instanceof Error 
    ? reason.message 
    : typeof reason === 'string' 
      ? reason 
      : 'Unhandled promise rejection';

  const record = createErrorRecord('unhandledrejection', message, {
    stack: reason instanceof Error ? reason.stack : undefined,
  });

  addError(record);

  console.error('[ErrorReporter] Unhandled rejection:', {
    message,
    reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
}

/**
 * 初始化错误报告服务
 * 应在 App 入口处调用一次
 */
export function initErrorReporter(): void {
  if (isInitialized || typeof window === 'undefined') {
    return;
  }

  // 保存原有的处理器
  const originalOnError = window.onerror;
  const originalOnUnhandledRejection = window.onunhandledrejection;

  // 注册全局 error 处理
  window.onerror = function (message, source, lineno, colno, error) {
    handleGlobalError(message, source, lineno, colno, error);
    
    // 调用原有处理器
    if (originalOnError) {
      return originalOnError.call(this, message, source, lineno, colno, error);
    }
    return false;
  };

  // 注册 unhandledrejection 处理
  window.onunhandledrejection = function (event) {
    handleUnhandledRejection(event);
    
    // 调用原有处理器
    if (originalOnUnhandledRejection) {
      originalOnUnhandledRejection.call(this, event);
    }
  };

  isInitialized = true;
  console.info('[ErrorReporter] Initialized - monitoring global errors');
}

/**
 * 获取最近的错误列表
 * @param limit 返回条数，默认全部
 */
export function getRecentErrors(limit?: number): ErrorRecord[] {
  const errors = [...errorBuffer].reverse(); // 最新的在前
  return limit ? errors.slice(0, limit) : errors;
}

/**
 * 手动记录错误（供 ErrorBoundary 等组件调用）
 */
export function reportError(
  error: Error,
  type: ErrorRecord['type'] = 'react',
  context?: Record<string, unknown>
): void {
  const record = createErrorRecord(type, error.message, {
    stack: error.stack,
    source: context ? JSON.stringify(context) : undefined,
  });

  addError(record);

  console.error(`[ErrorReporter] ${type} error:`, {
    message: error.message,
    stack: error.stack,
    context,
  });
}

/**
 * 记录网络错误
 */
export function reportNetworkError(
  url: string,
  status: number,
  statusText: string
): void {
  const message = `Network error: ${status} ${statusText} - ${url}`;
  
  const record = createErrorRecord('network', message, {
    source: url,
  });

  addError(record);

  console.error('[ErrorReporter] Network error:', {
    url,
    status,
    statusText,
  });
}

/**
 * 清空错误缓冲区
 */
export function clearErrors(): void {
  errorBuffer.length = 0;
}

/**
 * 获取错误统计
 */
export function getErrorStats(): {
  total: number;
  byType: Record<ErrorRecord['type'], number>;
  lastError?: ErrorRecord;
} {
  const byType: Record<ErrorRecord['type'], number> = {
    error: 0,
    unhandledrejection: 0,
    react: 0,
    network: 0,
  };

  for (const err of errorBuffer) {
    byType[err.type]++;
  }

  return {
    total: errorBuffer.length,
    byType,
    lastError: errorBuffer[errorBuffer.length - 1],
  };
}

/**
 * 导出错误日志为文本
 */
export function exportErrorLog(): string {
  if (errorBuffer.length === 0) {
    return 'No errors recorded.';
  }

  const lines = errorBuffer.map((err, idx) => {
    return `
[${idx + 1}] ${err.timestamp}
Type: ${err.type}
Route: ${err.route}
Message: ${err.message}
${err.source ? `Source: ${err.source}` : ''}
${err.lineno ? `Line: ${err.lineno}, Col: ${err.colno}` : ''}
${err.stack ? `Stack:\n${err.stack}` : ''}
---`.trim();
  });

  return `Error Report - ${new Date().toISOString()}\nTotal: ${errorBuffer.length} errors\n\n${lines.join('\n\n')}`;
}
