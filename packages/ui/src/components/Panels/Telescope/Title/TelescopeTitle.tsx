import { useImportObservation } from '@Contexts/Variables/Modals/OdbImport/useImportObservation';
import { isNullish } from '@gemini-hlsw/lucuma-common-ui';
import { dateToLocalObservingNight } from '@gemini-hlsw/lucuma-core';
import { useConfiguration } from '@gql/configs/Configuration';
import { useObservationById } from '@gql/odb/Observation';
import { useRefreshEphemerisFiles } from '@gql/server/Ephemeris';
import { Title, TitleDropdown } from '@Shared/Title/Title';
import { Button } from 'primereact/button';
import { Divider } from 'primereact/divider';

import { useCanEdit } from '@/components/atoms/auth';
import { useSetCatalogVisible } from '@/components/atoms/catalog';
import { useSetOdbVisible } from '@/components/atoms/odb';
import { List } from '@/components/Icons';
import { useToast } from '@/Helpers/toast';

interface ParamsInterface {
  prevPanel: () => void;
  nextPanel: () => void;
}

export function TelescopeTitle({ prevPanel, nextPanel }: ParamsInterface) {
  const canEdit = useCanEdit();
  const setOdbVisible = useSetOdbVisible();
  const setCatalogVisible = useSetCatalogVisible();

  const { data: configurationData, loading: configurationLoading } = useConfiguration();
  const configuration = configurationData?.configuration;
  const [importObservation, { loading: importLoading }] = useImportObservation();
  const [getObservation, { loading: getObservationLoading }] = useObservationById();
  const [refreshEphemerisFiles, { loading: refreshLoading }] = useRefreshEphemerisFiles();

  const toast = useToast();

  async function reimportObservation() {
    if (!configuration?.obsId) return;
    const { data } = await getObservation({
      context: { clientName: 'odb' },
      variables: {
        obsId: configuration?.obsId,
      },
    });

    if (data?.observation) {
      await importObservation(data.observation);
      toast?.show({
        severity: 'success',
        summary: 'Observation reimported',
        detail: `Observation ${data.observation.id} (ref ${configuration.obsReference}) has been reimported successfully.`,
      });
    } else {
      toast?.show({
        severity: 'error',
        summary: 'Reimport failed',
        detail: `Observation ${configuration?.obsId} (ref ${configuration.obsReference}) could not be found in the ODB.`,
      });
    }
  }

  async function refreshEphemerides() {
    const observingNight = dateToLocalObservingNight(new Date());

    const { data } = await refreshEphemerisFiles({ variables: { observingNight } });
    if (data?.refreshEphemerisFiles.result === 'SUCCESS') {
      toast?.show({
        severity: 'success',
        summary: 'Success',
        detail: `Ephemerides refreshed (for ${observingNight})`,
      });
    }
  }

  const loading = importLoading || getObservationLoading || configurationLoading || refreshLoading;

  return (
    <Title title="TELESCOPE SETUP" prevPanel={prevPanel} nextPanel={nextPanel}>
      <TitleDropdown icon={<List />}>
        <Button disabled={!canEdit} text label="Import new observation from ODB" onClick={() => setOdbVisible(true)} />
        <Button
          disabled={!canEdit || loading || isNullish(configuration?.obsId)}
          text
          label="Reimport current observation from ODB"
          onClick={reimportObservation}
        />
        <Button disabled={!canEdit} text label="Import from catalog" onClick={() => setCatalogVisible(true)} />
        <Button disabled={!canEdit || loading} text label="Refresh TCS ephemerides" onClick={refreshEphemerides} />
        <Divider />
        <Button disabled={!canEdit} className="p-button-text under-construction" label="Edit targets" />
      </TitleDropdown>
    </Title>
  );
}
