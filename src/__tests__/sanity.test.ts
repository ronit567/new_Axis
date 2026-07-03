// Sanity test that proves the Jest + TypeScript harness works end to end.
// Intentionally dependency-light: a trivial pure helper, no React Native render.

/** Sum a list of numbers. Pure, deterministic, no side effects. */
function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe('test harness sanity', () => {
  it('runs TypeScript unit tests', () => {
    expect(sum([1, 2, 3, 4])).toBe(10);
  });

  it('handles the empty case', () => {
    expect(sum([])).toBe(0);
  });
});
