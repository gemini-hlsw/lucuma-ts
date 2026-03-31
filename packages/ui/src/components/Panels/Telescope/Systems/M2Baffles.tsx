import { isNotNullish, isNullish } from '@gemini-hlsw/lucuma-common-ui';
import { useConfiguration, useUpdateConfiguration } from '@gql/configs/Configuration';
import type { BaffleMode, UpdateConfigurationMutationVariables } from '@gql/configs/gen/graphql';
import type { CentralBaffle, DeployableBaffle } from '@gql/server/gen/graphql';
import { Title } from '@Shared/Title/Title';
import { Dropdown } from 'primereact/dropdown';

const modeOptions: BaffleMode[] = ['AUTO', 'MANUAL', 'IGNORED'];
const centralOptions: CentralBaffle[] = ['OPEN', 'CLOSED'];
const deployableOptions: DeployableBaffle[] = ['EXTENDED', 'NEAR_IR', 'THERMAL_IR', 'VISIBLE'];

export function M2Baffles({ canEdit }: { canEdit: boolean }) {
  const { data: configurationData, loading: configurationLoading } = useConfiguration();
  const configuration = configurationData?.configuration;
  const [updateConfiguration, { loading: updateLoading }] = useUpdateConfiguration();

  const loading = configurationLoading || updateLoading;

  const updateBaffle = async (
    vars: Pick<UpdateConfigurationMutationVariables, 'baffleMode' | 'centralBaffle' | 'deployableBaffle'>,
  ) => {
    if (isNotNullish(configuration?.pk)) await updateConfiguration({ variables: { pk: configuration.pk, ...vars } });
  };

  return (
    <div className="baffles">
      <Title title="M2 Baffles" />
      <div className="body">
        <label htmlFor="m2baffles-config">Mode</label>
        <Dropdown
          disabled={!canEdit}
          loading={loading}
          inputId="m2baffles-config"
          options={modeOptions}
          value={configuration?.baffleMode ?? null}
          onChange={(e) => updateBaffle({ baffleMode: e.value as BaffleMode })}
          placeholder="Select mode"
        />

        {configuration?.baffleMode === 'MANUAL' && (
          <>
            <label htmlFor="m2baffles-central">Central Baffle</label>
            <Dropdown
              disabled={!canEdit}
              loading={loading}
              inputId="m2baffles-central"
              options={centralOptions}
              value={configuration.centralBaffle ?? null}
              invalid={isNullish(configuration.centralBaffle)}
              onChange={(e) => updateBaffle({ centralBaffle: e.value as CentralBaffle })}
            />

            <label htmlFor="m2baffles-deployable">Deployable Baffle</label>
            <Dropdown
              disabled={!canEdit}
              loading={loading}
              inputId="m2baffles-deployable"
              options={deployableOptions}
              value={configuration.deployableBaffle ?? null}
              invalid={isNullish(configuration.deployableBaffle)}
              onChange={(e) => updateBaffle({ deployableBaffle: e.value as DeployableBaffle })}
            />
          </>
        )}
      </div>
    </div>
  );
}
