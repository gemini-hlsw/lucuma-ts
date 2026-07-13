import './TimeAwardsGrid.css';

import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { type JSX, useMemo, useState } from 'react';

import { CirclePlus, CircleXMark, Plus } from '@/components/Icons';
import { type Partner, PARTNER_NAME, PARTNERS } from '@/gql/sso/roster';
import { type Allocation, BAND_LABEL, BANDS, type ScienceBand } from '@/gql/types';

export interface TimeAwardsGridProps {
  readonly allocations: readonly Allocation[];
  readonly onChange: (allocations: readonly Allocation[]) => void;
}

/**
 * Editable partner × science-band hours grid ("Time Awards" in the mockups),
 * with add/remove partner rows and live row/column/grand totals. Shared by the
 * Programs editor (sc-9090) and the Proposals accept flow (sc-9092), both of
 * which persist it via the ODB setAllocations mutation.
 */
export function TimeAwardsGrid({ allocations, onChange }: TimeAwardsGridProps): JSX.Element {
  const partnerRows = useMemo(() => [...new Set(allocations.map((a) => a.category))], [allocations]);
  const availablePartners = PARTNERS.filter((p) => !partnerRows.includes(p));
  const [partnerToAdd, setPartnerToAdd] = useState<Partner | null>(null);

  function hoursFor(category: Partner, band: ScienceBand): number {
    return allocations.find((a) => a.category === category && a.scienceBand === band)?.hours ?? 0;
  }
  function setHours(category: Partner, band: ScienceBand, hours: number): void {
    // Keep zero-hour cells: dropping them would remove the partner's row when
    // its last non-zero cell is cleared. allocationsInput filters zeros out
    // of the mutation instead.
    const rest = allocations.filter((a) => !(a.category === category && a.scienceBand === band));
    onChange([...rest, { category, scienceBand: band, hours }]);
  }
  function addPartner(category: Partner): void {
    // Seed a zero Band-1 cell so the row appears; user fills the rest.
    onChange([...allocations, { category, scienceBand: 'BAND1', hours: 0 }]);
  }
  function removePartner(category: Partner): void {
    onChange(allocations.filter((a) => a.category !== category));
  }

  const bandTotal = (band: ScienceBand): number => partnerRows.reduce((sum, p) => sum + hoursFor(p, band), 0);
  const grandTotal = BANDS.reduce((sum, b) => sum + bandTotal(b), 0);

  return (
    <table className="awards-grid">
      <thead>
        <tr>
          <th />
          <th className="awards-partner-h">Partner</th>
          {BANDS.map((b) => (
            <th key={b}>{BAND_LABEL[b]}</th>
          ))}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {partnerRows.map((partner) => {
          const rowTotal = BANDS.reduce((sum, b) => sum + hoursFor(partner, b), 0);
          return (
            <tr key={partner}>
              <td className="awards-del">
                <button
                  type="button"
                  title={`Remove ${PARTNER_NAME[partner]} (${partner}) and all its band allocations`}
                  onClick={() => removePartner(partner)}
                >
                  <CircleXMark />
                </button>
              </td>
              <td className="awards-partner">
                <strong>{partner}</strong> {PARTNER_NAME[partner]}
              </td>
              {BANDS.map((b) => (
                <td key={b}>
                  <InputNumber
                    value={hoursFor(partner, b)}
                    min={0}
                    minFractionDigits={1}
                    maxFractionDigits={1}
                    onValueChange={(e) => setHours(partner, b, e.value ?? 0)}
                    inputClassName="awards-cell-input"
                  />
                </td>
              ))}
              <td className="awards-total">{rowTotal.toFixed(1)}</td>
            </tr>
          );
        })}
        <tr className="awards-add-row">
          <td className="awards-del">
            <CirclePlus />
          </td>
          <td colSpan={BANDS.length + 2}>
            <div className="awards-add">
              <Dropdown
                value={partnerToAdd}
                options={availablePartners.map((p) => ({ label: `${p} — ${PARTNER_NAME[p]}`, value: p }))}
                onChange={(e) => setPartnerToAdd(e.value as Partner)}
                placeholder="Add partner"
                disabled={availablePartners.length === 0}
                tooltip="Add a time-accounting partner row to the grid (only partners not already listed appear here)."
                tooltipOptions={{ position: 'top' }}
              />
              <Button
                text
                label="Add"
                icon={<Plus />}
                disabled={!partnerToAdd}
                tooltip="Add the selected partner as a new row, ready for you to enter its band hours."
                tooltipOptions={{ position: 'top' }}
                onClick={() => {
                  if (partnerToAdd) {
                    addPartner(partnerToAdd);
                    setPartnerToAdd(null);
                  }
                }}
              />
            </div>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td />
          <td className="awards-partner">
            <strong>Total</strong>
          </td>
          {BANDS.map((b) => (
            <td key={b} className="awards-total">
              {bandTotal(b).toFixed(1)}
            </td>
          ))}
          <td className="awards-total">{grandTotal.toFixed(1)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
