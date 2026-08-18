/**
 * The `?raw` imports Vitest serves to the browser tests, resolved through
 * `tasks/graphqlSdlPlugin.ts` so the SDL arrives with its `#import`s expanded.
 *
 * Node never loads one - `mock-server/server.ts` goes through `sdl.ts` instead -
 * so this declaration exists purely to keep the mock's own files typecheckable
 * under the package tsconfig.
 */
declare module '*.graphql?raw' {
  const sdl: string;
  export default sdl;
}
