import {
  sellerToContact,
  toContact,
  toConversation,
  toListing,
  toMessage,
  toNotification,
  toSeller,
  toSellerProfile,
} from '../mappers';
import type { ListingRow, MessageRow, NotificationRow, ProfileRow } from '../../types/database';
import type { Seller } from '../../types';

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

  it('surfaces a null year as the Grad sentinel, and defaults location/program', () => {
    const seller = toSeller({ ...sellerRow, year: null, location: null, program: null });
    // null year means a grad student — never coerce it to Year 1.
    expect(seller.year).toBe('Grad');
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

  it('passes image_urls through unchanged for imageUrls', () => {
    expect(toListing(listingRow, sellerRow, false).imageUrls).toEqual([]);
    const withPhotos = { ...listingRow, image_urls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'] };
    expect(toListing(withPhotos, sellerRow, false).imageUrls).toEqual([
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
    ]);
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
      location: 'Elgin Hall',
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

  it('defaults location to an empty string when null', () => {
    expect(toSellerProfile({ ...sellerRow, location: null }, stats).location).toBe('');
  });

  it('surfaces a null year as the Grad sentinel (no silent downgrade to Year 1)', () => {
    expect(toSellerProfile({ ...sellerRow, year: null }, stats).year).toBe('Grad');
    // A real numeric year passes through untouched.
    expect(toSellerProfile({ ...sellerRow, year: 3 }, stats).year).toBe(3);
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

// --- Messaging (AX-113) ------------------------------------------------------

const messageRow: MessageRow = {
  id: 'm1',
  listing_id: 'l1',
  sender_id: 's1',
  receiver_id: 'buyer-1',
  body: 'Is this still available?',
  created_at: '2026-07-01T10:00:00.000Z',
  read_at: null,
};

describe('toMessage', () => {
  it('maps a message row to the domain Message (snake_case -> camelCase)', () => {
    expect(toMessage(messageRow)).toEqual({
      id: 'm1',
      listingId: 'l1',
      senderId: 's1',
      receiverId: 'buyer-1',
      body: 'Is this still available?',
      createdAt: '2026-07-01T10:00:00.000Z',
      readAt: null,
    });
  });

  it('carries a non-null readAt through unchanged', () => {
    const read = toMessage({ ...messageRow, read_at: '2026-07-01T11:00:00.000Z' });
    expect(read.readAt).toBe('2026-07-01T11:00:00.000Z');
  });
});

describe('toContact', () => {
  it('uses the row initials/avatar_color when present', () => {
    expect(toContact(sellerRow)).toEqual({
      id: 's1',
      name: 'Aria K.',
      initials: 'AK',
      avatarColor: '#5C2D91',
    });
  });

  it('derives initials from name and a deterministic palette color when both are null', () => {
    const first = toContact({ ...sellerRow, initials: null, avatar_color: null, name: 'Liam' });
    expect(first.initials).toBe('L');
    expect(first.avatarColor).toMatch(/^#[0-9A-F]{6}$/i);
    const second = toContact({ ...sellerRow, initials: null, avatar_color: null, name: 'Liam' });
    expect(second.avatarColor).toBe(first.avatarColor); // same id => same color
  });
});

describe('sellerToContact', () => {
  const seller: Seller = {
    id: 's1',
    name: 'Aria K.',
    year: 2,
    location: 'Elgin Hall',
    program: 'Economics',
    dotColor: '#9E9EAE',
  };

  it('derives initials from the seller name', () => {
    expect(sellerToContact(seller)).toEqual({
      id: 's1',
      name: 'Aria K.',
      initials: 'AK',
      avatarColor: expect.stringMatching(/^#[0-9A-F]{6}$/i),
    });
  });

  it('gives the same id a stable color regardless of name', () => {
    const a = sellerToContact(seller).avatarColor;
    const b = sellerToContact({ ...seller, name: 'Different Name' }).avatarColor;
    expect(a).toBe(b); // color is seeded by id, not name
  });
});

describe('toConversation', () => {
  it('marks a conversation Selling when the joined listing belongs to the current user', () => {
    const conversation = toConversation({
      partner: sellerRow,
      listing: { ...listingRow, seller_id: 'me' },
      lastMessage: messageRow,
      unreadCount: 2,
      currentUserId: 'me',
    });
    expect(conversation.type).toBe('Selling');
    expect(conversation.listingTitle).toBe(listingRow.title);
    expect(conversation.listingPrice).toBe(listingRow.price);
    expect(conversation.unreadCount).toBe(2);
    expect(conversation.partnerId).toBe('s1');
    expect(conversation.partner).toEqual(toContact(sellerRow));
    expect(conversation.listingId).toBe(messageRow.listing_id);
    expect(conversation.lastMessage).toBe(messageRow.body);
  });

  it('marks a conversation Buying when the joined listing belongs to someone else', () => {
    const conversation = toConversation({
      partner: sellerRow,
      listing: { ...listingRow, seller_id: 'someone-else' },
      lastMessage: messageRow,
      unreadCount: 0,
      currentUserId: 'me',
    });
    expect(conversation.type).toBe('Buying');
  });

  it('nulls out listingTitle/listingPrice and defaults to Buying when the listing is missing', () => {
    const conversation = toConversation({
      partner: sellerRow,
      listing: null,
      lastMessage: messageRow,
      unreadCount: 0,
      currentUserId: 'me',
    });
    expect(conversation.listingTitle).toBeNull();
    expect(conversation.listingPrice).toBeNull();
    expect(conversation.type).toBe('Buying');
  });

  it('formats lastMessageAt through timeAgo', () => {
    const conversation = toConversation({
      partner: sellerRow,
      listing: listingRow,
      lastMessage: messageRow,
      unreadCount: 0,
      currentUserId: 'me',
    });
    expect(typeof conversation.lastMessageAt).toBe('string');
    expect(conversation.lastMessageAt.length).toBeGreaterThan(0);
    expect(conversation.lastMessageAt).toMatch(/ago|just now/);
  });
});

// --- Notifications (AX-601/602) ----------------------------------------------

const notificationRow: NotificationRow = {
  id: 'n1',
  user_id: 'me',
  type: 'message',
  actor_id: 's1',
  listing_id: 'l1',
  read: false,
  read_at: null,
  created_at: '2026-07-01T10:00:00.000Z',
};

describe('toNotification', () => {
  it('composes message copy with the listing title when both an actor and a listing are present', () => {
    const notification = toNotification({ row: notificationRow, actor: sellerRow, listing: listingRow });
    expect(notification.message).toBe(
      'Aria K. sent you a message about "Organic Chem 2 textbook"',
    );
  });

  it('composes message copy without a listing title when the notification has no listing', () => {
    const notification = toNotification({
      row: { ...notificationRow, listing_id: null },
      actor: sellerRow,
      listing: null,
    });
    expect(notification.message).toBe('Aria K. sent you a message');
  });

  it('composes listing_saved copy with the listing title', () => {
    const notification = toNotification({
      row: { ...notificationRow, type: 'listing_saved' },
      actor: sellerRow,
      listing: listingRow,
    });
    expect(notification.message).toBe(
      'Aria K. saved your listing "Organic Chem 2 textbook"',
    );
    expect(notification.type).toBe('listing_saved');
  });

  it("falls back to 'Someone' and a null actor when the actor profile is missing", () => {
    const notification = toNotification({ row: notificationRow, actor: null, listing: listingRow });
    expect(notification.actor).toBeNull();
    expect(notification.message).toBe(
      'Someone sent you a message about "Organic Chem 2 textbook"',
    );
  });

  it('passes read/createdAt/actorId/listingId through unchanged', () => {
    const notification = toNotification({
      row: { ...notificationRow, read: true },
      actor: sellerRow,
      listing: listingRow,
    });
    expect(notification.read).toBe(true);
    expect(notification.createdAt).toBe('2026-07-01T10:00:00.000Z');
    expect(notification.actorId).toBe('s1');
    expect(notification.listingId).toBe('l1');
  });

  it('formats timeAgo as a relative label', () => {
    const notification = toNotification({ row: notificationRow, actor: sellerRow, listing: listingRow });
    expect(typeof notification.timeAgo).toBe('string');
    expect(notification.timeAgo.length).toBeGreaterThan(0);
    expect(notification.timeAgo).toMatch(/ago|just now/);
  });
});
