import { describe, expect, it } from 'vitest';

import { standardUser } from '@/test/factories';

import { canAccessAdmin, type User } from './user';

const guest: User = { type: 'guest', id: 'g-1' };

describe(canAccessAdmin.name, () => {
  it('admits staff and admin, rejects pi/ngo/guest', () => {
    expect(canAccessAdmin(standardUser('staff'))).toBe(true);
    expect(canAccessAdmin(standardUser('admin'))).toBe(true);
    expect(canAccessAdmin(standardUser('pi'))).toBe(false);
    expect(canAccessAdmin(standardUser('ngo'))).toBe(false);
    expect(canAccessAdmin(guest)).toBe(false);
  });
});
