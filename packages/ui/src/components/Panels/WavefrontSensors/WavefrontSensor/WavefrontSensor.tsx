import imgUrl from '@assets/underconstruction.png';
import { useConfiguration } from '@gql/configs/Configuration';
import type { Instrument, WfsType } from '@gql/configs/gen/graphql';
import type { GuideProbe } from '@gql/server/gen/graphql';
import { useGuideState } from '@gql/server/GuideState';
import {
  useOiwfsConfigState,
  usePwfs1ConfigState,
  usePwfs2ConfigState,
  useSetOiwfsCircularBuffer,
  useSetPwfs1CircularBuffer,
  useSetPwfs2CircularBuffer,
} from '@gql/server/NavigateState';
import {
  type ObserveResult,
  type StopObserveResult,
  useOiwfsObserve,
  useOiwfsStopObserve,
  usePwfs1Observe,
  usePwfs1StopObserve,
  usePwfs2Observe,
  usePwfs2StopObserve,
  useTakeSky,
} from '@gql/server/WavefrontSensors';
import { clsx } from 'clsx';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { useId, useMemo, useState } from 'react';

import { useServerConfigValue } from '@/components/atoms/config';
import { Play, Stop } from '@/components/Icons';
import { instrumentToOiwfs } from '@/Helpers/functions';

const DEFAULT_FREQ_OPTIONS = {
  GN: {
    PWFS1: [50, 100, 200],
    PWFS2: [50, 100, 200],
    OIWFS: [50, 100, 200],
  },
  GS: {
    PWFS1: [0.033, 0.05, 0.067, 0.1, 0.2, 0.33, 0.5, 1, 2, 10, 20, 50, 100],
    PWFS2: [1, 2, 10, 20, 50, 100, 200],
    GMOS_OIWFS: [1, 2, 10, 20, 50, 100, 200],
    FLAMINGOS2_OIWFS: [1, 2, 10, 20, 50, 125, 200],
    OIWFS: [1, 2, 10, 20, 50, 100, 200],
  },
};

const DEFAULT_SELECTED_FREQ = {
  OIWFS: 200,
  PWFS1: 100,
  PWFS2: 200,
};

function useFreqOptions(wfs: Exclude<WfsType, 'NONE'>, obsInstrument: Instrument | null | undefined) {
  const { site } = useServerConfigValue();

  const freqOptions = useMemo(() => {
    if (site === 'GS') {
      if (wfs === 'OIWFS') {
        if (obsInstrument?.includes('GMOS')) {
          return DEFAULT_FREQ_OPTIONS.GS.GMOS_OIWFS;
        } else if (obsInstrument === 'FLAMINGOS2') {
          return DEFAULT_FREQ_OPTIONS.GS.FLAMINGOS2_OIWFS;
        }
      }
    }

    return DEFAULT_FREQ_OPTIONS[site][wfs];
  }, [site, wfs, obsInstrument]);

  const [freq, setFreq] = useState(DEFAULT_SELECTED_FREQ[wfs]);

  if (!freqOptions.includes(freq)) {
    setFreq(DEFAULT_SELECTED_FREQ[wfs]);
  }

  return [freq, setFreq, freqOptions] as const;
}

export default function WavefrontSensor({
  canEdit,
  wfs,
  className,
}: {
  canEdit: boolean;
  wfs: Exclude<WfsType, 'NONE'>;
  className?: string;
}) {
  const id = useId();

  const { data: configData, loading: configLoading } = useConfiguration();
  const configuration = configData?.configuration;

  const [freq, setFreq, freqOptions] = useFreqOptions(wfs, configuration?.obsInstrument);

  let observeButton: React.ReactElement | undefined;
  let skyButton: React.ReactElement | undefined;
  let saveButton: React.ReactElement | undefined;
  const saveProps: SaveCheckboxProps = { canEdit, inputId: `save-${id}` };
  if (wfs === 'OIWFS') {
    observeButton = <OiwfsObserveButton freq={freq} canEdit={canEdit && !configLoading} />;
    skyButton = <TakeSkyButton freq={freq} wfs="GMOS_OIWFS" canEdit={canEdit} />;
    saveButton = <OiwfsSaveCheckbox {...saveProps} />;
  } else if (wfs === 'PWFS1') {
    observeButton = <Pwfs1ObserveButton freq={freq} canEdit={canEdit && !configLoading} />;
    skyButton = <TakeSkyButton freq={freq} wfs="PWFS1" canEdit={canEdit} />;
    saveButton = <Pwfs1SaveCheckbox {...saveProps} />;
  } else if (wfs === 'PWFS2') {
    observeButton = <Pwfs2ObserveButton freq={freq} canEdit={canEdit && !configLoading} />;
    skyButton = <TakeSkyButton freq={freq} wfs="PWFS2" canEdit={canEdit} />;
    saveButton = <Pwfs2SaveCheckbox {...saveProps} />;
  } else {
    console.warn(`Unknown wavefront sensor type: ${wfs as string}`);
  }

  return (
    <div className={clsx('wfs', className)} data-testid={`${wfs.toLowerCase()}-controls`}>
      <span className="wfs-name">{wfs}</span>
      <img src={imgUrl} alt="wfs" />
      <div className="controls">
        <label htmlFor={`freq-${id}`} style={{ gridArea: 'g11' }}>
          Freq
        </label>
        <Dropdown
          inputId={`freq-${id}`}
          disabled={!canEdit || configLoading}
          style={{ gridArea: 'g12' }}
          value={freq}
          options={freqOptions.map((f) => ({ label: f.toString(), value: f }))}
          onChange={(e) => setFreq(e.value as number)}
        />
        {observeButton}
        <div className="save-inputs">
          <label htmlFor={`save-${id}`}>Save CB</label>
          {saveButton}
        </div>
        {skyButton}
        <Button className="under-construction" disabled={!canEdit} style={{ gridArea: 'g3' }} label="Autoadjust" />
      </div>
    </div>
  );
}

