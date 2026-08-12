/**
 * A record's own words, in their own column.
 *
 * The note used to ride under the status badge, which made that cell two things
 * at once and left the note unscannable - it began at a different x on every
 * row, and no heading said what it was (Dan, 2026-08-12). Every table that
 * carries records carries this column: the two browsers, their expansions, and
 * the night's component table.
 *
 * **Wrapped, never truncated or scrolled.** A note is prose - "Failed; removed
 * for repair", "Visitor: Subaru" - and a clipped note reads as the whole note,
 * which is the one failure a record's own words must not have. A cell that
 * scrolls sideways under the mouse hides its tail the same way and is harder to
 * work; a row two lines tall costs nothing. It is the last column everywhere,
 * so it takes the table's slack and only wraps where there is no width left.
 */
import type { JSX } from 'react';

export function NoteCell({ note }: { note: string | null }): JSX.Element | null {
  return note === null ? null : <span className="text-xs text-foreground-muted italic">{note}</span>;
}
