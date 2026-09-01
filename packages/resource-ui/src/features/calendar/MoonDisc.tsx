/** Waxing is lit on the right, waning on the left; the terminator is a semi-ellipse. */
import type { JSX } from 'react';

import { type MoonPhase, moonPhaseLabel } from '@/domain/moon';

interface MoonDiscProps {
  phase: MoonPhase;
  /** Rendered size in pixels. */
  size?: number;
  className?: string;
}

export function MoonDisc({ phase, size = 12, className }: MoonDiscProps): JSX.Element {
  const r = 8;
  const c = 8;
  // Terminator semi-ellipse: full radius at new/full, zero at the quarters.
  const rx = Math.abs(Math.cos(Math.PI * phase.fraction)) * r;
  // The terminator bows toward or away from the lit side depending on crescent or gibbous.
  const litRight = phase.waxing;
  const halfSweep = litRight ? 1 : 0;
  const bulge = phase.fraction < 0.5 ? halfSweep : 1 - halfSweep;
  const label = moonPhaseLabel(phase);

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      data-testid="moon-disc"
      className={className}
    >
      <title>{label}</title>
      <circle cx={c} cy={c} r={r} fill="var(--moon-dark, #33343d)" />
      <path
        d={`M ${c} ${c - r} A ${r} ${r} 0 0 ${halfSweep} ${c} ${c + r} A ${rx} ${r} 0 0 ${bulge} ${c} ${c - r} Z`}
        fill="var(--moon-lit, #ded9c3)"
      />
      <circle cx={c} cy={c} r={r - 0.25} fill="none" stroke="var(--moon-rim, #00000055)" strokeWidth="0.5" />
    </svg>
  );
}
