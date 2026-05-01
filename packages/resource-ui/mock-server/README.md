# Resource Mock GraphQL Server

This is a temporary GraphQL server used to develop the Resource UI before a real backend exists.

## Purpose

- Provide a stable GraphQL contract for the frontend
- Allow UI development without a backend dependency
- Serve mock telescope schedule data

## Architecture

React UI -> Apollo Client -> `/resource/graphql` -> Mock Server -> In-memory data

## Running

```bash
pnpm resource-ui dev:mock-server
```

## Schema

Defined in:

```bash
mock-server/schema.graphql
```

## Data

Mock data is stored in:

```bash
mock-server/data/
```

This simulates backend responses.

## Notes

- No database is used
- No persistence is implemented
- This should be replaced by a real backend service later
