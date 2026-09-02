// Must match `minimum_password_length` under [auth] in supabase/config.toml and
// the cloud project's Authentication -> Providers -> Email setting. Gating the
// UI on the same number the server enforces keeps a rejection from arriving
// *after* an irreversible step — see ResetPasswordScreen, where redeeming the
// recovery code signs the user in before the password is applied.
export const MIN_PASSWORD_LENGTH = 8;

export function isPasswordLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export const PASSWORD_LENGTH_HINT = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
