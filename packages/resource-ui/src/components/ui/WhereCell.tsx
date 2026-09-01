import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { Tag } from 'primereact/tag';
import type { JSX } from 'react';

/** Coarser than either finder's own `where` union; an empty dot is never "unavailable" (I4). */
export type Presence = 'ON_TELESCOPE' | 'OFF_TELESCOPE' | 'NOT_RECORDED';

export interface WhereReading {
  readonly presence: Presence;
  /** The place in the page's own words, e.g. "Port 3 · GMOS-S" or "Summit lab". */
  readonly label: string;
  /** Null when nothing changes tonight. The words are the page's. */
  readonly changes: string | null;
}

const DOT = {
  ON_TELESCOPE: 'bg-gpp',
  OFF_TELESCOPE: 'border border-subtle bg-transparent',
  NOT_RECORDED: 'bg-transparent',
} satisfies Record<Presence, string>;

export function WhereCell({ where }: { where: WhereReading }): JSX.Element {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className={cn('inline-block h-2 w-2 rounded-full', DOT[where.presence])} />
      <span className={where.presence === 'NOT_RECORDED' ? 'text-foreground-muted italic' : ''}>{where.label}</span>
      {where.changes !== null && <Tag value={where.changes} severity="warning" className="!text-[0.6rem]" />}
    </span>
  );
}
