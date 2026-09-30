import { groupBy, isNullish } from '@gemini-hlsw/lucuma-common-ui';
import { useUpdateConfiguration } from '@gql/configs/Configuration';
import type { Instrument } from '@gql/configs/gen/graphql';
import { useInstrument } from '@gql/configs/Instrument';
import { useNavigateState } from '@gql/server/NavigateState';
import { useServerConfigValue } from '@gql/server/ServerConfiguration';
import { useRestoreTarget, useSwapTarget } from '@gql/server/TargetSwap';
import { Button } from 'primereact/button';
import { SplitButton } from 'primereact/splitbutton';

import { useCanEdit } from '@/components/atoms/auth';
import { useToast } from '@/Helpers/toast';
import type { Target } from '@/types';

import {
  createOriginInput,
  createTargetPropertiesInput,
  createUpdateSelectedTargetVariables,
  useTcsConfigInput,
} from './inputs';

export function TargetSwapButton({
  configurationPk,
  guiderTargets,
  selectedGuider,
  loading: propLoading,
}: {
  configurationPk: number | undefined;
  guiderTargets: Target[];
  selectedGuider: Target | undefined;
  loading: boolean;
}) {
  const canEdit = useCanEdit();
  const toast = useToast();

  const { data, loading: stateLoading, setStale } = useNavigateState();

  const [swapTarget, { loading: swapLoading }] = useSwapTarget(setStale);
  const [restoreTarget, { loading: restoreLoading }] = useRestoreTarget(setStale);
  const [updateConfiguration, { loading: updateConfigurationLoading }] = useUpdateConfiguration();

  const { data: tcsConfig, loading: tcsConfigInputLoading, detail } = useTcsConfigInput();

  const { site } = useServerConfigValue();
  const acqCamName: Instrument = site === 'GN' ? 'ACQ_CAM_NORTH' : 'ACQ_CAM_SOUTH';
  const { data: acqCamData, loading: acqCamInstrumentLoading } = useInstrument({ variables: { name: acqCamName } });
  const acqCamInstrument = acqCamData?.instrument;

  const loading =
    stateLoading ||
    swapLoading ||
    restoreLoading ||
    tcsConfigInputLoading ||
    updateConfigurationLoading ||
    acqCamInstrumentLoading ||
    propLoading;

  const disabled = !canEdit;

  const label = data?.onSwappedTarget
    ? `Point to Base${tcsConfig?.sourceATarget ? ` (${tcsConfig.sourceATarget.name})` : ''}`
    : `Point to Guide Star${selectedGuider ? ` (${selectedGuider.name})` : ''}`;
  const severity = data?.onSwappedTarget ? 'danger' : undefined;

  const onClick = async () => {
    if (tcsConfig) {
      if (data?.onSwappedTarget) {
        // If restoring
        // Use the science target
        await restoreTarget({ variables: { config: tcsConfig } });
      } else {
        if (!selectedGuider) {
          toast?.show({
            severity: 'warn',
            summary: 'Cannot swap target',
            detail: 'No guide target selected',
          });
          return;
        }
        if (!acqCamInstrument) {
          toast?.show({
            severity: 'warn',
            summary: 'Cannot swap target',
            detail: `No configuration found for ${acqCamName}`,
          });
          return;
        }
        // If swapping
        // Use Guide target if swapping
        const targetInput = createTargetPropertiesInput(selectedGuider);
        await swapTarget({
          variables: {
            swapConfig: {
              acParams: {
                agName: tcsConfig.instParams.agName,
                focusOffset: tcsConfig.instParams.focusOffset,
                iaa: tcsConfig.instParams.iaa,
                origin: createOriginInput(acqCamInstrument),
              },
              rotator: tcsConfig.rotator,
              guideTarget: targetInput,
            },
          },
        });
      }
    } else {
      toast?.show({
        severity: 'warn',
        summary: data?.onSwappedTarget ? 'Cannot restore target' : 'Cannot swap target',
        detail,
      });
    }
  };

  if (guiderTargets.length === 1 || data?.onSwappedTarget)
    return (
      <Button
        disabled={disabled}
        className="footer"
        label={label}
        onClick={onClick}
        severity={severity}
        loading={loading}
      />
    );
  else
    // Show dropdown to select a specific guider target
    return (
      <SplitButton
        disabled={disabled}
        className="footer"
        label={label}
        onClick={onClick}
        severity={severity}
        loading={loading}
        model={Object.entries(groupBy(guiderTargets, (t) => t.type)).map(([type, targets], _, arr) => ({
          id: type,
          label: type,
          // Only show if there are targets of this type
          visible: targets.length > 0,
          // Auto-expand if only one type
          expanded: arr.length === 1 ? true : undefined,
          className: 'guider-target-dropdown-item',
          items: targets.map((t) => ({
            id: t.pk.toString(),
            label: t.name,
            disabled: disabled || isNullish(configurationPk),
            className: 'guider-target-dropdown-item',
            command: () =>
              updateConfiguration({ variables: createUpdateSelectedTargetVariables(configurationPk!, t.type, t.pk) }),
          })),
        }))}
      />
    );
}
