import { getSellerBadges } from '../sellerBadges';

describe('getSellerBadges', () => {
  it('awards both badges when rating, review count, and reply time all qualify', () => {
    const badges = getSellerBadges({
      averageRating: 4.9,
      reviewCount: 8,
      replyTime: 'within an hour',
    });
    expect(badges).toEqual([
      { icon: 'shield-checkmark-outline', label: 'Trusted seller' },
      { icon: 'flash-outline', label: 'Fast replier' },
    ]);
  });

  it('awards neither badge when nothing qualifies', () => {
    expect(
      getSellerBadges({ averageRating: 3.5, reviewCount: 2, replyTime: '2 days' }),
    ).toEqual([]);
  });

  it('withholds "Trusted seller" when rating is high but review count is low', () => {
    const badges = getSellerBadges({ averageRating: 5, reviewCount: 2, replyTime: '' });
    expect(badges.find((b) => b.label === 'Trusted seller')).toBeUndefined();
  });

  it('does not treat a day-scale reply time as "Fast replier"', () => {
    const badges = getSellerBadges({ averageRating: 4.9, reviewCount: 8, replyTime: '2 days' });
    expect(badges.find((b) => b.label === 'Fast replier')).toBeUndefined();
  });
});
