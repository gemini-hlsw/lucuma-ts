const ENV_LABEL = 'Development';

const PRODUCTION_HOSTS: readonly string[] = [];

/**
 * The one place the environment is decided. The SSO merge brings `environments.ts`; re-point this
 * function at it rather than copying its table here.
 */
export const environmentLabel = (hostname: string): string | null =>
  PRODUCTION_HOSTS.includes(hostname) ? null : ENV_LABEL;
