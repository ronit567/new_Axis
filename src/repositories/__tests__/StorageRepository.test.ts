// StorageRepository (AX-401/0023): mocks supabase.storage, global fetch (used
// to turn a local file:// URI into the arraybuffer the SDK's upload() expects),
// and expo-image-manipulator (the on-device resize step). Every listing photo
// now uploads as two JPEG variants: a detail image and a _thumb grid variant.

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockRemove = jest.fn();
const mockFrom = jest.fn();
const mockManipulate = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: (...args: unknown[]) => mockFrom(...args),
    },
  },
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (...args: unknown[]) => mockManipulate(...args),
  },
}));

import { StorageRepository, type LocalPhoto } from '../StorageRepository';

type MockContext = {
  resize: jest.Mock;
  renderAsync: jest.Mock;
  saveAsync: jest.Mock;
};

const contexts: MockContext[] = [];

// One context per prepareListingPhoto call. saveAsync's result uri encodes the
// source + compress level so assertions can tell detail and thumb runs apart.
function makeContext(uri: string): MockContext {
  const context: MockContext = {
    resize: jest.fn(),
    renderAsync: jest.fn(),
    saveAsync: jest.fn(),
  };
  context.resize.mockReturnValue(context);
  context.saveAsync.mockImplementation(({ compress }: { compress: number }) =>
    Promise.resolve({ uri: `${uri}#jpeg-${compress}`, width: 0, height: 0 }),
  );
  context.renderAsync.mockResolvedValue({
    width: 4000,
    height: 3000,
    saveAsync: context.saveAsync,
  });
  contexts.push(context);
  return context;
}

function mockFetchResolving(bytes = 8) {
  (global as any).fetch = jest.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(bytes)),
  });
}

function photo(uri: string, width = 4000, height = 3000): LocalPhoto {
  return { uri, mimeType: null, width, height };
}

