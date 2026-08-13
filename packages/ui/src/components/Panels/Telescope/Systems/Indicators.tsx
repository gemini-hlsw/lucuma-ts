import { useTargets } from '@gql/configs/Target';
import { AOWFS, CRCS, EcsDome, EcsShutters, MCS, OIWFS, PWFS1, PWFS2, SCS } from '@gql/server/Buttons';
import { useTelescopeState } from '@gql/server/TelescopeState';
import { Button } from 'primereact/button';

export function Indicators({ canEdit }: { canEdit: boolean }) {
  const { data, loading: telescopeLoading } = useTelescopeState({ useStale: false });
  const { data: targetsData, loading: targetsLoading } = useTargets();

  const loading = telescopeLoading || targetsLoading;

  const buttonProps = { loading, disabled: !canEdit };

  return (
    <div className="left">
      <MCS label="MCS" state={data?.mount} {...buttonProps} />
      <SCS label="SCS" state={data?.scs} {...buttonProps} />
      <CRCS label="CRCS" state={data?.crcs} {...buttonProps} />
      <PWFS1 label="PWFS1" state={data?.pwfs1} inUse={Boolean(targetsData.p1Targets.length)} {...buttonProps} />
      <PWFS2 label="PWFS2" state={data?.pwfs2} inUse={Boolean(targetsData.p2Targets.length)} {...buttonProps} />
      <OIWFS label="OIWFS" state={data?.oiwfs} inUse={Boolean(targetsData.oiTargets.length)} {...buttonProps} />
      <Button className="under-construction" loading={loading} disabled={!canEdit} label="ODGW" />
      <AOWFS label="AOWFS" loading={loading} disabled={!canEdit} />
      <EcsDome label="Dome" enclosure={data?.enclosure} {...buttonProps} />
      <EcsShutters label="Shutters" enclosure={data?.enclosure} {...buttonProps} />
      <Button className="under-construction" loading={loading} disabled={!canEdit} label="W VGate" />
      <Button className="under-construction" loading={loading} disabled={!canEdit} label="E VGate" />
    </div>
  );
}
