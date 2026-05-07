import { Title } from '@Shared/Title/Title';

import type { Target } from '@/types';

export function TargetDetails({ target }: { target: Target | undefined }) {
  return (
    <div>
      <Title title={`Selected target ${target?.name ?? ''}`} />
      <div className="target-details">
        <span>HA:</span>
        <span>{0}</span>
        <span>Elevation:</span>
        <span>{0}</span>
        <span></span>
        <span></span>
        <span>Azimuth:</span>
        <span>{0}</span>
        <span>Wrap p1:</span>
        <span>{0}</span>
        <span>Wrap p2:</span>
        <span>{0}</span>
        <span>Rotator:</span>
        <span>{0}</span>
        <span>Wrap p1:</span>
        <span>{0}</span>
        <span>Wrap p2:</span>
        <span>{0}</span>
        <span>Zenith dist:</span>
        <span>{0}</span>
        <span>Moon dist:</span>
        <span>{0}</span>
      </div>
    </div>
  );
}
