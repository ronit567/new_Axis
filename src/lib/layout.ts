import { useWindowDimensions } from 'react-native';

/**
 * Width rules for iPad.
 *
 * Axis was designed for a phone, and as an iPhone-only app it ran on iPad in
 * the scaled compatibility mode. Supporting iPad natively means running at the
 * window's real width — and on iPadOS 26 that width is not a fixed set of
 * device sizes. UIRequiresFullScreen, the old way to opt out, is deprecated and
 * ignored on iPads with windowed apps (Apple TN3192): every iPad app must
 * handle all orientations and live resizing through Split View and Stage
 * Manager. A window can be anything from phone-narrow (~320pt) to a 13" iPad in
 * landscape (1366pt), and can change size while a screen is mounted.
 *
 * So layout keys off the live window width (`useWindowDimensions`, never a
 * `Dimensions.get` snapshot, which goes stale on resize) and nothing here
 * branches on "is this an iPad" — a narrow Split View on an iPad should look
 * like a phone, because it is phone-sized.
 */

/**
 * The widest a reading column gets. Text, forms, chat and settings stop being
 * comfortable to read well before 1366pt: a message bubble or a settings row
 * stretched edge to edge on a landscape iPad puts the label and its control a
 * head-turn apart. Past this width the content is centred with the page colour
 * either side.
 *
 * 720 leaves a portrait iPad Air (820pt) close to edge-to-edge and holds a
 * comfortable line length in landscape.
 */
export const CONTENT_MAX_WIDTH = 720;

/**
 * Bottom sheets (report, search filters) and centred dialogs (delete account).
 *
 * These are React Native `Modal`s, which render at the window level — outside
 * the reading column that `Screen` provides — so they need their own cap or
 * they span the whole iPad. A sheet is narrower than the reading column
 * because it holds a short list of choices rather than prose; a dialog is
 * narrower again, alert-sized, because it holds one decision. Both sit above
 * every phone width, so a phone is unchanged.
 */
export const SHEET_MAX_WIDTH = 560;
export const DIALOG_MAX_WIDTH = 420;

/**
 * The width a screen's content actually has: the window, capped at the reading
 * column. Anything that sizes itself from width inside a constrained screen —
 * a paging gallery, a thumbnail row — must use this rather than the window
 * width, or it computes against 1366pt while being laid out in 720 and pages
 * or wraps against the wrong number.
 */
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  return Math.min(width, CONTENT_MAX_WIDTH);
}

/**
 * Columns for a listing grid at a given window width.
 *
 * Breakpoints are chosen so a card lands roughly 230–280pt wide at every step,
 * which is what a phone's two-up grid already gives. Two columns covers every
 * phone (up to the 440pt Pro Max) and a narrow Split View; the steps above are
 * iPad portrait, iPad landscape / 13" portrait, and 13" landscape.
 */
export function gridColumnsFor(windowWidth: number): number {
  if (windowWidth < 600) return 2;
  if (windowWidth < 900) return 3;
  if (windowWidth < 1200) return 4;
  return 5;
}

/**
 * The live column count for a grid. A `FlatList` cannot change `numColumns` on
 * a mounted instance (it throws an invariant violation), so a grid using this
 * must also pass it as part of its `key`, forcing a fresh list when the window
 * crosses a breakpoint.
 */
export function useGridColumns(): number {
  const { width } = useWindowDimensions();
  return gridColumnsFor(width);
}
