/** Turn an Apollo/network error into a short, human message for a badge or
 *  toast. The raw messages (JWT internals, fetch errors) aren't actionable
 *  for reviewers. */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/access denied/i.test(msg)) return 'Access denied for this token’s role.';
  if (/jwt|expired|signature|401|unauthor/i.test(msg)) return 'Token expired or invalid — sign in again.';
  if (/failed to fetch|networkerror|econnrefused/i.test(msg)) return 'The ODB is unreachable.';
  return msg.slice(0, 120);
}
