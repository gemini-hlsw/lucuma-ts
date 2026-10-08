# The backend schema is authoritative; tests mock per operation

resource-ui once owned the Resource API design in a hand-written `mock-server/schema.graphql`, served by an in-repo
mock server whose resolvers copied the backend's overlap, clip and night rules. Now that lucuma-odb ships the Resource
service (gemini-hlsw/lucuma-odb#3050), the schema comes only from `@gemini-hlsw/lucuma-odb-schemas/resource`. Where the
two disagree, the backend wins, and the frontend keeps no copy that could drift. The mock server is gone. Tests answer
each operation with small per-test fixtures through Apollo's `MockedProvider`, as `ui` and `admin-ui` do, and
`@graphql-eslint` validates every document against the package schema.

## Considered Options

- Keep a synced copy of the schema in the repo: rejected, it drifts silently.
- Keep `SchemaLink` over the package schema with generated mocks: rejected, it re-implements backend behaviour in the
  browser and skips validation.

## Consequences

To try a schema idea, extend the schema on a throwaway branch and drive the UI through tests; nothing extended
merges.
