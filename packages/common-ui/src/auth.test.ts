import { accessAtLeast, currentAccess, type StandardRole, type User } from './auth.ts';

const guest: User = { type: 'guest', id: 'g-1' };
const service: User = { type: 'service', id: 's-1', name: 'scheduler' };
const withRole = (type: StandardRole['type']): User => ({
  type: 'standard',
  id: 'u-1',
  role: { type, id: 'r-1' },
  otherRoles: [],
  profile: { orcidId: '0000-0001', profile: {} },
});

describe(currentAccess.name, () => {
  it('reads the active standard role', () => {
    expect(currentAccess(withRole('staff'))).toBe('staff');
  });

  it('maps guest/service/null', () => {
    expect(currentAccess(guest)).toBe('guest');
    expect(currentAccess(service)).toBe('service');
    expect(currentAccess(null)).toBe('guest');
  });
});

describe('accessAtLeast (hierarchy guest<pi<ngo<staff<admin<service)', () => {
  it('staff meets the staff bar; pi does not', () => {
    expect(accessAtLeast(withRole('staff'), 'staff')).toBe(true);
    expect(accessAtLeast(withRole('pi'), 'staff')).toBe(false);
  });

  it('admin clears staff and admin bars', () => {
    expect(accessAtLeast(withRole('admin'), 'staff')).toBe(true);
    expect(accessAtLeast(withRole('admin'), 'admin')).toBe(true);
  });

  it('service outranks everything', () => {
    expect(accessAtLeast(service, 'admin')).toBe(true);
  });
});
