/**
 * Local mock GraphQL server for developing the Resource UI.
 *
 * Serves the v1 schema preview backed by the in-memory store. Mutations persist for
 * the life of the process (no database). Run with `pnpm dev:mock-server`.
 *
 * The SDL is `src/gql/gen/schema.graphql`, codegen's expansion of
 * `schema.graphql`'s `#import`, generated beside the typed operations because
 * that is where this workspace keeps generated code. The browser consumers read
 * the same file through `?raw`; nothing resolves imports at runtime.
 *
 * `predev:mock-server` runs `codegen` first, which is why this can just read the
 * file. Without the hook a missing artifact failed loudly (`ENOENT` naming the
 * path) but a *stale* one did not: an SDL edit that had not been through codegen
 * left this serving the previous schema, silently and successfully - the failure
 * a wrong :4000 server has cost this package repeatedly (CLAUDE.md keeps the
 * count, under "Treat port 4000 as untrusted"). The hook costs the
 * coupling - an invalid document anywhere in `src/gql/` now fails
 * `pnpm dev:mock-server` - and that trade was taken deliberately, because a
 * failure naming the broken document beats a server answering from last week's
 * schema. `--watch` restarts this process on a source change but does not
 * re-run the hook, so an SDL edit mid-session still needs `pnpm codegen`.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

import { createYoga } from 'graphql-yoga';

import { buildMockSchema } from './schema.ts';

const PORT = 4000;
const GRAPHQL_ENDPOINT = '/graphql';

const { schema } = buildMockSchema(readFileSync(new URL('../src/gql/gen/schema.graphql', import.meta.url), 'utf8'));

const yoga = createYoga({ schema, graphqlEndpoint: GRAPHQL_ENDPOINT });

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(yoga);

server.listen(PORT, () => {
  console.info('Resource mock GraphQL server started');
  console.info(`GraphQL endpoint: http://localhost:${PORT}${GRAPHQL_ENDPOINT}`);
});
