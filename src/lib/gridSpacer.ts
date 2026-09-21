/**
 * Padding for the two-column listing grids (Home, Search, Saved, seller
 * profile).
 *
 * A `FlatList` with `numColumns={2}` gives a lone trailing item a row of its
 * own, and every grid cell is `flex: 1` — with nothing to share that row with,
 * the last card of an odd-length list grows to the full page width and takes
 * its image with it. Appending one invisible spacer cell gives that card a
 * partner, so it keeps its normal half width and stays in the left column.
 *
 * An even-length list is returned as-is (same array reference), so a full row
 * — and the gutter inside it — renders exactly as it did before.
 */

export const GRID_SPACER_ID = '__grid-spacer__';

export type GridSpacer = { id: typeof GRID_SPACER_ID };

const GRID_SPACER: GridSpacer = { id: GRID_SPACER_ID };

export function withGridSpacer<T>(items: T[]): (T | GridSpacer)[] {
  return items.length % 2 === 0 ? items : [...items, GRID_SPACER];
}

/** Narrows a grid row to the spacer, so a screen renders an empty cell for it. */
export function isGridSpacer(item: unknown): item is GridSpacer {
  return (item as GridSpacer | null | undefined)?.id === GRID_SPACER_ID;
}
