import { useMemo, useState } from 'react';

/**
 * Single-row selection for a filtered admin table (sc-10137). Untouched, it is
 * the first row; a selected row that `rows` no longer holds falls back to the
 * first row; an explicit deselect (`null`) selects nothing, so it never snaps
 * back. `rows` is the filtered list the table is given, in that order (a column
 * sort inside the table doesn't reorder it); rows match on `key`, the `dataKey`.
 */
export function useRowSelection<K extends string, T extends Readonly<Record<K, string>>>(
  rows: readonly T[],
  key: K,
): readonly [T | null, (id: string | null) => void] {
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);

  const selected = useMemo(
    () => (selectedId === null ? null : (rows.find((r) => r[key] === selectedId) ?? rows[0] ?? null)),
    [rows, key, selectedId],
  );

  return [selected, setSelectedId];
}
