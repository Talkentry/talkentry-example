import type { TalkentryFetch } from './types';

type Options = {
  readonly url: string;
  readonly fetch: TalkentryFetch;
  readonly body: FormData;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
};

/** Bounds XHR/fetch and detaches the external signal after request completion. */
export const requestMultipart = async (options: Options): Promise<unknown> => {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  let cleanup = () => undefined as void;
  let rejectAbort: (() => void) | undefined;
  if (options.signal?.aborted) {
    controller.abort();
  } else {
    options.signal?.addEventListener('abort', cancel, { once: true });
  }
  const timer = setTimeout(cancel, options.timeoutMs);

  try {
    if (controller.signal.aborted) {
      throw new Error('Cancelled');
    }
    const abort = new Promise<never>((_resolve, reject) => {
      rejectAbort = () => reject(new Error('Cancelled'));
      controller.signal.addEventListener('abort', rejectAbort, { once: true });
    });
    const request = async () => {
      if (typeof XMLHttpRequest === 'undefined') {
        const response = await options.fetch(options.url, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: options.body,
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('HTTP failure');
        }
        return response.json();
      }

      return new Promise<unknown>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const fail = () => reject(new Error('XHR failure'));
        const abortXhr = () => {
          xhr.abort();
          fail();
        };
        cleanup = () => {
          controller.signal.removeEventListener('abort', abortXhr);
          xhr.onload = null;
          xhr.onerror = null;
          xhr.ontimeout = null;
          xhr.onabort = null;
        };
        xhr.open('POST', options.url);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.timeout = options.timeoutMs;
        xhr.onload = () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            fail();
            return;
          }
          try {
            resolve(JSON.parse(xhr.responseText) as unknown);
          } catch {
            fail();
          }
        };
        xhr.onerror = fail;
        xhr.ontimeout = fail;
        xhr.onabort = fail;
        controller.signal.addEventListener('abort', abortXhr, { once: true });
        xhr.send(options.body);
      });
    };
    return await Promise.race([abort, request()]);
  } catch {
    throw new Error('Chat transport request failed');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
    if (rejectAbort) {
      controller.signal.removeEventListener('abort', rejectAbort);
    }
    cleanup();
  }
};
