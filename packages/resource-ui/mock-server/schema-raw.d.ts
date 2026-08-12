/**
 * The `?raw` imports Vite serves in the app and Vitest serves in tests. The
 * plain-node importer never loads one; this keeps the mock's own files
 * type-checkable under the package tsconfig.
 */
declare module '*.graphql?raw' {
  const sdl: string;
  export default sdl;
}
