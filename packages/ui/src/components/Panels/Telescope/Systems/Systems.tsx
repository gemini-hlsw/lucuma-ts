import type { ReactNode } from 'react';
import { useState } from 'react';

import { useCanEdit } from '@/components/atoms/auth';
import { useServerConfigValue } from '@/components/atoms/config';
import { ChevronRight } from '@/components/Icons';

import { Altair, GeMS } from './AdaptiveOptics';
import { AgMechanism } from './AgMechanism';
import { Indicators } from './Indicators';
import { Instrument } from './Instrument';
import { M2Baffles } from './M2Baffles';
import { Rotator } from './Rotator';
import { BotSubsystems, TopSubsystems } from './Subsystems';

export function Systems() {
  const canEdit = useCanEdit();
  const { site } = useServerConfigValue();
  const [collapsed, setCollapsed] = useState(false);

  function toggle() {
    setCollapsed(!collapsed);
  }

  let aoSystem: ReactNode | null = null;
  if (site === 'GN') {
    aoSystem = <Altair canEdit={canEdit} />;
  } else if (site === 'GS') {
    aoSystem = <GeMS canEdit={canEdit} />;
  }

  return (
    <div className="systems">
      <Indicators canEdit={canEdit} />
      <div className={`grid-wrapper ${collapsed ? 'collapsed' : ''}`}>
        <TopSubsystems canEdit={canEdit} />
        <AgMechanism canEdit={canEdit} />
        <BotSubsystems canEdit={canEdit} />
        <div className="expand-button" onClick={toggle}>
          <ChevronRight />
        </div>
      </div>
      <div className="right">
        <Instrument canEdit={canEdit} />
        <Rotator canEdit={canEdit} />
        <M2Baffles canEdit={canEdit} />
        {aoSystem}
      </div>
    </div>
  );
}
