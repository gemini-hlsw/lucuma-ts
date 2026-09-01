/** Mean synodic month, days. */
export const SYNODIC_DAYS = 29.530588853;

/** A reference new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14);

const MS_PER_DAY = 86_400_000;

export interface MoonPhase {
  /** Days since new moon, in [0, SYNODIC_DAYS). */
  readonly age: number;
  /** Illuminated fraction of the disc, in [0, 1]. */
  readonly fraction: number;
  /** True from new to full (lit side grows); false while waning. */
  readonly waxing: boolean;
}

/** Mean-synodic, within about half a day: a display aid, not an ephemeris. */
export const moonPhaseAt = (epochMillis: number): MoonPhase => {
  const days = (epochMillis - NEW_MOON_EPOCH_MS) / MS_PER_DAY;
  const age = ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
  const fraction = (1 - Math.cos((2 * Math.PI * age) / SYNODIC_DAYS)) / 2;
  return { age, fraction, waxing: age < SYNODIC_DAYS / 2 };
};

/** A human label for tooltips and aria, e.g. "Waxing gibbous, 62% illuminated". */
export const moonPhaseLabel = (phase: MoonPhase): string => {
  const percent = Math.round(phase.fraction * 100);
  const name =
    phase.fraction < 0.04
      ? 'New moon'
      : phase.fraction > 0.96
        ? 'Full moon'
        : phase.fraction < 0.46
          ? phase.waxing
            ? 'Waxing crescent'
            : 'Waning crescent'
          : phase.fraction > 0.54
            ? phase.waxing
              ? 'Waxing gibbous'
              : 'Waning gibbous'
            : phase.waxing
              ? 'First quarter'
              : 'Last quarter';
  return `${name}, ${percent}% illuminated`;
};
