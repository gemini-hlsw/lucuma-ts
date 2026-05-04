import { useConfiguration, useUpdateConfiguration } from '@gql/configs/Configuration';
import type { EngineeringTargetItemFragment } from '@gql/configs/gen/graphql';
import { useRotator, useUpdateRotator } from '@gql/configs/Rotator';
import { useRemoveAndCreateBaseTargets } from '@gql/configs/Target';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { lazy, startTransition, Suspense, useState } from 'react';

import { useCanEdit } from '@/components/atoms/auth';
import { useCatalogVisible } from '@/components/atoms/catalog';
import { useTransitionPromise } from '@/Helpers/hooks';

import { ModalSolarProgress } from '../ModalSolarProgress';

const CatalogTable = lazy(() => import('../ModalContent').then((module) => ({ default: module.CatalogTable })));

export function Catalog() {
  const [catalogVisible, setCatalogVisible] = useCatalogVisible();
  const canEdit = useCanEdit();

  const [selectedTarget, setSelectedTarget] = useState<EngineeringTargetItemFragment | null>(null);

  const [updateTarget, { loading }] = useUpdateTarget();

  const close = () =>
    startTransition(() => {
      setCatalogVisible(false);
      setSelectedTarget(null);
    });

  const footer = (
    <div className="modal-footer">
      <Button text severity="danger" label="Cancel" onClick={close} />
      <Button
        disabled={!canEdit || !selectedTarget}
        label="Import to Navigate"
        loading={loading}
        onClick={async () => updateTarget(selectedTarget!).then(close)}
      />
    </div>
  );

  return (
    <Dialog header="Import from catalog" footer={footer} visible={catalogVisible} modal onHide={close}>
      <Suspense fallback={<ModalSolarProgress />}>
        <CatalogTable selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget} />
      </Suspense>
    </Dialog>
  );
}

function useUpdateTarget() {
  const { data: configurationData, loading: configurationLoading } = useConfiguration();
  const configuration = configurationData?.configuration;
  const [removeAndCreateBaseTargets, { loading: removeCreateLoading }] = useRemoveAndCreateBaseTargets();
  const [updateConfiguration, { loading: updateConfigLoading }] = useUpdateConfiguration();

  const [isPending, startTransition] = useTransitionPromise();

  const { data: rotatorData, loading: rotatorLoading } = useRotator();
  const rotator = rotatorData?.rotator;
  const [updateRotator, { loading: updateRotatorLoading }] = useUpdateRotator();

  const loading =
    updateConfigLoading ||
    removeCreateLoading ||
    updateRotatorLoading ||
    configurationLoading ||
    rotatorLoading ||
    isPending;

  function updateTarget(selectedTarget: EngineeringTargetItemFragment) {
    if (!configuration) return Promise.resolve();

    return startTransition(async () => {
      // Create the observation base target
      const { data: t } = await removeAndCreateBaseTargets({
        variables: {
          targets: [
            {
              id: 't-100',
              name: selectedTarget.name,
              magnitude: undefined,
              band: undefined,
              type: selectedTarget.type,
              wavelength: selectedTarget.wavelength,
              sidereal: {
                coord1: selectedTarget.type === 'FIXED' ? selectedTarget.az!.degrees : selectedTarget.ra!.degrees,
                coord2: selectedTarget.type === 'FIXED' ? selectedTarget.el!.degrees : selectedTarget.dec!.degrees,
                epoch: selectedTarget.epoch,
                pmRa: null,
                pmDec: null,
                radialVelocity: null,
                parallax: null,
              },
            },
          ],
        },
      });

      await updateConfiguration({
        variables: {
          pk: configuration.pk,
          obsId: 'o-100',
          obsTitle: selectedTarget.name,
          obsSubtitle: '',
          obsInstrument: selectedTarget.instrument,
          obsReference: '',
          selectedOiTarget: null,
          selectedP1Target: null,
          selectedP2Target: null,
          selectedGuiderTarget: null,
          baffleMode: selectedTarget.baffleMode,
          centralBaffle: selectedTarget.centralBaffle,
          deployableBaffle: selectedTarget.deployableBaffle,
          selectedTarget: t?.removeAndCreateBaseTargets[0]?.pk ?? null,
        },
      });

      if (rotator && selectedTarget.rotatorMode && selectedTarget.rotatorAngle !== null) {
        const rotatorVariables = {
          pk: rotator.pk,
          angle: selectedTarget.rotatorAngle,
          tracking: selectedTarget.rotatorMode,
        };
        await updateRotator({ variables: rotatorVariables });
      }
    });
  }

  return [updateTarget, { loading }] as const;
}
