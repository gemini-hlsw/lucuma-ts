import { describe, expect, it } from 'vitest';

import {
  BAND_LABEL,
  BANDS,
  INSTRUMENT_LABEL,
  INSTRUMENTS,
  NO_CEILING_OPTION,
  TOO_LABEL,
  TOO_STATUSES,
  tooCeilingFromOption,
  tooCeilingToOption,
} from './types';

describe('INSTRUMENTS', () => {
  it('lists the complete Instrument enum in display-label order', () => {
    expect(INSTRUMENTS).toHaveLength(Object.keys(INSTRUMENT_LABEL).length);
    const labels = INSTRUMENTS.map((i) => INSTRUMENT_LABEL[i]);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    // Sorted by label, not enum value: "Acq Cam North" leads, "Zorro" closes.
    expect(INSTRUMENTS[0]).toBe('ACQ_CAM_NORTH');
    expect(INSTRUMENTS[INSTRUMENTS.length - 1]).toBe('ZORRO');
  });
});

describe('option lists', () => {
  it('cover their enums with human labels', () => {
    expect(BANDS.map((b) => BAND_LABEL[b])).toEqual(['Band-1', 'Band-2', 'Band-3', 'Band-4']);
    expect(TOO_STATUSES.map((t) => TOO_LABEL[t])).toEqual(['None', 'Rapid', 'Interrupting']);
  });
});

describe('ToO ceiling dropdown options', () => {
  it('round-trips every ceiling, null included, through a string option', () => {
    for (const ceiling of [null, ...TOO_STATUSES]) {
      expect(tooCeilingFromOption(tooCeilingToOption(ceiling))).toBe(ceiling);
    }
  });

  it('never hands the dropdown a null value, which PrimeReact mishandles', () => {
    expect(tooCeilingToOption(null)).toBe(NO_CEILING_OPTION);
  });
});
