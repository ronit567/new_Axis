import { withGridSpacer, isGridSpacer, GRID_SPACER_ID } from '../gridSpacer';

// The grids are FlatLists with `numColumns`: a short last row leaves its cards
// with the row to themselves, where `flex: 1` stretches them across it. These
// assertions pin the fix — that a short row is filled out with exactly enough
// spacer cells, and that a list which already fills its last row (every full
// row's gutters) is left completely alone. The column count defaults to 2 (a
// phone) and runs to 5 on a landscape iPad.

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

describe('withGridSpacer across column counts', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `listing-${i}` }));

  it('fills a short last row with exactly columns - remainder spacers', () => {
    // 7 cards in 3 columns: rows of 3, 3, 1 — the last row needs 2 more.
    const padded = withGridSpacer(rows(7), 3);

    expect(padded).toHaveLength(9);
    expect(padded.slice(7).every(isGridSpacer)).toBe(true);
  });

  it('pads to the widest iPad grid', () => {
    // 6 cards in 5 columns: a full row, then 1 card needing 4 spacers.
    const padded = withGridSpacer(rows(6), 5);

    expect(padded).toHaveLength(10);
    expect(padded.filter(isGridSpacer)).toHaveLength(4);
  });

  it('gives every spacer in a row its own id', () => {
    // FlatList keys cells by id. Two spacers sharing one would make React drop
    // or reuse the wrong cell — the failure a single fixed spacer id had once
    // a row could need more than one.
    const spacerIds = withGridSpacer(rows(1), 5)
      .filter(isGridSpacer)
      .map((item) => item.id);

    expect(spacerIds).toHaveLength(4);
    expect(new Set(spacerIds).size).toBe(4);
  });

  it('leaves a list that fills its last row untouched, at any column count', () => {
    for (const columns of [2, 3, 4, 5]) {
      const items = rows(columns * 2);
      expect(withGridSpacer(items, columns)).toBe(items);
    }
  });

  it('defaults to two columns, matching every phone', () => {
    expect(withGridSpacer(rows(3))).toHaveLength(4);
  });
});

describe('isGridSpacer', () => {
  it('tells the spacer apart from a real listing row', () => {
    expect(isGridSpacer({ id: GRID_SPACER_ID })).toBe(true);
    expect(isGridSpacer({ id: 'listing-1' })).toBe(false);
  });
});
