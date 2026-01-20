/**
 * Fetch with retry, timeout, cancellation, and structured response
 * Supports both generic fetch and Supabase queries
 */

export interface FetchResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  elapsedMs: number;
  retryCount: number;
  cancelled?: boolean;
}

export interface FetchOptions {
  timeout?: number;      // Default 10s
  retries?: number;      // Default 2
  retryDelayMs?: number; // Initial delay, default 500ms
  onRetry?: (attempt: number, error: string) => void;
  signal?: AbortSignal;  // For cancellation
}

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 500;
const MAX_LOADING_TIME = 30000; // 30s max to prevent infinite spinning

/**
 * Sleep helper with abort support
 */
const sleep = (ms: number, signal?: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    
    const timeoutId = setTimeout(resolve, ms);
    
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }
  });
};

/**
 * Calculate exponential backoff delay
 */
const getBackoffDelay = (attempt: number, baseDelay: number): number => {
  return baseDelay * Math.pow(2, attempt);
};

/**
 * Generic fetch with retry, timeout, and cancellation support
 */
export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY,
    onRetry,
    signal
  } = options;

  const startTime = Date.now();
  let lastError: string = '';
  let attempt = 0;

  while (attempt <= retries) {
    // Check for cancellation
    if (signal?.aborted) {
      return {
        ok: false,
        data: null,
        error: '操作已取消',
        elapsedMs: Date.now() - startTime,
        retryCount: attempt,
        cancelled: true
      };
    }

    // Check for max loading time exceeded
    if (Date.now() - startTime > MAX_LOADING_TIME) {
      return {
        ok: false,
        data: null,
        error: '加载超时，请刷新重试',
        elapsedMs: Date.now() - startTime,
        retryCount: attempt
      };
    }

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => reject(new Error(`请求超时 (${timeout / 1000}s)`)), timeout);
        
        // Clear timeout if aborted
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        }
      });

      // Race between fetch and timeout
      const data = await Promise.race([fetchFn(), timeoutPromise]);

      return {
        ok: true,
        data,
        error: null,
        elapsedMs: Date.now() - startTime,
        retryCount: attempt
      };
    } catch (err) {
      // Handle abort
      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          ok: false,
          data: null,
          error: '操作已取消',
          elapsedMs: Date.now() - startTime,
          retryCount: attempt,
          cancelled: true
        };
      }

      lastError = err instanceof Error ? err.message : String(err);
      
      if (attempt < retries) {
        const delay = getBackoffDelay(attempt, retryDelayMs);
        onRetry?.(attempt + 1, lastError);
        console.warn(`[fetchWithRetry] 第${attempt + 1}次尝试失败: ${lastError}. ${delay}ms后重试...`);
        
        try {
          await sleep(delay, signal);
        } catch {
          // Aborted during sleep
          return {
            ok: false,
            data: null,
            error: '操作已取消',
            elapsedMs: Date.now() - startTime,
            retryCount: attempt,
            cancelled: true
          };
        }
      }
      
      attempt++;
    }
  }

  return {
    ok: false,
    data: null,
    error: lastError,
    elapsedMs: Date.now() - startTime,
    retryCount: attempt - 1
  };
}

/**
 * Supabase query wrapper - never throws
 */
export async function supabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: { message: string } | null }>,
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  return fetchWithRetry(async () => {
    const result = await queryFn();
    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.data as T;
  }, options);
}

/**
 * Batch multiple queries with independent failure handling
 * Returns results for each query, allowing partial success
 */
export async function batchQueries<T extends Record<string, () => Promise<{ data: unknown; error: { message: string } | null }>>>(
  queries: T,
  options: FetchOptions = {}
): Promise<{ [K in keyof T]: FetchResult<Awaited<ReturnType<T[K]>>['data']> }> {
  const entries = Object.entries(queries);
  
  const results = await Promise.all(
    entries.map(async ([key, queryFn]) => {
      const result = await supabaseQuery(queryFn, options);
      return [key, result] as const;
    })
  );

  return Object.fromEntries(results) as { [K in keyof T]: FetchResult<Awaited<ReturnType<T[K]>>['data']> };
}

/**
 * Load phase types for 3-phase loading
 */
export type LoadPhase = 'idle' | 'project' | 'workstations' | 'details';

/**
 * Load state tracking for UI
 */
export interface LoadState {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  retryCount: number;
  elapsedMs?: number;
}

/**
 * 3-Phase load state structure
 */
export interface PhaseLoadStates {
  project: LoadState;      // Phase 1: Project header (lightweight)
  workstations: LoadState; // Phase 2: Workstation list
  details: LoadState;      // Phase 3: Selected workstation details (layouts/modules/assets)
}

export const createLoadState = (): LoadState => ({
  status: 'idle',
  error: null,
  retryCount: 0
});

export const loadingState = (): LoadState => ({
  status: 'loading',
  error: null,
  retryCount: 0
});

export const successState = (elapsedMs?: number): LoadState => ({
  status: 'success',
  error: null,
  retryCount: 0,
  elapsedMs
});

export const errorState = (error: string, retryCount = 0): LoadState => ({
  status: 'error',
  error,
  retryCount
});

export const initialPhaseLoadStates: PhaseLoadStates = {
  project: createLoadState(),
  workstations: createLoadState(),
  details: createLoadState(),
};

/**
 * Create an AbortController with automatic cleanup after timeout
 */
export function createAbortController(timeoutMs = MAX_LOADING_TIME): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  return {
    controller,
    cleanup: () => clearTimeout(timeoutId)
  };
}
