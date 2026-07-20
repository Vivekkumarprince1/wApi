export function parseAdminGoogleSignupEmails(value?: string): ReadonlySet<string> {
  return new Set(
    String(value || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function adminGoogleSignupAllowed(
  email: string,
  allowedEmails: ReadonlySet<string>,
): boolean {
  return allowedEmails.has(email.trim().toLowerCase());
}
