import { describe, expect, it } from 'vitest';

import { environmentLabel } from './environment';

describe(environmentLabel, () => {
  it('names every host it does not know as a development build', () => {
    // Fail loud: an unrecognised serving is not production until it is listed as one.
    expect(environmentLabel('localhost')).toBe('Development');
    expect(environmentLabel('resource-dev.lucuma.xyz')).toBe('Development');
  });
});
