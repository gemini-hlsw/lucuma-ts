/**
 * An instrument's identity outside a chart: its colour, then its name.
 *
 * Colour follows the instrument and nothing else (CLAUDE.md), which only holds
 * if every place that draws one reads the same map. The charts get theirs from
 * the point builder and the legend from `TimelineChart`; the two browsers drew
 * their own square, twice, from the same two hex-free tokens. This is that
 * square, once, beside the palette it reads.
 *
 * `aria-hidden` on the swatch, always: identity never rides on colour alone, so
 * the name beside it is the identity and the square is decoration.
 */
import { cn } from '@gemini-hlsw/lucuma-common-ui';
import type { JSX } from 'react';

import type { Instrument } from '@/domain/types';

import { INSTRUMENT_LABEL, instrumentColor } from './timelineOptions';

export interface InstrumentSwatchProps {
  readonly instrument: Instrument;
  /**
   * The name the schedule printed, when it differs from the instrument's own.
   * Shown small beside it, so "GMOS GMOS-N" reads as one instrument with two
   * names rather than two rows.
   */
  readonly publishedName?: string;
  /** Anything the page adds after the name - a count, a summary. */
  readonly children?: JSX.Element | string | false;
  /** Spacing the surrounding row wants; the layout itself is not negotiable. */
  readonly className?: string;
}

export function InstrumentSwatch({
  instrument,
  publishedName,
  children,
  className,
}: InstrumentSwatchProps): JSX.Element {
  const label = INSTRUMENT_LABEL[instrument];
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-[2px]"
        style={{ backgroundColor: instrumentColor(instrument) }}
      />
      <span className="font-semibold text-foreground">{label}</span>
      {publishedName !== undefined && publishedName !== label && (
        <span className="text-xs text-foreground-muted">{publishedName}</span>
      )}
      {children}
    </span>
  );
}
