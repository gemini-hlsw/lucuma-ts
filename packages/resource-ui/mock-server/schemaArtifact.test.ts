/**
 * The generated SDL, against the source it is generated from.
 *
 * `schema.graphql` takes its ODB types through `#import`, which is
 * @graphql-tools' convention rather than GraphQL's - to GraphQL it is a comment,
 * so the file on its own builds a schema whose `Timestamp` is undefined. Codegen
 * resolves it and writes `src/gql/gen/schema.graphql`, and that one file is what
 * the :4000 server, the resolver tests, the cache test and the browser-test
 * Apollo client all read.
 *
 * Three properties of that expansion, each of which has cost real debugging:
 *
 * - **The imported types arrive.** The loader only looks for imports when the
 *   SDL *starts* with one, so a header comment above the `#import` line silently
 *   turns every type below into an unknown type.
 * - **The root `Query` is emitted once.** An import resolver hands back the root
 *   type once whole and once per field, which printed straight out is eleven
 *   `type Query` blocks and a schema that will not build.
 * - **The docstrings survive.** They are the API documentation a reader of
 *   GraphiQL sees; the `#` design notes are for a reader of the file and are
 *   deliberately not expected to survive.
 */
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
