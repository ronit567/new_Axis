// Earned trust badges for a seller — computed on the fly from live profile
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
  replyTime: string;
};

// Thresholds are product-tuned, not derived from any formula — adjust here if
// the bar for "fast" ever moves.
export function getSellerBadges({ replyTime }: SellerBadgeInput): SellerBadge[] {
  const badges: SellerBadge[] = [];

  // Reply times are free text (e.g. "within an hour", "2 days") — only
  // minute/hour-scale values qualify as "fast".
  if (replyTime && /min|hour/i.test(replyTime)) {
    badges.push({ icon: 'flash-outline', label: 'Fast replier' });
  }

  return badges;
}
