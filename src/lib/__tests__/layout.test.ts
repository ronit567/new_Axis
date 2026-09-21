import { CONTENT_MAX_WIDTH, gridColumnsFor } from '../layout';

// The column breakpoints are the part of iPad support that a later "tidy-up"
// is most likely to nudge without noticing what it does to a phone. The first
// case below is the one that must never move: every phone stays two-up.

describe('gridColumnsFor', () => {
  it('keeps every phone at two columns, up to the widest Pro Max', () => {
    // 320 is the narrowest iPad Split View pane; 440 is the largest phone.
    for (const width of [320, 375, 390, 393, 430, 440]) {
      expect(gridColumnsFor(width)).toBe(2);
    }
  });

  it('steps up across iPad portrait, landscape and the 13" in landscape', () => {
    expect(gridColumnsFor(744)).toBe(3); // iPad mini, portrait
    expect(gridColumnsFor(820)).toBe(3); // iPad Air 11", portrait
    expect(gridColumnsFor(1024)).toBe(4); // iPad 13", portrait
    expect(gridColumnsFor(1180)).toBe(4); // iPad Air 11", landscape
    expect(gridColumnsFor(1366)).toBe(5); // iPad 13", landscape
  });

  it('never decreases as the window widens', () => {
    // A resize that widens the window must not drop a column; a non-monotonic
    // table would make cards shrink as the window grew.
    let previous = 0;
    for (let width = 300; width <= 1500; width += 10) {
      const columns = gridColumnsFor(width);
      expect(columns).toBeGreaterThanOrEqual(previous);
      previous = columns;
    }
  });

  it('keeps a card at a usable width at every breakpoint', () => {
    // Roughly the grids' horizontal padding plus inter-card gaps. The point is
    // the order of magnitude: no step should produce thumbnail-sized cards or
    // single cards the width of a phone.
    const cardWidth = (w: number) => {
      const columns = gridColumnsFor(w);
      return (w - 40 - 12 * (columns - 1)) / columns;
    };
    for (const width of [600, 820, 900, 1024, 1200, 1366]) {
      expect(cardWidth(width)).toBeGreaterThan(170);
      expect(cardWidth(width)).toBeLessThan(300);
    }
  });
});

describe('CONTENT_MAX_WIDTH', () => {
  it('is wider than any phone, so a phone never sees margins', () => {
    expect(CONTENT_MAX_WIDTH).toBeGreaterThan(440);
  });
});
