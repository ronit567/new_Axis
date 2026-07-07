// ProfileRepository.deleteAccount (AX-704): mocks `supabase.rpc(...)`, same
// approach as ListingRepository.test.ts's rpc coverage. Only the new
// deleteAccount method is covered here — getById/getCurrent/upsert have no
// existing test file and are out of scope for this ticket.

const mockRpc = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { ProfileRepository } from '../ProfileRepository';

describe('ProfileRepository.deleteAccount', () => {
  afterEach(() => {
    mockRpc.mockReset();
  });

  it('calls the delete_own_account RPC with no arguments', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await ProfileRepository.deleteAccount();

    expect(mockRpc).toHaveBeenCalledWith('delete_own_account');
  });

  it('propagates an RPC error instead of swallowing it', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('rpc failed') });

    await expect(ProfileRepository.deleteAccount()).rejects.toThrow('rpc failed');
  });
});
