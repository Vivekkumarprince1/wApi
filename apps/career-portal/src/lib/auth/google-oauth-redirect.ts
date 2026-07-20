export const CAREER_ACCOUNT_HOME = "/my-applications";

export function googleOAuthCallbackURL(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : CAREER_ACCOUNT_HOME;
}

export function googleOAuthNewUserCallbackURL(): string {
  return CAREER_ACCOUNT_HOME;
}
