# GraphQL (gql)

This folder contains GraphQL queries and Apollo Client setup used by the Resource UI.

- `ApolloConfigs.ts` — Apollo Client setup
- `./gen/` — Generated GraphQL types and helpers

## Generated Files

The `./gen/` folder is not committed. It is created locally by GraphQL Codegen.

Generate it with:

```bash
pnpm resource-ui codegen
```

Re-run codegen when:

- The schema changes
- Queries are added or modified
- `./gen/` is missing

## Usage

Define queries using the generated `graphql` helper:

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

## Notes

- Do not edit anything in `./gen/`
- Generated files are recreated by codegen
