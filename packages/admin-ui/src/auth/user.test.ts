import { describe, expect, it } from 'vitest';

import { standardUser } from '@/test/factories';

import { canAccessAdmin, displayName, type StandardUser, type User } from './user';

const guest: User = { type: 'guest', id: 'g-1' };
const service: User = { type: 'service', id: 's-1', name: 'scheduler' };

describe(canAccessAdmin.name, () => {
  it('admits staff and admin, rejects pi/ngo/guest', () => {
    expect(canAccessAdmin(standardUser('staff'))).toBe(true);
    expect(canAccessAdmin(standardUser('admin'))).toBe(true);
    expect(canAccessAdmin(standardUser('pi'))).toBe(false);
    expect(canAccessAdmin(standardUser('ngo'))).toBe(false);
    expect(canAccessAdmin(guest)).toBe(false);
  });
});

describe(displayName.name, () => {
  it('prefers given + family name', () => {
    expect(displayName(standardUser('pi'))).toBe('Ada Lovelace');
  });

  it('handles guest, service, and null', () => {
    expect(displayName(guest)).toBe('Guest User');
    expect(displayName(service)).toBe('Service User (scheduler)');
    expect(displayName(null)).toBe('Not signed in');
  });

  it('falls back to ORCID when no name is present', () => {
    const u: StandardUser = { ...standardUser('pi'), profile: { orcidId: '0000-9999', profile: {} } };
    expect(displayName(u)).toBe('0000-9999');
  });
});
