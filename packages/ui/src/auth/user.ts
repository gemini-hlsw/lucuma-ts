/*
 * The user model, role hierarchy, and display name now live in common-ui so
 * every app shares one definition. Re-exported here so existing `@/auth/user`
 * imports keep working.
 */
export type {
  GuestUser,
  OrcidProfile,
  ServiceUser,
  StandardRole,
  StandardUser,
  User,
} from '@gemini-hlsw/lucuma-common-ui';
export { displayName } from '@gemini-hlsw/lucuma-common-ui';
