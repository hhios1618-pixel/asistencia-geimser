export type ProxyFetchOptions = RequestInit & {
  retries?: number;
  backoffMs?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const proxyFetch = async (input: URL | RequestInfo, init: ProxyFetchOptions = {}) => {
  const { retries = 1, backoffMs = 200, ...requestInit } = init;
  let attempt = 0;
  let lastError: (Error & { code?: string }) | null = null;

  while (attempt <= retries) {
    try {
      const response = await fetch(input, requestInit);
      if (!response.ok) {
        throw new Error(`status_${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error as Error & { code?: string };
      const retriable =
        lastError.message.includes('status_502') ||
        lastError.message.includes('status_503') ||
        lastError.message.includes('status_504') ||
        lastError.message.includes('status_429') ||
        lastError.code === 'ECONNRESET';
      const aborted = requestInit.signal?.aborted ?? false;
      if (!retriable || aborted || attempt === retries) {
        break;
      }
      attempt += 1;
      await sleep(backoffMs * attempt);
    }
  }

  throw lastError ?? new Error('proxy_fetch_failed');
};
