import { describe, expect, it } from 'vitest';

import { friendlyError } from './errors';

describe(friendlyError.name, () => {
  it('translates auth failures into actionable messages', () => {
    expect(friendlyError(new Error('Access denied for user u-123'))).toBe('Access denied for this token’s role.');
    expect(friendlyError(new Error('The JWT signature is invalid'))).toBe('Token expired or invalid — sign in again.');
  });

  it('translates network failures', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toBe('The ODB is unreachable.');
  });

  it('passes other messages through, truncated, and stringifies non-Errors', () => {
    expect(friendlyError(new Error('Field "x" of type Y must have a selection'))).toBe(
      'Field "x" of type Y must have a selection',
    );
    expect(friendlyError(new Error('e'.repeat(200)))).toHaveLength(120);
    expect(friendlyError('plain string')).toBe('plain string');
  });
});
