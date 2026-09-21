import { withGridSpacer, isGridSpacer, GRID_SPACER_ID } from '../gridSpacer';

// The grids are two-column FlatLists: an odd item count leaves the last card
// alone in its row, where `flex: 1` stretches it across the full page width.
// These assertions pin the two halves of the fix — that an odd list gains
// exactly one spacer cell, and that an even list (every full row's gutters)
// is left completely alone.

describe('withGridSpacer', () => {
  it('appends one spacer to an odd-length list', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    const padded = withGridSpacer(items);

    expect(padded).toHaveLength(4);
    expect(padded.slice(0, 3)).toEqual(items);
    expect(isGridSpacer(padded[3])).toBe(true);
  });

  it('leaves an even-length list untouched, down to the array reference', () => {
    const items = [{ id: 'a' }, { id: 'b' }];

    expect(withGridSpacer(items)).toBe(items);
  });

  it('leaves an empty list empty, so the empty state still renders', () => {
    const items: { id: string }[] = [];

    expect(withGridSpacer(items)).toBe(items);
  });

  it('does not mutate the list it is given', () => {
    const items = [{ id: 'a' }];

    withGridSpacer(items);

    expect(items).toHaveLength(1);
  });
});

describe('isGridSpacer', () => {
  it('tells the spacer apart from a real listing row', () => {
    expect(isGridSpacer({ id: GRID_SPACER_ID })).toBe(true);
    expect(isGridSpacer({ id: 'listing-1' })).toBe(false);
  });
});
