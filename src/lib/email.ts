// Signup only accepts these domains (see CreateAccountScreen); SetupProfile
// reuses the same check to set `profiles.verified`, so both stay in sync.
const WESTERN_EMAIL_DOMAINS = ['@uwo.ca', '@alumni.uwo.ca'] as const;

export function isWesternEmail(email: string): boolean {
  const normalized = email.toLowerCase();
  return WESTERN_EMAIL_DOMAINS.some(domain => normalized.endsWith(domain));
}
