/** The list is invisible from the type that needs to be on it, so a new implementor goes missing. */
import { buildSchema, isObjectType } from 'graphql';
import { describe, expect, it } from 'vitest';

import { buildCache, CONTEXTUAL_BLOCK_TYPES } from './cache';
import sdl from './gen/schema.graphql?raw';

const scheduleBlockImplementors = Object.values(buildSchema(sdl).getTypeMap())
  .filter(isObjectType)
  .filter((type) => type.getInterfaces().some((implemented) => implemented.name === 'ScheduleBlock'))
  .map((type) => type.name)
  .sort();

describe(buildCache, () => {
  it('finds the schema implementors - an empty list would pin nothing', () => {
    expect(scheduleBlockImplementors.length).toBeGreaterThan(0);
  });

  it('stores every ScheduleBlock implementor as a contextual value, never by id', () => {
    expect([...CONTEXTUAL_BLOCK_TYPES].sort()).toEqual(scheduleBlockImplementors);
  });
});
