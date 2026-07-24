import './Guider.css';

import { Title } from '@Shared/Title/Title';
import Logs from '@WavefrontSensors/Logs/Logs';

import { Alarms } from './Alarms/Alarms';
import Diagram from './Diagram/Diagram';
import { Loop } from './Loop/Loop';

export function Guider({ prevPanel, nextPanel }: { prevPanel: () => void; nextPanel: () => void }) {
  return (
    <div className="guider">
      <Title title="GUIDER" prevPanel={prevPanel} nextPanel={nextPanel}></Title>
      <div className="body">
        <Diagram />
        <Loop />
        <Alarms />
        <Logs />
      </div>
    </div>
  );
}
