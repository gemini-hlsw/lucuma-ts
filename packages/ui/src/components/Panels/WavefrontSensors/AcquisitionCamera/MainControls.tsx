import { Title } from '@Shared/Title/Title';
import { TabPanel, TabView } from 'primereact/tabview';

import InstrumentHandset from './InstrumentHandset';
import PointingHandset from './PointingHandset';
import TargetsHandset from './TargetsHandset';

export default function MainControls({ canEdit, prevPanel }: { canEdit: boolean; prevPanel: () => void }) {
  return (
    <div className="main-controls">
      <Title prevPanel={prevPanel} title="Handset" className="main-controls-title" />
      <TabView renderActiveOnly={false}>
        <TabPanel header="Targets" headerClassName="tcc-targets">
          <TargetsHandset canEdit={canEdit} />
        </TabPanel>
        <TabPanel header="Pointing" headerClassName="tcc-pointing">
          <PointingHandset canEdit={canEdit} />
        </TabPanel>
        <TabPanel header="Instrument" headerClassName="tcc-instrument">
          <InstrumentHandset canEdit={canEdit} />
        </TabPanel>
      </TabView>
    </div>
  );
}