beforeEach(() => {
  mockFrom.mockReset();
  mockUpload.mockReset();
  mockGetPublicUrl.mockReset();
  mockRemove.mockReset();
  mockManipulate.mockReset();
  contexts.length = 0;
  mockRemove.mockResolvedValue({ data: null, error: null });
  mockManipulate.mockImplementation((uri: string) => makeContext(uri));

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
  it('uploads a detail + thumb JPEG pair per photo under {sellerId}/{listingId}/{index} and returns URLs + paths in order', async () => {
    mockFetchResolving();
    mockUpload.mockResolvedValue({ data: { path: 'ignored' }, error: null });
    mockGetPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.test/${path}` },
    }));

    const result = await StorageRepository.uploadListingImages('seller-1', 'listing-1', [
      photo('file:///a.jpg'),
      photo('file:///b.png'),
    ]);

    expect(mockUpload.mock.calls.map((call) => call[0])).toEqual([
      'seller-1/listing-1/0.jpg',
      'seller-1/listing-1/0_thumb.jpg',
      'seller-1/listing-1/1.jpg',
      'seller-1/listing-1/1_thumb.jpg',
    ]);
    // Everything is re-encoded as JPEG by the resize step, regardless of the
    // picked photo's original format.
    for (const call of mockUpload.mock.calls) {
      expect(call[2]).toEqual({ contentType: 'image/jpeg' });
    }
    expect(result).toEqual({
      urls: ['https://cdn.test/seller-1/listing-1/0.jpg', 'https://cdn.test/seller-1/listing-1/1.jpg'],
      thumbUrls: [
        'https://cdn.test/seller-1/listing-1/0_thumb.jpg',
        'https://cdn.test/seller-1/listing-1/1_thumb.jpg',
      ],
      paths: [
        'seller-1/listing-1/0.jpg',
        'seller-1/listing-1/0_thumb.jpg',
        'seller-1/listing-1/1.jpg',
        'seller-1/listing-1/1_thumb.jpg',
      ],
    });
  });

  it('resizes by the long edge: landscape by width, portrait by height', async () => {
    mockFetchResolving();
    mockUpload.mockResolvedValue({ data: {}, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/x' } });

    await StorageRepository.uploadListingImages('seller-1', 'listing-1', [
      photo('file:///landscape.jpg', 4000, 3000),
      photo('file:///portrait.jpg', 3000, 4000),
    ]);

    // Contexts: landscape detail, landscape thumb, portrait detail, portrait thumb.
    expect(contexts[0].resize).toHaveBeenCalledWith({ width: 1600 });
    expect(contexts[1].resize).toHaveBeenCalledWith({ width: 480 });
    expect(contexts[2].resize).toHaveBeenCalledWith({ height: 1600 });
    expect(contexts[3].resize).toHaveBeenCalledWith({ height: 480 });

    // Each thumb pass starts from the detail pass's saved output (the mock
    // saveAsync uri encodes source + compress), not the full-res original.
    expect(mockManipulate.mock.calls.map((call) => call[0])).toEqual([
      'file:///landscape.jpg',
      'file:///landscape.jpg#jpeg-0.7',
      'file:///portrait.jpg',
      'file:///portrait.jpg#jpeg-0.7',
    ]);
  });

  it('never upscales a photo already smaller than the target size', async () => {
    mockFetchResolving();
    mockUpload.mockResolvedValue({ data: {}, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/x' } });

    await StorageRepository.uploadListingImages('seller-1', 'listing-1', [
      photo('file:///small.jpg', 400, 300),
    ]);

    expect(contexts[0].resize).not.toHaveBeenCalled();
    expect(contexts[1].resize).not.toHaveBeenCalled();
  });

  it('decodes once to measure when the picker reported no dimensions', async () => {
    mockFetchResolving();
    mockUpload.mockResolvedValue({ data: {}, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/x' } });

    await StorageRepository.uploadListingImages('seller-1', 'listing-1', [
      { uri: 'content://media/12345', mimeType: null },
    ]);

    // Probe render + final render for the detail pass. The mocked probe
    // reports 4000x3000, so the resize decision still lands on the long edge
    // (width). The thumb pass inherits the detail's computed dimensions, so
    // it never needs its own probe — one render only.
    expect(contexts[0].renderAsync).toHaveBeenCalledTimes(2);
    expect(contexts[0].resize).toHaveBeenCalledWith({ width: 1600 });
    expect(contexts[1].renderAsync).toHaveBeenCalledTimes(1);
    expect(contexts[1].resize).toHaveBeenCalledWith({ width: 480 });
  });

  it('rolls back every uploaded variant and reports the failing photo number when a detail upload fails', async () => {
    mockFetchResolving();
    mockUpload
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('mime type not allowed') });
    mockGetPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.test/${path}` },
    }));

    await expect(
      StorageRepository.uploadListingImages('seller-1', 'listing-1', [
        photo('file:///a.jpg'),
        photo('file:///b.jpg'),
      ]),
    ).rejects.toThrow("Couldn't upload photo 2 of 2: mime type not allowed");

    expect(mockRemove).toHaveBeenCalledWith([
      'seller-1/listing-1/0.jpg',
      'seller-1/listing-1/0_thumb.jpg',
    ]);
  });

  it('rolls back the already-uploaded detail variant when the thumb upload fails', async () => {
    mockFetchResolving();
    mockUpload
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('network down') });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/x' } });

    await expect(
      StorageRepository.uploadListingImages('seller-1', 'listing-1', [photo('file:///a.jpg')]),
    ).rejects.toThrow("Couldn't upload photo 1 of 1: network down");

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

describe('StorageRepository.uploadListingImageAdditions', () => {
  it('uploads pairs under {sellerId}/{listingId}/{timestamp}-{index}, never colliding with index-named live objects', async () => {
    mockFetchResolving();
    mockUpload.mockResolvedValue({ data: {}, error: null });
    mockGetPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.test/${path}` },
    }));
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    const result = await StorageRepository.uploadListingImageAdditions('seller-1', 'listing-1', [
      photo('file:///a.jpg'),
      photo('file:///b.png'),
    ]);

    expect(result.paths).toEqual([
      'seller-1/listing-1/1700000000000-0.jpg',
      'seller-1/listing-1/1700000000000-0_thumb.jpg',
      'seller-1/listing-1/1700000000000-1.jpg',
      'seller-1/listing-1/1700000000000-1_thumb.jpg',
    ]);
    expect(result.urls).toHaveLength(2);
    expect(result.thumbUrls).toHaveLength(2);

    (Date.now as jest.Mock).mockRestore();
  });

  it('rolls back already-uploaded variants and throws an actionable error when a later upload fails', async () => {
    mockFetchResolving();
    mockUpload
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('mime type not allowed') });
    mockGetPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.test/${path}` },
    }));

    await expect(
      StorageRepository.uploadListingImageAdditions('seller-1', 'listing-1', [
        photo('file:///a.jpg'),
        photo('file:///b.jpg'),
      ]),
    ).rejects.toThrow('mime type not allowed');

    expect(mockRemove).toHaveBeenCalledTimes(1);
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
