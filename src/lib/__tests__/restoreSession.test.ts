import { restoreSession, RESTORE_BUDGET_MS } from '../restoreSession';

const session = { user: { id: 'me' } };
const noWait = () => Promise.resolve();
const networkError = { name: 'AuthRetryableFetchError' };

describe('restoreSession', () => {
  it('returns a restored session without retrying', async () => {
    const getSession = jest.fn().mockResolvedValue({ data: { session }, error: null });

    await expect(restoreSession(getSession, noWait)).resolves.toBe(session);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('accepts a clean "no session" at once: that is a signed-out user, not a failure', async () => {
    const getSession = jest.fn().mockResolvedValue({ data: { session: null }, error: null });

    await expect(restoreSession(getSession, noWait)).resolves.toBeNull();
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('retries a restore that failed, and signs the user in when it recovers', async () => {
    const getSession = jest
      .fn()
      .mockResolvedValueOnce({ data: { session: null }, error: networkError })
      .mockResolvedValueOnce({ data: { session }, error: null });

    await expect(restoreSession(getSession, noWait)).resolves.toBe(session);
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it('gives up after its retries rather than holding the splash forever', async () => {
    const getSession = jest.fn().mockResolvedValue({ data: { session: null }, error: networkError });

    await expect(restoreSession(getSession, noWait)).resolves.toBeNull();
    expect(getSession).toHaveBeenCalledTimes(3);
  });

  it('stops early when each attempt is slow, so a dead network cannot stack timeouts', async () => {
    let clock = 0;
    // Every attempt burns most of the budget, like a request running to its timeout.
    const getSession = jest.fn().mockImplementation(async () => {
      clock += RESTORE_BUDGET_MS - 500;
      return { data: { session: null }, error: networkError };
    });

    await expect(restoreSession(getSession, noWait, () => clock)).resolves.toBeNull();
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});
