import { standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { describe, expect, it } from 'vitest';

import { canAccessAdmin, type User } from './user';

const guest: User = { type: 'guest', id: 'g-1' };

describe(canAccessAdmin, () => {
  it('admits staff and admin, rejects pi/ngo/guest', () => {
    expect(canAccessAdmin(standardUser('staff'))).toBe(true);
    expect(canAccessAdmin(standardUser('admin'))).toBe(true);
    expect(canAccessAdmin(standardUser('pi'))).toBe(false);
    expect(canAccessAdmin(standardUser('ngo'))).toBe(false);
    expect(canAccessAdmin(guest)).toBe(false);
  });
});
