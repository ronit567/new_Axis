// useUpsertProfile's photo handling. The order of storage and profile writes
// is the point: removing a photo deletes the stored file BEFORE clearing the
// profile's path, so the app never reports a photo as removed while it is
// still readable in the avatars bucket (which 0039 opens to any signed-in
// user). These tests pin that order, and that a failed delete changes nothing.

import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../lib/supabase', () => ({ supabase: {} }));

// Every storage and profile call is recorded here, in order.
const calls: string[] = [];
const mockRemoveAvatar = jest.fn();
const mockUploadAvatar = jest.fn();
const mockUpsert = jest.fn();

jest.mock('../../repositories/StorageRepository', () => ({
  StorageRepository: {
    removeAvatar: (...args: unknown[]) => mockRemoveAvatar(...args),
    uploadAvatar: (...args: unknown[]) => mockUploadAvatar(...args),
  },
}));

jest.mock('../../repositories/ProfileRepository', () => ({
  ProfileRepository: {
    upsert: (...args: unknown[]) => mockUpsert(...args),
  },
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
  signOut: jest.fn(),
}));

import { useUpsertProfile } from '../useProfile';

const BASE = { name: 'Alex Chen', program: 'Science', year: 2, bio: '' };

function renderUpsert() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useUpsertProfile(), { wrapper });
}

beforeEach(() => {
  calls.length = 0;
  mockRemoveAvatar.mockReset().mockImplementation(async () => {
    calls.push('removeAvatar');
  });
  mockUploadAvatar.mockReset().mockImplementation(async () => {
    calls.push('uploadAvatar');
    return 'user-1/new.jpg';
  });
  mockUpsert.mockReset().mockImplementation(async (_id: string, input: unknown) => {
    calls.push('upsert');
    return { id: 'user-1', ...(input as object) };
  });
});

describe('useUpsertProfile photo changes', () => {
  it('deletes the stored photo before clearing the path', async () => {
    const { result } = renderUpsert();

    await act(async () => {
      await result.current.mutateAsync({ ...BASE, removePhoto: true });
    });

    expect(calls).toEqual(['removeAvatar', 'upsert']);
    expect(mockRemoveAvatar).toHaveBeenCalledWith('user-1');
    expect(mockUpsert.mock.calls[0][1]).toMatchObject({ avatar_url: null });
  });

  it('leaves the profile untouched when the delete fails', async () => {
    mockRemoveAvatar.mockRejectedValue(new Error("Couldn't remove your photo: offline"));
    const { result } = renderUpsert();

    await act(async () => {
      await expect(
        result.current.mutateAsync({ ...BASE, removePhoto: true }),
      ).rejects.toThrow(/offline/);
    });

    // No upsert at all, so avatar_url still points at a photo that still
    // exists: nothing has half-happened, and the user can simply retry.
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('lets a newly picked photo win over a removal in the same save', async () => {
    const { result } = renderUpsert();

    await act(async () => {
      await result.current.mutateAsync({
        ...BASE,
        removePhoto: true,
        photo: { uri: 'file:///picked.jpg', mimeType: 'image/jpeg' },
      });
    });

    expect(calls).toEqual(['uploadAvatar', 'upsert']);
    expect(mockRemoveAvatar).not.toHaveBeenCalled();
    expect(mockUpsert.mock.calls[0][1]).toMatchObject({ avatar_url: 'user-1/new.jpg' });
  });

  it('does not touch the photo when neither a new photo nor a removal is given', async () => {
    const { result } = renderUpsert();

    await act(async () => {
      await result.current.mutateAsync({ ...BASE });
    });

    expect(calls).toEqual(['upsert']);
    // Omitted, not null: upsert only writes the keys it is given, so the
    // stored photo is kept.
    expect(mockUpsert.mock.calls[0][1]).not.toHaveProperty('avatar_url');
  });
});
