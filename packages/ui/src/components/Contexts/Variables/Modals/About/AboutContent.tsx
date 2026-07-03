import { useSuspenseVersion as useConfigsVersion } from '@gql/configs/Version';
import { useServerConfigValue } from '@gql/server/ServerConfiguration';
import { useSuspenseVersion as useServerVersion } from '@gql/server/Version';

import { frontendVersion } from '@/Helpers/constants';

export function AboutContent() {
  const { odbUri, site } = useServerConfigValue();
  const odbHost = odbUri && URL.canParse(odbUri) ? new URL(odbUri).hostname.split('.')[0]! : 'dev';
  const environmentType = odbHost.includes('staging')
    ? 'staging'
    : odbHost.includes('dev')
      ? 'development'
      : 'production';

  const { serverVersion: configsVersion, schemaVersion } = useConfigsVersion().data.version;
  const serverVersion = useServerVersion().data.serverVersion;

  return (
    <div className="about-dialog">
      <table>
        <tbody>
          <tr>
            <td>Environment</td>
            <td>{site}</td>
          </tr>
          <tr>
            <td>ODB</td>
            <td>{environmentType}</td>
          </tr>
          <tr>
            <td>Frontend</td>
            <td>{frontendVersion}</td>
          </tr>
          <tr>
            <td>Configs API</td>
            <td>{configsVersion}</td>
          </tr>
          <tr>
            <td>Server</td>
            <td>{serverVersion}</td>
          </tr>
          <tr>
            <td>Schema</td>
            <td>{schemaVersion}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
