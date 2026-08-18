/**
 * The cache's contextual-block list, against the schema it is a list of.
 *
 * Every `ScheduleBlock` implementor comes back clipped to the window that was
 * asked for, so every one of them has to be stored per query result rather
 * than by id. Three were missing when this test was written, which is exactly
 * the failure mode: the list is invisible from the type that needs to be on
 * it, and nothing said so.
 */
import { buildSchema, isObjectType } from 'graphql';
import { describe, expect, it } from 'vitest';

import sdl from '../../mock-server/schema.graphql?raw';
import { buildCache, CONTEXTUAL_BLOCK_TYPES } from './cache';

const scheduleBlockImplementors = Object.values(buildSchema(sdl).getTypeMap())
  .filter(isObjectType)
  .filter((type) => type.getInterfaces().some((implemented) => implemented.name === 'ScheduleBlock'))
  .map((type) => type.name)
  .sort();

describe(buildCache.name, () => {
  it('finds the schema implementors - an empty list would pin nothing', () => {
    expect(scheduleBlockImplementors.length).toBeGreaterThan(0);
  });

  it('stores every ScheduleBlock implementor as a contextual value, never by id', () => {
    expect([...CONTEXTUAL_BLOCK_TYPES].sort()).toEqual(scheduleBlockImplementors);
  });
});
