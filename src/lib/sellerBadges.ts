// Earned trust badges for a seller — computed on the fly from live review/reply
// data, never stored. Both profile screens render whatever this returns; there
// is no badge table to keep in sync.

import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type SellerBadge = {
  icon: IoniconName;
  label: string;
};

type SellerBadgeInput = {
  averageRating: number;
  reviewCount: number;
  replyTime: string;
};

// Thresholds are product-tuned, not derived from any formula — adjust here if
// the bar for "trusted"/"fast" ever moves.
export function getSellerBadges({
  averageRating,
  reviewCount,
  replyTime,
}: SellerBadgeInput): SellerBadge[] {
  const badges: SellerBadge[] = [];

  if (averageRating >= 4.8 && reviewCount >= 5) {
    badges.push({ icon: 'shield-checkmark-outline', label: 'Trusted seller' });
  }

  // Reply times are free text (e.g. "within an hour", "2 days") — only
  // minute/hour-scale values qualify as "fast".
  if (replyTime && /min|hour/i.test(replyTime)) {
    badges.push({ icon: 'flash-outline', label: 'Fast replier' });
  }

  return badges;
}
