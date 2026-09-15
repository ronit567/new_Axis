import { getSellerBadges } from '../sellerBadges';

describe('getSellerBadges', () => {
  it('awards "Fast replier" for a minute- or hour-scale reply time', () => {
    expect(getSellerBadges({ replyTime: 'within an hour' })).toEqual([
      { icon: 'flash-outline', label: 'Fast replier' },
    ]);
  });

  it('awards no badge when the reply time is empty', () => {
    expect(getSellerBadges({ replyTime: '' })).toEqual([]);
  });

  it('does not treat a day-scale reply time as "Fast replier"', () => {
    expect(getSellerBadges({ replyTime: '2 days' })).toEqual([]);
  });
});
