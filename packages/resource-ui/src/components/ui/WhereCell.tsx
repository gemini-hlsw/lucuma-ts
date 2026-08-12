/**
 * The "Where" cell both finders draw.
 *
 * `/components` asks where a piece is and `/instruments` asks where an
 * instrument is; the answer has the same three shapes either way - on the
 * telescope, somewhere off it, or nothing recorded - so it is drawn the same
 * way: a presence dot, the place in words, and a tag when the night changes it.
 *
 * It takes a reading rather than a row, which is the point. The instrument
 * browser used to carry its own copy of these three dots and this tag,
 * hand-rolled beside the component version, so a change to one silently left
 * the two tables looking like different tools. Each page maps its own domain row
 * onto `WhereReading` - `componentLabels.componentWhere`, `instrumentWhere` -
 * and the pixels live here once. (`componentCells.tsx` says what a second copy
 * of a label function once cost the chart and the grid; this is the same rule
 * one level up.)
 */
import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { Tag } from 'primereact/tag';
import type { JSX } from 'react';

/**
 * How present the subject is - all the dot draws, and deliberately coarser than
 * either finder's own `where` union: a filled dot means "on the telescope
 * tonight", an outlined one "recorded, but not on it", and an empty one
 * "nothing recorded", which is never "unavailable" (I4).
 */
export type Presence = 'ON_TELESCOPE' | 'OFF_TELESCOPE' | 'NOT_RECORDED';

export interface WhereReading {
  readonly presence: Presence;
  /** The place in the page's own words, e.g. "Port 3 · GMOS-S" or "Summit lab". */
  readonly label: string;
  /**
   * What the change tag says, or null when nothing changes tonight. The words
   * are the page's: the night view names the clock times, a browser just says
   * that it changes.
   */
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
