// StorageRepository (AX-401): mocks supabase.storage + global fetch (used to
// turn a local file:// URI into the arraybuffer the SDK's upload() expects).

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockRemove = jest.fn();
const mockFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: (...args: unknown[]) => mockFrom(...args),
    },
  },
}));

import { StorageRepository, type LocalPhoto } from '../StorageRepository';

function mockFetchResolving(bytes = 8) {
  (global as any).fetch = jest.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(bytes)),
  });
}

function photo(uri: string, mimeType: string | null = null): LocalPhoto {
  return { uri, mimeType };
}

beforeEach(() => {
  mockFrom.mockReset();
  mockUpload.mockReset();
  mockGetPublicUrl.mockReset();
  mockRemove.mockReset();
  mockRemove.mockResolvedValue({ data: null, error: null });

  mockFrom.mockImplementation((bucket: string) => {
    if (bucket !== 'listing-images') throw new Error(`Unexpected bucket: ${bucket}`);
    return {
      upload: (...args: unknown[]) => mockUpload(...args),
      getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
      remove: (...args: unknown[]) => mockRemove(...args),
    };
  });
});

describe('StorageRepository.uploadListingImages', () => {
  it('uploads each photo under {sellerId}/{listingId}/{index} and returns URLs + paths in order', async () => {
    mockFetchResolving();
    mockUpload.mockResolvedValue({ data: { path: 'ignored' }, error: null });
    mockGetPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.test/${path}` },
    }));

    const result = await StorageRepository.uploadListingImages('seller-1', 'listing-1', [
      photo('file:///a.jpg'),
      photo('file:///b.png'),
    ]);

    expect(mockUpload).toHaveBeenNthCalledWith(
      1,
      'seller-1/listing-1/0.jpg',
      expect.any(ArrayBuffer),
      { contentType: 'image/jpeg' },
    );
    expect(mockUpload).toHaveBeenNthCalledWith(
      2,
      'seller-1/listing-1/1.png',
      expect.any(ArrayBuffer),
      { contentType: 'image/png' },
    );
    expect(result).toEqual({
      urls: [
        'https://cdn.test/seller-1/listing-1/0.jpg',
        'https://cdn.test/seller-1/listing-1/1.png',
      ],
      paths: ['seller-1/listing-1/0.jpg', 'seller-1/listing-1/1.png'],
    });
  });

  it('defaults to image/jpeg for an unrecognized extension and no mimeType', async () => {
    mockFetchResolving();
    mockUpload.mockResolvedValue({ data: {}, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/x' } });

    await StorageRepository.uploadListingImages('seller-1', 'listing-1', [photo('file:///weird.heic')]);

    expect(mockUpload).toHaveBeenCalledWith(
      'seller-1/listing-1/0.jpg',
      expect.any(ArrayBuffer),
      { contentType: 'image/jpeg' },
    );
  });

  it('trusts the picker-reported mimeType over the (missing) extension for extensionless content:// uris', async () => {
    mockFetchResolving();
    mockUpload.mockResolvedValue({ data: {}, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/x' } });

    // Android's content picker returns uris with no file extension at all —
    // extension-sniffing alone would silently fall back to jpeg for a real PNG.
    await StorageRepository.uploadListingImages('seller-1', 'listing-1', [
      photo('content://media/external/images/media/12345', 'image/png'),
    ]);

    expect(mockUpload).toHaveBeenCalledWith(
      'seller-1/listing-1/0.png',
      expect.any(ArrayBuffer),
      { contentType: 'image/png' },
    );
  });

  it('falls back to extension-sniffing when mimeType is an unrecognized/non-image value', async () => {
    mockFetchResolving();
    mockUpload.mockResolvedValue({ data: {}, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/x' } });

    await StorageRepository.uploadListingImages('seller-1', 'listing-1', [
      photo('file:///a.png', 'application/octet-stream'),
    ]);

    expect(mockUpload).toHaveBeenCalledWith(
      'seller-1/listing-1/0.png',
      expect.any(ArrayBuffer),
      { contentType: 'image/png' },
    );
  });

  it('rolls back already-uploaded photos and throws an actionable error when a later upload fails', async () => {
    mockFetchResolving();
    mockUpload
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('mime type not allowed') });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/0.jpg' } });

    await expect(
      StorageRepository.uploadListingImages('seller-1', 'listing-1', [
        photo('file:///a.jpg'),
        photo('file:///b.jpg'),
      ]),
    ).rejects.toThrow('mime type not allowed');

    // Only the first (successful) upload should be rolled back — the second
    // never made it into storage, so there's nothing to remove for it.
    expect(mockRemove).toHaveBeenCalledWith(['seller-1/listing-1/0.jpg']);
  });

  it('does not attempt cleanup when the very first upload fails', async () => {
    mockFetchResolving();
    mockUpload.mockResolvedValue({ data: null, error: new Error('network down') });

    await expect(
      StorageRepository.uploadListingImages('seller-1', 'listing-1', [photo('file:///a.jpg')]),
    ).rejects.toThrow('network down');

    expect(mockRemove).not.toHaveBeenCalled();
  });
});

describe('StorageRepository.deleteListingImages', () => {
  it('does nothing when given no paths', async () => {
    await StorageRepository.deleteListingImages([]);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('swallows a removal error instead of throwing (best-effort cleanup)', async () => {
    mockRemove.mockRejectedValue(new Error('bucket unreachable'));

    await expect(
      StorageRepository.deleteListingImages(['seller-1/listing-1/0.jpg']),
    ).resolves.toBeUndefined();
  });
});
