/**
 * The `?raw` imports Vitest serves to the browser tests - vite's own, with no
 * plugin in the way, because the file they name (`src/gql/gen/schema.graphql`)
 * is codegen's output and already has its `#import`s expanded.
 *
 * Node never loads one - `mock-server/server.ts` reads the same file off disk -
 * so this declaration exists purely to keep the mock's own files typecheckable
 * under the package tsconfig.
 */
declare module '*.graphql?raw' {
  const sdl: string;
  export default sdl;
}
