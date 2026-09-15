// Free and Trade listings are stored with price 0, so any surface that prints
// the raw number renders a giveaway as "$0" — and the offer prompt then invites
// a negotiation over it. Every price surface goes through here so the two flags
// can never again be captured, stored, and then silently dropped on the way out.

export type Priceable = {
  price: number;
  isFree?: boolean;
  isTrade?: boolean;
};

// Grouped dollars, cents only when the listing actually has them: $1,200 and
// $12.50, never $1200 or $1,200.00. toLocaleString rather than a module-scope
// Intl.NumberFormat because engines without full ICU drop the grouping instead
// of throwing at import.
export function formatAmount(price: number): string {
  const rounded = Math.round(price * 100) / 100;
  const cents = !Number.isInteger(rounded);
  return `$${rounded.toLocaleString('en-CA', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })}`;
}

export function formatPrice(listing: Priceable): string {
  if (listing.isFree) return 'Free';
  if (listing.isTrade) return 'Trade';
  return formatAmount(listing.price);
}

// The Free/Trade label when there is one, for callers that want to render it
// as a badge beside the price rather than in place of it.
export function priceBadge(listing: Priceable): string | null {
  if (listing.isFree) return 'Free';
  if (listing.isTrade) return 'Trade';
  return null;
}

// A giveaway has no price to haggle over, so the offer action is hidden for it.
// Trades keep the action — "what would you want for it" is a real question.
export function acceptsOffers(listing: Priceable): boolean {
  return !listing.isFree;
}

// Prefilled first message to a seller. Only a priced listing mentions a number.
export function enquiryMessage(listing: Priceable & { title: string }): string {
  if (listing.isFree) {
    return `Hi! Is your "${listing.title}" still available?`;
  }
  if (listing.isTrade) {
    return `Hi! I'm interested in your "${listing.title}". What are you looking to trade for?`;
  }
  return `Hi! I'm interested in your "${listing.title}" (${formatPrice(listing)}). Would you consider an offer?`;
}

export function shareMessage(listing: Priceable & { title: string }): string {
  return `${listing.title} — ${formatPrice(listing)} on Axis`;
}
