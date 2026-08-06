import { useGuideState } from '@gql/server/GuideState';
import { useAcObserve, useAcStopObserve } from '@gql/server/WavefrontSensors';
import { ObserveButton } from '@WavefrontSensors/WavefrontSensor/WavefrontSensor';
import { Dropdown } from 'primereact/dropdown';
import { useId, useState } from 'react';

export default function AcquisitionCamera({ canEdit }: { canEdit: boolean }) {
  const id = useId();
  const { data: guideStateData, loading, setStale } = useGuideState();

  const observeResult = useAcObserve(setStale);
  const stopObserveResult = useAcStopObserve(setStale);

  const [exp, setExp] = useState(0.01);

  return (
    <div className="wfs ac" data-testid="ac-controls">
      <span className="wfs-name">AC/HR</span>
      <div className="controls">
        <label htmlFor={`exp-${id}`} style={{ gridArea: 'g11' }}>
          Exp
        </label>
        <Dropdown
          inputId={`exp-${id}`}
          disabled={!canEdit}
          style={{ gridArea: 'g12' }}
          value={exp}
          onChange={(e) => setExp(e.value as number)}
          options={[
            { label: '0.01', value: 0.01 },
            { label: '0.1', value: 0.1 },
            { label: '1.0', value: 1.0 },
            { label: '10', value: 10 },
          ]}
        />
        <ObserveButton
          loading={loading}
          freq={1 / exp}
          canEdit={canEdit}
          integrating={guideStateData?.acIntegrating}
          observeResult={observeResult}
          stopObserveResult={stopObserveResult}
          style={{ gridArea: 'g13' }}
        />
      </div>
    </div>
  );
}
