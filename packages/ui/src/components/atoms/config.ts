import type { ServerConfiguration } from '@gql/server/gen/graphql';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';

// Cast is safe because the application initializes with a valid server configuration
export const serverConfigAtom = atom({} as ServerConfiguration);

export const useServerConfig = () => useAtom(serverConfigAtom);
export const useServerConfigValue = () => useAtomValue(serverConfigAtom);
export const useSetServerConfig = () => useSetAtom(serverConfigAtom);
