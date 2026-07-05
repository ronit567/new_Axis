import { isWesternEmail } from '../email';

describe('isWesternEmail', () => {
  it('accepts @uwo.ca and @alumni.uwo.ca', () => {
    expect(isWesternEmail('rsharma42@uwo.ca')).toBe(true);
    expect(isWesternEmail('rsharma42@alumni.uwo.ca')).toBe(true);
  });

  it('rejects other domains', () => {
    expect(isWesternEmail('rsharma42@gmail.com')).toBe(false);
    expect(isWesternEmail('rsharma42@test.uwo.ca.evil.com')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isWesternEmail('rsharma42@UWO.CA')).toBe(true);
    expect(isWesternEmail('RSharma42@Alumni.Uwo.Ca')).toBe(true);
  });
});
