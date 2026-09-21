import { isRetryableError, retryDelayMs } from '../retryPolicy';

describe('isRetryableError', () => {
  it('retries a request that was never answered', () => {
    // postgrest-js reports a failure to reach the server with an empty code.
    expect(isRetryableError({ message: 'FetchError: Network request failed', code: '' })).toBe(true);
    expect(isRetryableError(new TypeError('Network request failed'))).toBe(true);
  });

  it('does not retry an answer from the database', () => {
    expect(isRetryableError({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe(false);
    expect(isRetryableError({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isRetryableError({ code: 'PGRST116', message: 'no rows' })).toBe(false);
    expect(isRetryableError({ code: 'P0001', message: 'You are sending messages too quickly' })).toBe(false);
  });

  it('goes by HTTP status when there is one: server faults yes, client faults and rate limits no', () => {
    expect(isRetryableError({ status: 503 })).toBe(true);
    expect(isRetryableError({ statusCode: '500' })).toBe(true);
    expect(isRetryableError({ status: 400 })).toBe(false);
    expect(isRetryableError({ status: 404 })).toBe(false);
    expect(isRetryableError({ status: 429 })).toBe(false);
  });

  it('does not retry a non-error', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError('boom')).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it('backs off exponentially up to a ceiling', () => {
    const noJitter = () => 1;
    expect(retryDelayMs(0, noJitter)).toBe(1000);
    expect(retryDelayMs(1, noJitter)).toBe(2000);
    expect(retryDelayMs(10, noJitter)).toBe(8000);
  });

  it('spreads clients that failed together across half the window', () => {
    expect(retryDelayMs(1, () => 0)).toBe(1000);
    expect(retryDelayMs(1, () => 0.5)).toBe(1500);
  });
});
