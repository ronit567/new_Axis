import { toListing, toSeller, toSellerProfile } from '../mappers';
import type { ListingRow, ProfileRow } from '../../types/database';

const sellerRow: ProfileRow = {
  id: 's1',
  name: 'Aria K.',
  initials: 'AK',
  program: 'BMOS',
  bio: 'Loves campus food.',
  year: 2,
  location: 'Elgin Hall',
  avatar_url: null,
  avatar_color: '#5C2D91',
  verified: true,
  reply_time: '~1h',
  created_at: '2024-09-15T10:00:00.000Z',
};

const listingRow: ListingRow = {
  id: 'l1',
  seller_id: 's1',
  title: 'Organic Chem 2 textbook',
  description: 'Great condition.',
  price: 45,
  is_free: false,
  is_trade: false,
  condition: 'Good',
  category: 'Textbooks',
  pickup: 'UCC, Room 110',
  image_urls: [],
  status: 'active',
  views: 22,
  created_at: '2026-06-29T12:00:00.000Z',
};

describe('toSeller', () => {
  it('maps a profile row to the lightweight nested Seller', () => {
    expect(toSeller(sellerRow)).toEqual({
      id: 's1',
      name: 'Aria K.',
      year: 2,
      location: 'Elgin Hall',
      program: 'BMOS',
      dotColor: '#9E9EAE',
    });
  });

  it('defaults null year, location, and program', () => {
    const seller = toSeller({ ...sellerRow, year: null, location: null, program: null });
    expect(seller.year).toBe(1);
    expect(seller.location).toBe('');
    expect(seller.program).toBe('');
  });
});

describe('toListing', () => {
  it('maps a full listing row + seller into a domain Listing', () => {
    const listing = toListing(listingRow, sellerRow, false);
    expect(listing).toMatchObject({
      id: 'l1',
      title: 'Organic Chem 2 textbook',
      price: 45,
      condition: 'Good',
      category: 'Textbooks',
      description: 'Great condition.',
      views: 22,
      pickup: 'UCC, Room 110',
      badge: null,
      saved: false,
    });
    expect(listing.seller).toEqual(toSeller(sellerRow));
    expect(typeof listing.postedAgo).toBe('string');
    expect(listing.postedAgo.length).toBeGreaterThan(0);
  });

  it('honours the isSaved flag from the caller', () => {
    expect(toListing(listingRow, sellerRow, true).saved).toBe(true);
    expect(toListing(listingRow, sellerRow, false).saved).toBe(false);
  });

  it('gives an empty image_urls listing a stable, deterministic imageColor', () => {
    const a = toListing(listingRow, sellerRow, false).imageColor;
    const b = toListing(listingRow, sellerRow, false).imageColor;
    expect(a).toBe(b); // same id => same color
    expect(a).toMatch(/^#[0-9A-F]{6}$/i);
    // Different id => independently stable (may or may not differ, but must be repeatable).
    const other = toListing({ ...listingRow, id: 'different-id' }, sellerRow, false).imageColor;
    expect(other).toBe(toListing({ ...listingRow, id: 'different-id' }, sellerRow, false).imageColor);
  });

  it('applies fallbacks for nullable DB columns', () => {
    const listing = toListing(
      { ...listingRow, condition: null, category: null, description: null, pickup: null },
      sellerRow,
      false,
    );
    expect(listing.condition).toBe('N/A');
    expect(listing.category).toBe('Other');
    expect(listing.description).toBe('');
    expect(listing.pickup).toBe('');
  });
});

describe('toSellerProfile', () => {
  const stats = { listings: 12, sold: 47, replyTime: '~1h' };

  it('maps a profile row + stats into a SellerProfile', () => {
    const profile = toSellerProfile(sellerRow, stats);
    expect(profile).toMatchObject({
      id: 's1',
      name: 'Aria K.',
      initials: 'AK',
      program: 'BMOS',
      bio: 'Loves campus food.',
      year: 2,
      verified: true,
      rating: 0,
      reviewCount: 0,
      avatarColor: '#5C2D91',
      stats,
    });
    expect(profile.joinedDate).toBe('Sep 2024');
  });

  it('defaults bio to an empty string when null', () => {
    expect(toSellerProfile({ ...sellerRow, bio: null }, stats).bio).toBe('');
  });

  it('derives initials from name when the column is null', () => {
    expect(toSellerProfile({ ...sellerRow, initials: null }, stats).initials).toBe('AK');
    expect(
      toSellerProfile({ ...sellerRow, initials: null, name: 'Liam' }, stats).initials,
    ).toBe('L');
  });

  it('falls back to a deterministic avatarColor when null', () => {
    const first = toSellerProfile({ ...sellerRow, avatar_color: null }, stats).avatarColor;
    const second = toSellerProfile({ ...sellerRow, avatar_color: null }, stats).avatarColor;
    expect(first).toBe(second);
    expect(first).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
