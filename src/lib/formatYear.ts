// Display formatter for a student's year of study. Numeric years read as
// "Year N"; grad students (the 'Grad' sentinel, from a null DB year) read as
// "Grad" — never "Year Grad". Kept in one place so every profile surface that
// shows the year label stays consistent.

import type { YearOfStudy } from '../types';

export function formatYearOfStudy(year: YearOfStudy): string {
  return year === 'Grad' ? 'Grad' : `Year ${year}`;
}
