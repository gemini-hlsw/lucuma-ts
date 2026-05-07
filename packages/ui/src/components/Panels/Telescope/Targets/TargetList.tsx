import { useConfiguration, useUpdateConfiguration } from '@gql/configs/Configuration';
import type { TargetType } from '@gql/configs/gen/graphql';

import type { Target as ConfigsTarget } from '@/types';

import { createUpdateSelectedTargetVariables } from './inputs';
import { Target } from './Target';

export function TargetList({ targets, type }: { targets: ConfigsTarget[]; type?: TargetType }) {
  const { data: configurationData, loading: configurationLoading } = useConfiguration();
  const configuration = configurationData?.configuration;

  const [updateConfiguration, { loading: updateLoading }] = useUpdateConfiguration();

  const loading = configurationLoading || updateLoading;

  let selectedTarget: number | null | undefined = null;
  switch (type) {
    case 'OIWFS':
      selectedTarget = configuration?.selectedOiTarget;
      break;
    case 'PWFS1':
      selectedTarget = configuration?.selectedP1Target;
      break;
    case 'PWFS2':
      selectedTarget = configuration?.selectedP2Target;
      break;

    default:
    case 'SCIENCE':
    case 'BLINDOFFSET':
    case 'FIXED':
      selectedTarget = configuration?.selectedTarget;
      break;
  }

  async function updateSelectedTarget(targetPk: number) {
    if (configuration) {
      await updateConfiguration({ variables: createUpdateSelectedTargetVariables(configuration.pk, type, targetPk) });
    }
  }

  const displayTargets = targets.map((target: ConfigsTarget) => (
    <Target
      key={`obsTarget-${target.pk ?? ''}-${target.id ?? ''}`}
      target={target}
      updateSelectedTarget={updateSelectedTarget}
      selectedTarget={selectedTarget}
      disabled={loading}
    />
  ));

  if (!displayTargets.length) {
    // Return an empty target as placeholder
    displayTargets.push(
      <Target
        key="obsTarget-0"
        target={{} as ConfigsTarget}
        updateSelectedTarget={() => undefined}
        selectedTarget={0}
        disabled={loading}
      />,
    );
  }
  return (
    <div className="target">
      <ul className="target-list">{displayTargets}</ul>
    </div>
  );
}
