import pkgJson from '../../../../package.json' with { type: 'json' };
import type { QueryResolvers } from './../../gen/types.generated.ts';

export const version: NonNullable<QueryResolvers['version']> = () => {
  return {
    serverVersion: pkgJson.version,
  };
};
