import { describe, expect, it } from 'vitest';

import { standardUser } from '@/test/factories';

import { accessAtLeast, canAccessAdmin, currentAccess, displayName, type StandardUser, type User } from './user';

const guest: User = { type: 'guest', id: 'g-1' };
const service: User = { type: 'service', id: 's-1', name: 'scheduler' };

describe(currentAccess.name, () => {
  it('reads the active standard role', () => {
    expect(currentAccess(standardUser('staff'))).toBe('staff');
  });

  it('maps guest/service/null', () => {
    expect(currentAccess(guest)).toBe('guest');
    expect(currentAccess(service)).toBe('service');
    expect(currentAccess(null)).toBe('guest');
  });
});

describe('accessAtLeast (hierarchy guest<pi<ngo<staff<admin<service)', () => {
  it('staff meets the staff bar; pi does not', () => {
    expect(accessAtLeast(standardUser('staff'), 'staff')).toBe(true);
    expect(accessAtLeast(standardUser('pi'), 'staff')).toBe(false);
  });

  it('admin clears staff and admin bars', () => {
    expect(accessAtLeast(standardUser('admin'), 'staff')).toBe(true);
    expect(accessAtLeast(standardUser('admin'), 'admin')).toBe(true);
  });

  it('service outranks everything', () => {
    expect(accessAtLeast(service, 'admin')).toBe(true);
  });
});

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
