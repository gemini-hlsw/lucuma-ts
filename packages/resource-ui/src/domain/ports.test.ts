import { describe, expect, it } from 'vitest';

import { portRowLabel, portRows, TELESCOPE_PORTS } from './ports';

describe(portRows, () => {
  it('draws every port the telescope has, whatever the records happen to name', () => {
    // A quiet port keeps its row: blank is "nothing recorded" (I4), a missing row denies the port.
    expect(portRows([3, null, 3])).toEqual(TELESCOPE_PORTS);
  });

  it('adds a port the records name that the telescope constant does not', () => {
    // A record must never fall between the rows: a sixth port would draw, not vanish.
    expect(portRows([6, 1])).toEqual([...TELESCOPE_PORTS, 6]);
  });

  it('drops the off-port records, which belong to no row', () => {
    expect(portRows([null, null])).toEqual(TELESCOPE_PORTS);
  });
});

describe(portRowLabel, () => {
  it('labels a port the way every view prints it', () => {
    expect(portRowLabel(3)).toBe('Port 3');
  });
});
