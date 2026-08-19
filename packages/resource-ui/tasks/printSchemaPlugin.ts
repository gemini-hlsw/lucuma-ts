/**
 * Codegen plugin: print the loaded schema back out as SDL.
 *
 * This exists instead of `@graphql-codegen/schema-ast`, which does the same job
 * but cannot be used here. The codegen CLI resolves a named plugin from its own
 * install directory, never from this package, so in a pnpm workspace the name
 * `schema-ast` lands on whichever peer variant the virtual store hoisted -
 * here the one built against graphql 17, because `packages/configs` pulls
 * graphql 17 in through `@eddeee888/gcg-typescript-resolver-files`. The schema
 * codegen hands a plugin is built with *this* package's graphql 16, and
 * graphql 17's type predicates are symbol-branded rather than `instanceof`, so
 * every one of them answers false across the two copies and schema-ast dies on
 * the first type it reaches with `Unknown type BigDecimal.`.
 *
 * A plugin named by path is resolved from the config's own directory, which is
 * the only way to be sure it shares this package's graphql. It is also all of
 * schema-ast that this package needs: `printSchema` is graphql's own printer,
 * and the extra step schema-ast takes on top of it - rebuilding the schema as a
 * document to carry directive usages - is both unnecessary here (the schema
 * declares no directives) and the exact call that throws.
 */
import { type GraphQLSchema, printSchema } from 'graphql';

export const plugin = (schema: GraphQLSchema): string => printSchema(schema);
