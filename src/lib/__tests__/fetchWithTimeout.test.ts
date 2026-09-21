import { createFetchWithTimeout, REQUEST_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from '../fetchWithTimeout';

// A fetch that never answers, and rejects like the real one when aborted.
function hangingFetch() {
  const signals: AbortSignal[] = [];
  const impl = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal as AbortSignal;
    signals.push(signal);
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener('abort', () =>
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
      );
    });
  });
  return { impl: impl as unknown as typeof fetch, signals };
}

const REST = 'https://x.supabase.co/rest/v1/listings?select=*';

describe('createFetchWithTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('gives up on a request that is never answered', async () => {
    const { impl } = hangingFetch();
    const result = createFetchWithTimeout(impl)(REST).catch((e: Error) => e.name);

    jest.advanceTimersByTime(REQUEST_TIMEOUT_MS - 1);
    await Promise.resolve();
    jest.advanceTimersByTime(1);

    await expect(result).resolves.toBe('AbortError');
  });

  it('gives a photo upload longer, but not signing or listing calls on the same path', () => {
    const { impl, signals } = hangingFetch();
    const timed = createFetchWithTimeout(impl);
    const base = 'https://x.supabase.co/storage/v1/object/';
    timed(`${base}listing-images/u/a.jpg`, { method: 'POST' }).catch(() => {});
    timed(`${base}sign/avatars/u/a.jpg`, { method: 'POST' }).catch(() => {});
    timed(`${base}list/avatars`, { method: 'POST' }).catch(() => {});

    jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);
    expect(signals.map((s) => s.aborted)).toEqual([false, true, true]);

    jest.advanceTimersByTime(UPLOAD_TIMEOUT_MS - REQUEST_TIMEOUT_MS);
    expect(signals[0].aborted).toBe(true);
  });

  it("still honours the caller's own cancellation", async () => {
    const { impl } = hangingFetch();
    const caller = new AbortController();
    const result = createFetchWithTimeout(impl)(REST, { signal: caller.signal }).catch(
      (e: Error) => e.name,
    );

    caller.abort();

    await expect(result).resolves.toBe('AbortError');
  });

  it('passes a normal response through and leaves no timer behind', async () => {
    const response = { ok: true } as Response;
    const impl = jest.fn().mockResolvedValue(response) as unknown as typeof fetch;

    await expect(createFetchWithTimeout(impl)(REST)).resolves.toBe(response);
    expect(jest.getTimerCount()).toBe(0);
  });
});
