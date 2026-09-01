/** `aria-hidden` always: the name beside it is the identity and the square is decoration. */
import { cn } from '@gemini-hlsw/lucuma-common-ui';
import type { JSX } from 'react';

import type { Instrument } from '@/domain/types';

import { INSTRUMENT_LABEL, instrumentColor } from './timelineOptions';

interface InstrumentSwatchProps {
  readonly instrument: Instrument;
  /** Shown small beside it, so "GMOS GMOS-N" reads as one instrument with two names. */
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
