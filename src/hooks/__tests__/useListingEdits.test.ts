// photosChanged (0021): the pure order/local-photo/count diff used by
// EditListingScreen to decide whether the scam-vector fields (which include
// photos) actually changed. Same minimal-mock style as
// ListingEditRequestRepository.test.ts — importing the module transitively
// pulls in ../../lib/supabase, so it's mocked to a no-op stub.

jest.mock('../../lib/supabase', () => ({
  supabase: {},
}));

import { photosChanged, type EditablePhoto } from '../useListingEdits';

function photo(uri: string, isLocal = false): EditablePhoto {
  return { uri, mimeType: null, isLocal };
}

describe('photosChanged', () => {
  it('returns false when the URLs are the same, in the same order', () => {
    const original = ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'];
    const photos = original.map((uri) => photo(uri));

    expect(photosChanged(photos, original)).toBe(false);
  });

  it('returns true when a photo was removed (different length)', () => {
    const original = ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'];
    const photos = [photo(original[0])];

    expect(photosChanged(photos, original)).toBe(true);
  });

  it('returns true when any entry is a newly-picked local photo', () => {
    const original = ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'];
    const photos = [photo(original[0]), photo('file:///tmp/new.jpg', true)];

    expect(photosChanged(photos, original)).toBe(true);
  });

  it('returns true when the same set of URLs is in a different order', () => {
    const original = ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'];
    const photos = [photo(original[1]), photo(original[0])];

    expect(photosChanged(photos, original)).toBe(true);
  });
});
