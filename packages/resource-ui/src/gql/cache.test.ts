/** The list is invisible from the type that needs to be on it, so a new block type goes missing. */
import { buildSchema, isObjectType } from 'graphql';
import { describe, expect, it } from 'vitest';

import { buildCache, CONTEXTUAL_BLOCK_TYPES } from './cache';
import sdl from './gen/schema.graphql?raw';

// The backend names every block type `…Block` and gives them no shared interface.
const blockTypes = Object.values(buildSchema(sdl).getTypeMap())
  .filter(isObjectType)
  .filter((type) => type.name.endsWith('Block'))
  .map((type) => type.name)
  .sort();

describe(buildCache, () => {
  it('finds the schema block types - an empty list would pin nothing', () => {
    expect(blockTypes).toContain('TooSupportBlock');
  });

  it('stores every block type as a contextual value, never by id', () => {
    expect([...CONTEXTUAL_BLOCK_TYPES].sort()).toEqual(blockTypes);
  });
});
