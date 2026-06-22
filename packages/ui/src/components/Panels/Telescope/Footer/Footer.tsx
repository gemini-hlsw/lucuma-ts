import { Slew } from '@gql/server/Buttons';
import { TitleDropdown } from '@Shared/Title/Title';
import { Button } from 'primereact/button';

import { useCanEdit } from '@/components/atoms/auth';
import { useSetSlewVisible } from '@/components/atoms/slew';
import { Gear } from '@/components/Icons';

import { ApplyParameters } from './ApplyParameters';

export function Footer() {
  const canEdit = useCanEdit();
  const setSlewVisible = useSetSlewVisible();

  return (
    <div className="footer">
      <TitleDropdown icon={<Gear />}>
        <Button
          disabled={!canEdit}
          className="p-button-text"
          label="Set slew flags"
          severity="info"
          onClick={() => setSlewVisible(true)}
        />
      </TitleDropdown>
      <Slew label="Slew Telescope" disabled={!canEdit} />
      <ApplyParameters canEdit={canEdit} />
      <div></div>
      <Button
        disabled={!canEdit}
        severity="danger"
        size="small"
        className="under-construction"
        label="Shutdown"
        aria-label="Shutdown"
      />
    </div>
  );
}
