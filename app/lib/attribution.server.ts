// Best-effort attribution of who triggered a manual run. Shopify only reliably
// exposes staff identity via online access tokens (Plus-tier Users API for full
// detail) — for apps running on offline tokens, session.firstName/lastName/email
// are only populated when Shopify happens to include them. We read them if present
// and fall back cleanly rather than guess or fake a name.
export function getActingUserName(session: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const first = session.firstName?.trim();
  const last = session.lastName?.trim();
  if (first || last) {
    return [first, last].filter(Boolean).join(" ");
  }
  if (session.email) return session.email;
  return "Unknown user";
}
