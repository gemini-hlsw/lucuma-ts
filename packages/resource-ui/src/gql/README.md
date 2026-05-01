# GraphQL (gql)

This folder contains GraphQL queries and the generated types used by the Resource UI.

- `gen/` — Auto-generated code (do not edit)
- `ApolloConfigs.ts` — Apollo Client setup

## Usage

Define queries using the `graphql` helper:

```ts
const QUERY = graphql(`
  query example {
    ...
  }
`);
```

Use them with Apollo:

```ts
useQuery(QUERY);
```

## Codegen

Generated files in `gen/` come from running:

```bash
pnpm resource-ui codegen
```

Re-run codegen when:

- The schema changes
- Queries are added or modified

## Notes

- Do not edit anything in `gen/`
- Enums are generated as string union types
