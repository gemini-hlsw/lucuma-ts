import './TimeAwardsGrid.css';

import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { type JSX, useMemo, useState } from 'react';

import { CirclePlus, CircleXMark, Plus } from '@/components/Icons';
import {
  type Allocation,
  BAND_LABEL,
  BANDS,
  type ScienceBand,
  TIME_ACCOUNTING_CATEGORIES,
  TIME_ACCOUNTING_CATEGORY_LABEL,
  type TimeAccountingCategory,
} from '@/gql/types';

export interface TimeAwardsGridProps {
  readonly allocations: readonly Allocation[];
  readonly onChange: (allocations: readonly Allocation[]) => void;
}

/**
 * Editable time-accounting-category × science-band hours grid ("Time Awards"
 * in the mockups), with add/remove category rows and live row/column/grand
 * totals. Categories span the partner countries plus exchanges and the
 * observatory's Calibration/Engineering time (sc-9670). Shared by the Programs
 * editor (sc-9090) and the Proposals accept flow (sc-9092), both of which
 * persist it via the ODB setAllocations mutation.
 */
export function TimeAwardsGrid({ allocations, onChange }: TimeAwardsGridProps): JSX.Element {
  const categoryRows = useMemo(() => [...new Set(allocations.map((a) => a.category))], [allocations]);
  const availableCategories = useMemo(
    () => TIME_ACCOUNTING_CATEGORIES.filter((c) => !categoryRows.includes(c)),
    [categoryRows],
  );
  const [categoryToAdd, setCategoryToAdd] = useState<TimeAccountingCategory | null>(null);

  function hoursFor(category: TimeAccountingCategory, band: ScienceBand): number {
    return allocations.find((a) => a.category === category && a.scienceBand === band)?.hours ?? 0;
  }
  function setHours(category: TimeAccountingCategory, band: ScienceBand, hours: number): void {
    // Keep zero-hour cells: dropping them would remove the category's row when
    // its last non-zero cell is cleared. allocationsInput filters zeros out
    // of the mutation instead.
    const rest = allocations.filter((a) => !(a.category === category && a.scienceBand === band));
    onChange([...rest, { category, scienceBand: band, hours }]);
  }
  function addCategory(category: TimeAccountingCategory): void {
    // Seed a zero Band-1 cell so the row appears; user fills the rest.
    onChange([...allocations, { category, scienceBand: 'BAND1', hours: 0 }]);
  }
  function removeCategory(category: TimeAccountingCategory): void {
    onChange(allocations.filter((a) => a.category !== category));
  }

  const bandTotal = (band: ScienceBand): number => categoryRows.reduce((sum, c) => sum + hoursFor(c, band), 0);
  const grandTotal = BANDS.reduce((sum, b) => sum + bandTotal(b), 0);

  return (
    <table className="awards-grid">
      <thead>
        <tr>
          <th />
          <th className="awards-category-h">Time Award</th>
          {BANDS.map((b) => (
            <th key={b}>{BAND_LABEL[b]}</th>
          ))}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {categoryRows.map((category) => {
          const rowTotal = BANDS.reduce((sum, b) => sum + hoursFor(category, b), 0);
          return (
            <tr key={category}>
              <td className="awards-del">
                <button
                  type="button"
                  title={`Remove ${TIME_ACCOUNTING_CATEGORY_LABEL[category]} (${category}) and all its band allocations`}
                  onClick={() => removeCategory(category)}
                >
                  <CircleXMark />
                </button>
              </td>
              <td className="awards-category">
                <strong>{category}</strong> {TIME_ACCOUNTING_CATEGORY_LABEL[category]}
              </td>
              {BANDS.map((b) => (
                <td key={b}>
                  <InputNumber
                    value={hoursFor(category, b)}
                    min={0}
                    minFractionDigits={1}
                    maxFractionDigits={1}
                    onValueChange={(e) => setHours(category, b, e.value ?? 0)}
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
                value={categoryToAdd}
                options={availableCategories.map((c) => ({
                  label: `${c} — ${TIME_ACCOUNTING_CATEGORY_LABEL[c]}`,
                  value: c,
                }))}
                onChange={(e) => setCategoryToAdd(e.value as TimeAccountingCategory)}
                placeholder="Add category"
                disabled={availableCategories.length === 0}
                tooltip="Add a time-accounting category row to the grid (only categories not already listed appear here)."
                tooltipOptions={{ position: 'top' }}
              />
              <Button
                text
                label="Add"
                icon={<Plus />}
                disabled={!categoryToAdd}
                tooltip="Add the selected category as a new row, ready for you to enter its band hours."
                tooltipOptions={{ position: 'top' }}
                onClick={() => {
                  if (categoryToAdd) {
                    addCategory(categoryToAdd);
                    setCategoryToAdd(null);
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
          <td className="awards-category">
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
