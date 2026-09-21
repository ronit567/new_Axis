/**
 * Padding for the listing grids (Home, Search, Saved, seller profile).
 *
 * A `FlatList` with `numColumns` gives a short trailing row cells of its own,
 * and every grid cell is `flex: 1` — with nothing to share that row with, the
 * last cards of the list grow to fill it and take their images with them.
 * Appending invisible spacer cells fills the row out, so every real card keeps
 * its normal width and the trailing ones stay left-aligned.
 *
 * The column count is not fixed: on iPad the grids run 3–5 across depending on
 * the window width (see `gridColumnsFor` in ./layout), and iPadOS resizes that
 * window live. So the padding is computed per call, and a row can need anything
 * from 0 to `columns - 1` spacers.
 *
 * A list that already fills its last row is returned as-is (same array
 * reference), so a full row — and the gutters inside it — renders exactly as
 * it did before.
 */

// A prefix, not a whole id. Spacers are rendered through the same keyExtractor
// as real rows, and two cells with one key make React drop or reuse the wrong
// one — so a row needing three spacers needs three distinct ids. Listing ids
// are UUIDs and can never begin with this.
export const GRID_SPACER_ID = '__grid-spacer__';

export type GridSpacer = { id: `${typeof GRID_SPACER_ID}${string}` };

export function withGridSpacer<T>(items: T[], columns = 2): (T | GridSpacer)[] {
  const remainder = items.length % columns;
  // An empty list stays empty so the empty state still renders; a full last
  // row needs nothing.
  if (items.length === 0 || remainder === 0) return items;

  const spacers: GridSpacer[] = Array.from({ length: columns - remainder }, (_, i) => ({
    id: `${GRID_SPACER_ID}${i}`,
  }));
  return [...items, ...spacers];
}

/** Narrows a grid row to a spacer, so a screen renders an empty cell for it. */
export function isGridSpacer(item: unknown): item is GridSpacer {
  const id = (item as { id?: unknown } | null | undefined)?.id;
  return typeof id === 'string' && id.startsWith(GRID_SPACER_ID);
}
