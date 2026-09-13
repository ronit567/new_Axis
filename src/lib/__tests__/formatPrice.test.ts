import {
  formatAmount,
  formatPrice,
  priceBadge,
  acceptsOffers,
  enquiryMessage,
  shareMessage,
} from '../formatPrice';

const priced = { title: 'Desk lamp', price: 1200, isFree: false, isTrade: false };
const free = { title: 'Desk lamp', price: 0, isFree: true, isTrade: false };
const trade = { title: 'Desk lamp', price: 0, isFree: false, isTrade: true };

describe('formatAmount', () => {
  it('groups thousands', () => {
    expect(formatAmount(1200)).toBe('$1,200');
    expect(formatAmount(1234567)).toBe('$1,234,567');
  });

  it('omits cents when there are none', () => {
    expect(formatAmount(45)).toBe('$45');
    expect(formatAmount(0)).toBe('$0');
  });

  it('shows cents when the price has them', () => {
    expect(formatAmount(12.5)).toBe('$12.50');
    expect(formatAmount(1200.99)).toBe('$1,200.99');
  });
});

describe('formatPrice', () => {
  it('never renders a free or trade listing as a number', () => {
    expect(formatPrice(free)).toBe('Free');
    expect(formatPrice(trade)).toBe('Trade');
  });

  it('prefers Free when a listing is somehow flagged both', () => {
    expect(formatPrice({ price: 0, isFree: true, isTrade: true })).toBe('Free');
  });

  it('formats a priced listing', () => {
    expect(formatPrice(priced)).toBe('$1,200');
  });

  it('treats missing flags as a priced listing', () => {
    expect(formatPrice({ price: 60 })).toBe('$60');
  });
});

describe('priceBadge', () => {
  it('labels free and trade, and nothing else', () => {
    expect(priceBadge(free)).toBe('Free');
    expect(priceBadge(trade)).toBe('Trade');
    expect(priceBadge(priced)).toBeNull();
  });
});

describe('acceptsOffers', () => {
  it('hides the offer action only for giveaways', () => {
    expect(acceptsOffers(free)).toBe(false);
    expect(acceptsOffers(trade)).toBe(true);
    expect(acceptsOffers(priced)).toBe(true);
  });
});

describe('enquiryMessage', () => {
  it('never quotes a price at a free or trade listing', () => {
    expect(enquiryMessage(free)).not.toMatch(/\$/);
    expect(enquiryMessage(trade)).not.toMatch(/\$/);
  });

  it('asks about availability for a giveaway', () => {
    expect(enquiryMessage(free)).toBe('Hi! Is your "Desk lamp" still available?');
  });

  it('quotes the formatted price for a priced listing', () => {
    expect(enquiryMessage(priced)).toContain('($1,200)');
  });
});

describe('shareMessage', () => {
  it('shares the label, not a zero', () => {
    expect(shareMessage(free)).toBe('Desk lamp — Free on Axis');
    expect(shareMessage(trade)).toBe('Desk lamp — Trade on Axis');
    expect(shareMessage(priced)).toBe('Desk lamp — $1,200 on Axis');
  });
});
