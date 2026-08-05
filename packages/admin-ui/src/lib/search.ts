/**
 * Case-insensitive substring matching for the admin tables' text filters and
 * type-aheads. One definition so every view filters identically (Programs and
 * Users tables, the contact-scientist type-ahead) and a change to the matching
 * rule lands in a single place.
 */

/** Normalize a query for comparison: trimmed and lower-cased. */
function normalize(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Whether any of `fields` contains `query` (case-insensitive, substring). An
 * empty or whitespace-only query matches everything, so callers can pass the
 * raw input straight through without a separate "is the box empty?" branch.
 * Nullish fields are skipped.
 */
export function matchesQuery(fields: readonly (string | null | undefined)[], query: string): boolean {
  const text = normalize(query);
  if (text === '') return true;
  return fields.some((f) => f?.toLowerCase().includes(text) ?? false);
}
