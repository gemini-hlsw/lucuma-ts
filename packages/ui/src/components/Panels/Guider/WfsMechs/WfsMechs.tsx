import { Title } from '@Shared/Title/Title';
import { TabPanel, TabView } from 'primereact/tabview';

import { useCanEdit } from '@/components/atoms/auth';

import { ACHR } from './ACHR';
import { PWFS1, PWFS2 } from './PWFS';

export function WfsMechs() {
  const canEdit = useCanEdit();
  return (
    <div className="wfs-mechs">
      <Title title="Wavefront Sensors" />
      <div className="body">
        <TabView>
          <TabPanel header="PWFS1">
            <PWFS1 disabled={!canEdit} />
          </TabPanel>
          <TabPanel header="PWFS2">
            <PWFS2 disabled={!canEdit} />
          </TabPanel>
          <TabPanel header="OIWFS" className="under-construction"></TabPanel>
          <TabPanel header="AC/HR">
            <ACHR disabled={!canEdit} />
          </TabPanel>
        </TabView>
      </div>
    </div>
  );
}
