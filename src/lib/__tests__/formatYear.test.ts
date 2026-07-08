import { formatYearOfStudy } from '../formatYear';

describe('formatYearOfStudy', () => {
  it('labels numeric years as "Year N"', () => {
    expect(formatYearOfStudy(1)).toBe('Year 1');
    expect(formatYearOfStudy(4)).toBe('Year 4');
  });

  it('labels the Grad sentinel as "Grad", not "Year Grad"', () => {
    expect(formatYearOfStudy('Grad')).toBe('Grad');
  });
});
