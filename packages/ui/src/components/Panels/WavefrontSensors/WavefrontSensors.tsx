import './WavefrontSensors.css';

import { LightPath } from '@Guider/LightPath/LightPath';
import { WfsMechs } from '@Guider/WfsMechs/WfsMechs';
import { Title } from '@Shared/Title/Title';

import { useCanEdit } from '@/components/atoms/auth';

import AcquisitionCamera from './AcquisitionCamera/AcquisitionCamera';
import MainControls from './AcquisitionCamera/MainControls';
import Logs from './Logs/Logs';
import { OiwfsWavefrontSensor, Pwfs1WavefrontSensor, Pwfs2WavefrontSensor } from './WavefrontSensor/WavefrontSensor';

export function WavefrontSensors({ prevPanel, nextPanel }: { prevPanel: () => void; nextPanel: () => void }) {
  const canEdit = useCanEdit();

  return (
    <div className="wavefront-sensors">
      <Title title="WAVEFRONT SENSORS" prevPanel={prevPanel} nextPanel={nextPanel}></Title>
      <div className="body">
        <div className="top">
          <MainControls canEdit={canEdit} />
          <div className="sensors">
            <Pwfs1WavefrontSensor canEdit={canEdit} />
            <Pwfs2WavefrontSensor canEdit={canEdit} />
            <OiwfsWavefrontSensor canEdit={canEdit} />
            <AcquisitionCamera canEdit={canEdit} ac="AC/HR" />
          </div>
        </div>
        <LightPath />
        <WfsMechs />
        <Logs />
      </div>
    </div>
  );
}
