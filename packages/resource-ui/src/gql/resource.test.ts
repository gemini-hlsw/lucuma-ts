import { buildSchema, NoUnusedFragmentsRule, specifiedRules, validate } from 'graphql';
import { describe, expect, it } from 'vitest';

import * as generated from './gen/graphql';
import sdl from './gen/schema.graphql?raw';

const schema = buildSchema(sdl);

// Codegen skips some validation rules, NoUnusedVariables among them, so its own check is not enough.
const documents = Object.entries(generated);

// A fragment checked on its own is unused by definition; its operations check it in use.
const rules = specifiedRules.filter((rule) => rule !== NoUnusedFragmentsRule);

describe('the documents codegen collects', () => {
  it('finds the documents - an empty list would check nothing', () => {
    expect(documents.map(([name]) => name)).toContain('SemesterScheduleDocument');
  });

  it.each(documents)('%s is valid against the backend schema', (_name, document) => {
    expect(validate(schema, document, rules).map((error) => error.message)).toEqual([]);
  });
});
