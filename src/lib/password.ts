// Must match `minimum_password_length` and `password_requirements` under [auth]
// in supabase/config.toml and the cloud project's Authentication -> Providers ->
// Email settings. Gating the UI on the same rules the server enforces keeps a
// rejection from arriving *after* an irreversible step — see
// ResetPasswordScreen, where redeeming the recovery code signs the user in
// before the password is applied.
export const MIN_PASSWORD_LENGTH = 8;

// GoTrue's `letters_digits` preset, which is what `password_requirements` is set
// to. It requires at least one character from each of two ASCII groups, and it
// really is ASCII-only: `é` is not a letter to it and `٣` is not a digit. So
// these are deliberately `[A-Za-z]` and `[0-9]` rather than `\p{L}` and `\d`
// with the unicode flag — a looser client test would accept `ééééééé١` here and
// let the server reject it a moment later, which is the failure this module
// exists to prevent.
const HAS_ASCII_LETTER = /[A-Za-z]/;
const HAS_ASCII_DIGIT = /[0-9]/;

/**
 * Whether the server will accept this password. Length is measured in UTF-16
 * code units while GoTrue counts bytes, so a non-ASCII password can only ever
 * look *shorter* here than it does to the server — the mismatch can reject a
 * password the server would have taken, never the reverse.
 */
export function isPasswordAcceptable(password: string): boolean {
  return (
    password.length >= MIN_PASSWORD_LENGTH &&
    HAS_ASCII_LETTER.test(password) &&
    HAS_ASCII_DIGIT.test(password)
  );
}

// Shown before the user has typed anything, so the requirements are known up
// front rather than discovered by failing.
export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters, including a letter and a number.`;

/**
 * The one thing to fix next, or undefined if the password is fine. Naming the
 * specific shortfall beats restating the whole rule: someone who typed twelve
 * letters needs to hear "add a number", not to re-read the character count they
 * already satisfied.
 */
export function passwordProblem(password: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!HAS_ASCII_LETTER.test(password)) return 'Add a letter (a–z or A–Z).';
  if (!HAS_ASCII_DIGIT.test(password)) return 'Add a number (0–9).';
  return undefined;
}