function OiwfsObserveButton({ freq, canEdit }: { freq: number; canEdit: boolean }) {
  const { data: guideStateData, loading, setStale } = useGuideState();

  const observe = useOiwfsObserve(setStale);
  const stopObserve = useOiwfsStopObserve(setStale);

  return (
    <ObserveButton
      loading={loading}
      freq={freq}
      canEdit={canEdit}
      integrating={guideStateData?.oiIntegrating}
      observeResult={observe}
      stopObserveResult={stopObserve}
    />
  );
}

interface SaveCheckboxProps {
  canEdit: boolean;
  inputId: string;
}

function OiwfsSaveCheckbox({ canEdit, inputId }: SaveCheckboxProps) {
  const { data, loading: dataLoading, setStale } = useOiwfsConfigState();
  const [setOiwfsCircularBuffer, { loading: mutationLoading }] = useSetOiwfsCircularBuffer(setStale);

  const loading = dataLoading || mutationLoading;

  return (
    <Checkbox
      checked={data?.saving ?? false}
      disabled={!canEdit || loading}
      inputId={inputId}
      onChange={(e) => setOiwfsCircularBuffer({ variables: { enabled: e.checked ?? false } })}
    />
  );
}

function Pwfs1SaveCheckbox({ canEdit, inputId }: SaveCheckboxProps) {
  const { data, loading: dataLoading, setStale } = usePwfs1ConfigState();
  const [setPwfs1CircularBuffer, { loading: mutationLoading }] = useSetPwfs1CircularBuffer(setStale);

  const loading = dataLoading || mutationLoading;

  return (
    <Checkbox
      checked={data?.saving ?? false}
      disabled={!canEdit || loading}
      inputId={inputId}
      onChange={(e) => setPwfs1CircularBuffer({ variables: { enabled: e.checked ?? false } })}
    />
  );
}

function Pwfs2SaveCheckbox({ canEdit, inputId }: SaveCheckboxProps) {
  const { data, loading: dataLoading, setStale } = usePwfs2ConfigState();
  const [setPwfs2CircularBuffer, { loading: mutationLoading }] = useSetPwfs2CircularBuffer(setStale);

  const loading = dataLoading || mutationLoading;

  return (
    <Checkbox
      checked={data?.saving ?? false}
      disabled={!canEdit || loading}
      inputId={inputId}
      onChange={(e) => setPwfs2CircularBuffer({ variables: { enabled: e.checked ?? false } })}
    />
  );
}

function Pwfs1ObserveButton({ freq, canEdit }: { freq: number; canEdit: boolean }) {
  const { data: guideStateData, loading, setStale } = useGuideState();

  const observe = usePwfs1Observe(setStale);
  const stopObserve = usePwfs1StopObserve(setStale);
  return (
    <ObserveButton
      loading={loading}
      freq={freq}
      canEdit={canEdit}
      integrating={guideStateData?.p1Integrating}
      observeResult={observe}
      stopObserveResult={stopObserve}
    />
  );
}

function Pwfs2ObserveButton({ freq, canEdit }: { freq: number; canEdit: boolean }) {
  const { data: guideStateData, loading, setStale } = useGuideState();

  const observe = usePwfs2Observe(setStale);
  const stopObserve = usePwfs2StopObserve(setStale);
  return (
    <ObserveButton
      loading={loading}
      freq={freq}
      canEdit={canEdit}
      integrating={guideStateData?.p2Integrating}
      observeResult={observe}
      stopObserveResult={stopObserve}
    />
  );
}

export function ObserveButton({
  freq,
  canEdit,
  integrating,
  observeResult,
  stopObserveResult,
  loading,
  style = { gridArea: 'g13' },
}: {
  freq: number;
  canEdit: boolean;
  integrating: boolean | undefined;
  observeResult: ObserveResult;
  stopObserveResult: StopObserveResult;
  loading: boolean;
  style?: React.CSSProperties;
}) {
  const [startObserve, { loading: startObserveLoading }] = observeResult;
  const [stopObserve, { loading: stopObserveLoading }] = stopObserveResult;

  const onClick = () =>
    integrating
      ? stopObserve({})
      : startObserve({
          variables: { period: { milliseconds: (1 / freq) * 1000 } },
        });

  return (
    <Button
      loading={loading || startObserveLoading || stopObserveLoading}
      disabled={!canEdit}
      style={style}
      icon={integrating ? <Stop /> : <Play />}
      severity={integrating ? 'danger' : undefined}
      aria-label={integrating ? 'Stop' : 'Start'}
      tooltip={integrating ? 'Stop' : 'Start'}
      onClick={onClick}
    />
  );
}

function TakeSkyButton({ freq, wfs, canEdit }: { freq: number; wfs: GuideProbe; canEdit: boolean }) {
  const [takeSky, { loading: takeSkyLoading }] = useTakeSky();

  // Instrument being used
  const { data: configData, loading: configLoading } = useConfiguration();
  const instrument = configData?.configuration?.obsInstrument;

  const onClick = () =>
    takeSky({
      variables: {
        wfs: wfs.includes('OIWFS') ? instrumentToOiwfs(instrument)! : wfs,
        period: { milliseconds: (1 / freq) * 1000 },
      },
    });

  return (
    <Button
      loading={takeSkyLoading}
      disabled={!canEdit || configLoading}
      style={{ gridArea: 'g23' }}
      aria-label="Take Sky"
      tooltip="Take Sky"
      onClick={onClick}
    >
      Sky
    </Button>
  );
}
