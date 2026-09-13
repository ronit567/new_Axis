import {
  MIN_PASSWORD_LENGTH,
  isPasswordAcceptable,
  PASSWORD_HINT,
  passwordProblem,
} from '../password';

describe('isPasswordAcceptable', () => {
  it('matches the server rules configured in supabase/config.toml', () => {
    // If this fails, minimum_password_length changed and the UI gate is now out
    // of step with what the server will actually accept. The companion setting
    // is password_requirements = "letters_digits", covered by the cases below.
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it('rejects passwords shorter than the minimum', () => {
    expect(isPasswordAcceptable('')).toBe(false);
    expect(isPasswordAcceptable('abc1')).toBe(false);
    // The old minimum, now one short of the new one.
    expect(isPasswordAcceptable('abcde1')).toBe(false);
    expect(isPasswordAcceptable('abcdef1')).toBe(false);
  });

  it('accepts a password exactly at the minimum', () => {
    expect(isPasswordAcceptable('abcdefg1')).toBe(true);
  });

  it('requires a digit, however long the password is', () => {
    expect(isPasswordAcceptable('a-much-longer-passphrase')).toBe(false);
    expect(isPasswordAcceptable('a-much-longer-passphrase-2')).toBe(true);
  });

  it('requires a letter, however long the password is', () => {
    expect(isPasswordAcceptable('12345678')).toBe(false);
    expect(isPasswordAcceptable('1234567a')).toBe(true);
  });

  it('accepts either case for the letter', () => {
    expect(isPasswordAcceptable('ABCDEFG1')).toBe(true);
    expect(isPasswordAcceptable('abcdefg1')).toBe(true);
  });

  it('counts only ASCII letters and digits, as GoTrue does', () => {
    // The whole point of mirroring the server: a non-ASCII letter or digit does
    // NOT satisfy GoTrue's letters_digits groups, so it must not satisfy ours
    // either — otherwise the client waves through a password the server then
    // rejects, which on ResetPasswordScreen happens after the code is spent.
    expect(isPasswordAcceptable('ééééééé1')).toBe(false); // no ASCII letter
    expect(isPasswordAcceptable('abcdefg١')).toBe(false); // Arabic-Indic digit
    expect(isPasswordAcceptable('ééééééa1')).toBe(true); // one ASCII letter is enough
  });

  it('counts whitespace and symbols toward length, which are legal', () => {
    // Deliberately not trimmed: signUp()/updateUser() receive the raw string,
    // so trimming here would accept a password the server then stores as-is.
    expect(isPasswordAcceptable('a1      ')).toBe(true);
    expect(isPasswordAcceptable('a1!@#$%^')).toBe(true);
  });
});

describe('passwordProblem', () => {
  it('returns nothing for an acceptable password', () => {
    expect(passwordProblem('abcdefg1')).toBeUndefined();
  });

  it('names the length shortfall first, and states the minimum', () => {
    expect(passwordProblem('abc1')).toContain(String(MIN_PASSWORD_LENGTH));
    // Length is the problem to fix first even when a class is also missing, so
    // the user is not told to add a digit to a password that is too short to
    // submit anyway.
    expect(passwordProblem('abc')).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it('asks for the missing character class once the length is met', () => {
    expect(passwordProblem('12345678')).toMatch(/letter/i);
    expect(passwordProblem('abcdefgh')).toMatch(/number/i);
  });

  it('agrees with isPasswordAcceptable on every case', () => {
    const cases = [
      '',
      'abc',
      'abcdefg1',
      'abcdefgh',
      '12345678',
      'ééééééé1',
      'a-much-longer-passphrase',
    ];
    for (const password of cases) {
      expect(passwordProblem(password) === undefined).toBe(
        isPasswordAcceptable(password),
      );
    }
  });
});

describe('PASSWORD_HINT', () => {
  it('states the minimum and both character classes up front', () => {
    expect(PASSWORD_HINT).toContain(String(MIN_PASSWORD_LENGTH));
    expect(PASSWORD_HINT).toMatch(/letter/i);
    expect(PASSWORD_HINT).toMatch(/number/i);
  });
});
