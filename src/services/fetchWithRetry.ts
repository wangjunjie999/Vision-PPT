/**
 * Fetch with retry, timeout, and structured response
 * Supports both generic fetch and Supabase queries
 */

export interface FetchResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  elapsedMs: number;
  retryCount: number;
}

export interface FetchOptions {
  timeout?: number;      // Default 10s
  retries?: number;      // Default 2
  retryDelayMs?: number; // Initial delay, default 500ms
  onRetry?: (attempt: number, error: string) => void;
}

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 500;

/**
 * Sleep helper
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay
 */
const getBackoffDelay = (attempt: number, baseDelay: number): number => {
  return baseDelay * Math.pow(2, attempt);
};

/**
 * Generic fetch with retry and timeout
 */
export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY,
    onRetry
  } = options;

  const startTime = Date.now();
  let lastError: string = '';
  let attempt = 0;

  while (attempt <= retries) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout);
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
      lastError = err instanceof Error ? err.message : String(err);
      
      if (attempt < retries) {
        const delay = getBackoffDelay(attempt, retryDelayMs);
        onRetry?.(attempt + 1, lastError);
        console.warn(`[fetchWithRetry] Attempt ${attempt + 1} failed: ${lastError}. Retrying in ${delay}ms...`);
        await sleep(delay);
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
 * Load state tracking for UI
 */
export interface LoadState {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  retryCount: number;
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

export const successState = (): LoadState => ({
  status: 'success',
  error: null,
  retryCount: 0
});

export const errorState = (error: string, retryCount = 0): LoadState => ({
  status: 'error',
  error,
  retryCount
});
