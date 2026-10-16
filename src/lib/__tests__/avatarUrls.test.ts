// avatarUrls (0039): profiles.avatar_url holds an object path in the private
// `avatars` bucket, and this module turns a path into a short-lived signed URL.
// The behaviour worth pinning is the batching and caching — a Messages inbox
// mounts ~20 Avatars at once, and the same person recurs across screens.
//
// Real timers: the module's only timer is the setTimeout(0) that batches a
// render's requests, which fires on the next macrotask and which waitFor
// awaits naturally. Batching still holds, because every renderHook in a test
// mounts synchronously, before that timer can run.
//
// This suite timing out on CI was never about this suite. A looping animation
// leaked from another suite in the same Jest worker; see the Animated block in
// jest.setup.ts.

import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockCreateSignedUrls = jest.fn();
const mockFrom = jest.fn((_bucket: string) => ({ createSignedUrls: mockCreateSignedUrls }));

jest.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => mockFrom(bucket),
    },
  },
}));

import { useAvatarUrl, clearAvatarUrlCache } from '../avatarUrls';

function signedOk(paths: string[]) {
  return {
    data: paths.map((path) => ({ error: null, path, signedUrl: `https://cdn.test/${path}?token=t` })),
    error: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // The cache lives at module scope; reset it through the same function
  // sign-out uses so no test inherits another's resolved URLs.
  clearAvatarUrlCache();
});

// Everything below drives the module through its only public entry point,
// the hook — which is also how Avatar uses it.
describe('useAvatarUrl', () => {
  it('passes an absolute uri straight through without signing', () => {
    const { result } = renderHook(() => useAvatarUrl('file:///tmp/picked.jpg'));

    expect(result.current).toBe('file:///tmp/picked.jpg');
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });

  it('passes a pre-0039 public URL straight through', () => {
    const legacy = 'https://x.supabase.co/storage/v1/object/public/avatars/u/1.jpg';
    const { result } = renderHook(() => useAvatarUrl(legacy));

    expect(result.current).toBe(legacy);
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });

  it('renders nothing and signs nothing when there is no avatar', () => {
    const { result } = renderHook(() => useAvatarUrl(null));

    expect(result.current).toBeNull();
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });

  it('signs a stored path and returns the signed URL', async () => {
    mockCreateSignedUrls.mockResolvedValue(signedOk(['user-a/1.jpg']));

    const { result } = renderHook(() => useAvatarUrl('user-a/1.jpg'));
    expect(result.current).toBeNull(); // initials fallback until it resolves

    await waitFor(() => expect(result.current).toBe('https://cdn.test/user-a/1.jpg?token=t'));
    expect(mockFrom).toHaveBeenCalledWith('avatars');
  });

  it('batches several distinct paths mounted together into a single request', async () => {
    mockCreateSignedUrls.mockImplementation((paths: string[]) =>
      Promise.resolve(signedOk(paths)),
    );

    // All three mount synchronously, before the setTimeout(0) flush can run.
    const a = renderHook(() => useAvatarUrl('user-a/1.jpg'));
    const b = renderHook(() => useAvatarUrl('user-b/1.jpg'));
    const c = renderHook(() => useAvatarUrl('user-c/1.jpg'));

    await waitFor(() => expect(a.result.current).toContain('user-a'));
    expect(b.result.current).toContain('user-b');
    expect(c.result.current).toContain('user-c');

    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
    expect(mockCreateSignedUrls.mock.calls[0][0].sort()).toEqual([
      'user-a/1.jpg',
      'user-b/1.jpg',
      'user-c/1.jpg',
    ]);
  });

  it('serves a repeat request for the same path from cache', async () => {
    mockCreateSignedUrls.mockImplementation((paths: string[]) =>
      Promise.resolve(signedOk(paths)),
    );

    const first = renderHook(() => useAvatarUrl('user-a/1.jpg'));
    await waitFor(() => expect(first.result.current).toContain('user-a'));

    // A second mount of the same avatar (chat header after the inbox row)
    // resolves synchronously and issues no new request.
    const second = renderHook(() => useAvatarUrl('user-a/1.jpg'));
    expect(second.result.current).toBe('https://cdn.test/user-a/1.jpg?token=t');
    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
  });

  it('falls back to no photo when one path in a batch fails but keeps the rest', async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [
        { error: null, path: 'user-a/1.jpg', signedUrl: 'https://cdn.test/user-a/1.jpg?token=t' },
        { error: 'Object not found', path: 'user-b/1.jpg', signedUrl: null },
      ],
      error: null,
    });

    const a = renderHook(() => useAvatarUrl('user-a/1.jpg'));
    const b = renderHook(() => useAvatarUrl('user-b/1.jpg'));

    // Both settle in the same flush, so once a has its URL, b is final too.
    await waitFor(() => expect(a.result.current).toContain('user-a'));
    expect(b.result.current).toBeNull();
  });

  it('falls back to no photo when the whole signing call fails', async () => {
    mockCreateSignedUrls.mockResolvedValue({ data: null, error: new Error('offline') });

    const { result } = renderHook(() => useAvatarUrl('user-a/1.jpg'));

    // Wait for the batch to actually be sent, then let its result settle,
    // so this asserts the outcome of the failed call rather than the
    // pre-request state.
    await waitFor(() => expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1));
    await act(async () => {});

    expect(result.current).toBeNull();
  });

  it('re-signs after the cache is cleared on sign-out', async () => {
    mockCreateSignedUrls.mockImplementation((paths: string[]) =>
      Promise.resolve(signedOk(paths)),
    );

    const first = renderHook(() => useAvatarUrl('user-a/1.jpg'));
    await waitFor(() => expect(first.result.current).toContain('user-a'));

    clearAvatarUrlCache();

    const second = renderHook(() => useAvatarUrl('user-a/1.jpg'));
    expect(second.result.current).toBeNull();
    await waitFor(() => expect(second.result.current).toContain('user-a'));

    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(2);
  });
});
