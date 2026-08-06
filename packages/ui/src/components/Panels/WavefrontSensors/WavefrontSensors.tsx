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
      <div className="body">
        <div className="top">
          <MainControls prevPanel={prevPanel} canEdit={canEdit} />
          <Sensors nextPanel={nextPanel} canEdit={canEdit} />
        </div>
        <LightPath />
        <WfsMechs />
        <Logs />
      </div>
    </div>
  );
}
function Sensors({ nextPanel, canEdit }: { nextPanel: () => void; canEdit: boolean }) {
  return (
    <div className="sensors">
      <Title title="Wavefront Sensors" nextPanel={nextPanel}></Title>
      <Pwfs1WavefrontSensor canEdit={canEdit} />
      <Pwfs2WavefrontSensor canEdit={canEdit} />
      <OiwfsWavefrontSensor canEdit={canEdit} />
      <AcquisitionCamera canEdit={canEdit} />
    </div>
  );
}
