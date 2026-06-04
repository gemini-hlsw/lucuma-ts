import schemaPkgJson from '@gemini-hlsw/lucuma-schemas/package.json' with { type: 'json' };

import pkgJson from '../../../../package.json' with { type: 'json' };
import type { QueryResolvers } from './../../gen/types.generated.ts';

export const version: NonNullable<QueryResolvers['version']> = () => {
  return {
    serverVersion: pkgJson.version,
    schemaVersion: schemaPkgJson.version,
  };
};
