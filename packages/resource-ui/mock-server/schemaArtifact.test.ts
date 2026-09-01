import { buildSchema, isTypeDefinitionNode, parse } from 'graphql';
import { describe, expect, it } from 'vitest';

import sdl from '../src/gql/gen/schema.graphql?raw';
import source from './schema.graphql?raw';

const schema = buildSchema(sdl);

/** The types `schema.graphql`'s first line asks the ODB for. */
const importedTypes = (/^#import (.+) from /.exec(source)?.[1] ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

/** Every type the source documents with a docstring. */
const documentedTypes = parse(source)
  .definitions.filter(isTypeDefinitionNode)
  .filter((definition) => definition.description)
  .map((definition) => definition.name.value);

describe('the generated SDL', () => {
  it('finds the source it is generated from - an empty list would pin nothing', () => {
    expect(importedTypes.length).toBeGreaterThan(0);
    expect(documentedTypes.length).toBeGreaterThan(0);
  });

  it('resolves every type the schema imports from the ODB', () => {
    const missing = importedTypes.filter((name) => !schema.getType(name));
    expect(missing).toEqual([]);
  });

  it('emits the root Query once, not once per field', () => {
    expect(sdl.match(/^type Query/gm)).toHaveLength(1);
  });

  it('keeps the docstrings that document the API', () => {
    const undocumented = documentedTypes.filter((name) => !schema.getType(name)?.description);
    expect(undocumented).toEqual([]);
  });
});
