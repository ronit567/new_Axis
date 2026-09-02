import {
  MIN_PASSWORD_LENGTH,
  isPasswordLongEnough,
  PASSWORD_LENGTH_HINT,
} from '../password';

describe('isPasswordLongEnough', () => {
  it('matches the server minimum configured in supabase/config.toml', () => {
    // If this fails, minimum_password_length changed and the UI gate is now
    // out of step with what the server will actually accept.
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it('rejects passwords shorter than the minimum', () => {
    expect(isPasswordLongEnough('')).toBe(false);
    expect(isPasswordLongEnough('abc')).toBe(false);
    expect(isPasswordLongEnough('abcdefg')).toBe(false);
  });

  it('accepts a password exactly at the minimum', () => {
    expect(isPasswordLongEnough('abcdefgh')).toBe(true);
  });

  it('accepts longer passwords', () => {
    expect(isPasswordLongEnough('a-much-longer-passphrase')).toBe(true);
  });

  it('counts whitespace, which is legal in a password', () => {
    // Deliberately not trimmed: signUp()/updateUser() receive the raw string,
    // so trimming here would accept a password the server then stores as-is.
    expect(isPasswordLongEnough('a       ')).toBe(true);
  });

  it('states the minimum in the hint shown to users', () => {
    expect(PASSWORD_LENGTH_HINT).toContain(String(MIN_PASSWORD_LENGTH));
  });
});
