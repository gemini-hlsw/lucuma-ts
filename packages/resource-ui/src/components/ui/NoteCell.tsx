/** Wrapped, never truncated: a clipped note reads as the whole note. */
import type { JSX } from 'react';

export function NoteCell({ note }: { note: string | null }): JSX.Element | null {
  return note === null ? null : <span className="text-xs text-foreground-muted italic">{note}</span>;
}
