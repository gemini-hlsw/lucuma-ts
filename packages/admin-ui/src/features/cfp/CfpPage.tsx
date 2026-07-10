import './CfpPage.css';

import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { type JSX, useMemo, useState } from 'react';

import { type Partner, PARTNER_NAME, PARTNERS } from '@/auth/ssoGraphql';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { Tile } from '@/components/Tile';
import { useToast } from '@/components/toastContext';
import { cfpPropertiesInput, CFPS_QUERY, CREATE_CFP_MUTATION, mapCfps, UPDATE_CFP_MUTATION } from '@/gql/cfp';
import type { CallForProposalsPropertiesInput } from '@/gql/gen/graphql';
import {
  type CallForProposals,
  CFP_TYPE_LABEL,
  type CfpType,
  INSTRUMENT_LABEL,
  INSTRUMENTS,
  type SiteCoordinateLimits,
} from '@/gql/types';
import { useOdbData, useOdbMutation } from '@/gql/useOdbData';

const CFP_TYPES = Object.keys(CFP_TYPE_LABEL) as CfpType[];
const EMPTY_CFPS: CallForProposals[] = [];

/** Facet options for the Open column: show open calls, closed calls, or all. */
const OPEN_FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
] as const;
type OpenFilter = (typeof OPEN_FILTER_OPTIONS)[number]['value'];

/** Gemini semester containing today: A runs Feb–Jul, B runs Aug–Jan (January
 *  belongs to the previous year's B). Seeds newly created calls. */
function currentSemester(): string {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  if (month === 1) return `${String(now.getUTCFullYear() - 1)}B`;
  return `${String(now.getUTCFullYear())}${month < 8 ? 'A' : 'B'}`;
}

/** A semester's active date range — the ODB requires activeStart/activeEnd on
 *  create. A: Feb 1 – Aug 1; B: Aug 1 – Feb 1 of the next year. */
function semesterDates(semester: string): { activeStart: string; activeEnd: string } {
  const year = Number(semester.slice(0, 4));
  return semester.endsWith('A')
    ? { activeStart: `${String(year)}-02-01`, activeEnd: `${String(year)}-08-01` }
    : { activeStart: `${String(year)}-08-01`, activeEnd: `${String(year + 1)}-02-01` };
}

/**
 * Calls for Proposals view (sc-9098). Layout follows the mockup: a Calls table
 * (open-status faceted, sortable, Copy / New) over a three-column Selected Call
 * editor — parameters & coordinate limits | Partners & Deadlines | Instruments
 * checklist. Live ODB data backs the list; Save / New / Copy call the real
 * updateCallsForProposals / createCallForProposals mutations.
 */
export default function CfpPage(): JSX.Element {
  const toast = useToast();
  const { data: cfps, status, error, refetch } = useOdbData(CFPS_QUERY, mapCfps, EMPTY_CFPS);
  const mutate = useOdbMutation();
  const [saving, setSaving] = useState(false);

  const [typeFilter, setTypeFilter] = useState<CfpType | 'all'>('all');
  const [openFilter, setOpenFilter] = useState<OpenFilter>('all');
  const visibleCfps = useMemo(
    () =>
      cfps.filter(
        (c) =>
          (typeFilter === 'all' || c.type === typeFilter) &&
          (openFilter === 'all' || c.active === (openFilter === 'open')),
      ),
    [cfps, typeFilter, openFilter],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? cfps[0]?.id ?? '';
  const original = useMemo(() => cfps.find((c) => c.id === activeId) ?? cfps[0], [cfps, activeId]);

  async function save(draft: CallForProposals): Promise<void> {
    setSaving(true);
    try {
      await mutate(UPDATE_CFP_MUTATION, { id: draft.id, SET: cfpPropertiesInput(draft) });
      toast.success('Call saved', draft.title || draft.id);
      refetch();
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  /** Create a call and select it. `SET` is a fresh minimal call for New, or the
   *  selected call's full properties for Copy. */
  async function create(SET: CallForProposalsPropertiesInput, verb: string): Promise<void> {
    setSaving(true);
    try {
      const data = await mutate(CREATE_CFP_MUTATION, { SET });
      const newId = data.createCallForProposals.callForProposals?.id;
      if (newId) setSelectedId(newId);
      toast.success(`Call ${verb}`, newId ?? '');
      refetch();
    } catch (err) {
      toast.error(`${verb === 'created' ? 'Create' : 'Copy'} failed`, err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Tile
        title="Calls for Proposals"
        flush
        controls={
          <>
            <DataSourceBadge status={status} error={error} empty={cfps.length === 0} />
            <Dropdown
              value={openFilter}
              options={[...OPEN_FILTER_OPTIONS]}
              onChange={(e) => setOpenFilter(e.value as OpenFilter)}
              tooltip="Show only open calls, only closed calls, or all."
              tooltipOptions={{ position: 'bottom' }}
              className="cfp-facet"
            />
            <Dropdown
              value={typeFilter}
              options={[
                { label: 'All types', value: 'all' },
                ...CFP_TYPES.map((t) => ({ label: CFP_TYPE_LABEL[t], value: t })),
              ]}
              onChange={(e) => setTypeFilter(e.value as CfpType | 'all')}
              tooltip="Show only calls of one type, or all."
              tooltipOptions={{ position: 'bottom' }}
              className="cfp-facet"
            />
            <Button
              text
              label="Copy"
              icon="pi pi-copy"
              disabled={!original || saving}
              tooltip="Duplicate the selected call as a starting point for a new one (everything but the id is copied)."
              tooltipOptions={{ position: 'bottom' }}
              onClick={() => {
                if (!original) return;
                void create({ ...cfpPropertiesInput(original), title: `${original.title} (copy)` }, 'copied');
              }}
            />
            <Button
              text
              label="New"
              icon="pi pi-plus"
              disabled={saving}
              tooltip="Create a brand-new Call for Proposals from scratch (ODB createCallForProposals)."
              tooltipOptions={{ position: 'bottom' }}
              onClick={() =>
                void create(
                  {
                    semester: currentSemester(),
                    ...semesterDates(currentSemester()),
                    gemini: { type: 'REGULAR_SEMESTER' },
                  },
                  'created',
                )
              }
            />
          </>
        }
      >
        <DataTable
          value={visibleCfps}
          dataKey="id"
          selectionMode="single"
          selection={original ?? undefined}
          onSelectionChange={(e) => setSelectedId((e.value as CallForProposals | null)?.id ?? null)}
          className="cfp-calls-table"
          emptyMessage={
            status === 'loading'
              ? 'Loading…'
              : status === 'no-token'
                ? 'Sign in to load calls.'
                : status === 'error'
                  ? (error ?? 'Could not load calls.')
                  : cfps.length > 0
                    ? 'No calls match the filters.'
                    : 'No calls visible to your role.'
          }
        >
          <Column
            header="Open"
            headerTooltip="Whether the call is currently open (green ✓) or closed (red ✗) — today's date compared against the latest submission deadline across all participating partners."
            style={{ width: '4rem' }}
            body={(c: CallForProposals) =>
              c.active ? (
                <i
                  className="pi pi-check-circle cfp-open-yes"
                  title="Open — today is on or before the latest partner submission deadline."
                />
              ) : (
                <i
                  className="pi pi-times-circle cfp-open-no"
                  title="Closed — every partner's submission deadline has passed."
                />
              )
            }
          />
          <Column
            field="title"
            header="Title"
            sortable
            headerTooltip="The call's display title. Click a row to edit it below; click the header to sort."
          />
          <Column
            field="type"
            header="Type"
            sortable
            headerTooltip="Call type — Regular Semester, Fast Turnaround, Large Program, Director's Time, or Poor Weather."
            body={(c: CallForProposals) => CFP_TYPE_LABEL[c.type]}
          />
          <Column
            field="semester"
            header="Semester"
            sortable
            headerTooltip="The semester this call belongs to (e.g. 2027B)."
            style={{ width: '8rem' }}
          />
          <Column
            field="activeStart"
            header="Start"
            sortable
            headerTooltip="First day the call accepts submissions."
            style={{ width: '9rem' }}
          />
          <Column
            field="activeEnd"
            header="End"
            sortable
            headerTooltip="Last day the call accepts submissions."
            style={{ width: '9rem' }}
          />
          <Column
            field="id"
            header="Id"
            headerTooltip="The call's ODB identifier (read-only)."
            style={{ width: '6rem' }}
          />
        </DataTable>
      </Tile>

      {original && <CfpEditor key={original.id} original={original} saving={saving} onSave={save} />}
    </>
  );
}

/** The Selected Call editor. Keyed by call id from the parent, so switching
 *  calls remounts it with a fresh draft — no reset-during-render bookkeeping. */
function CfpEditor({
  original,
  saving,
  onSave,
}: {
  readonly original: CallForProposals;
  readonly saving: boolean;
  readonly onSave: (draft: CallForProposals) => Promise<void>;
}): JSX.Element {
  const [draft, setDraft] = useState<CallForProposals>(original);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);

  function set<K extends keyof CallForProposals>(key: K, value: CallForProposals[K]): void {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function setLimit(site: 'north' | 'south', key: keyof SiteCoordinateLimits, value: number): void {
    setDraft((d) => ({ ...d, [site]: { ...d[site], [key]: value } }));
  }
  function toggleInstrument(name: string): void {
    setDraft((d) => ({
      ...d,
      instruments: d.instruments.includes(name) ? d.instruments.filter((i) => i !== name) : [...d.instruments, name],
    }));
  }
  function partnerEnabled(p: Partner): boolean {
    return draft.partners.some((x) => x.partner === p);
  }
  function togglePartner(p: Partner): void {
    setDraft((d) => ({
      ...d,
      partners: partnerEnabled(p) ? d.partners.filter((x) => x.partner !== p) : [...d.partners, { partner: p }],
    }));
  }
  function setPartnerDeadline(p: Partner, value: string): void {
    setDraft((d) => ({
      ...d,
      partners: d.partners.map((x) => (x.partner === p ? { ...x, deadlineOverride: value } : x)),
    }));
  }

  return (
    <Tile title={`Selected Call · ${draft.id}`}>
      <div className="cfp-editor">
        {/* Left column — parameters + coordinate limits */}
        <div className="cfp-col">
          <div className="cfp-form">
            <label title="The call's ODB identifier — assigned by the system and not editable.">Id</label>
            <span className="cfp-readonly">{draft.id}</span>

            <label htmlFor="cfp-title" title="The call's display title (e.g. “2027B Regular Semester”).">
              Title
            </label>
            <InputText id="cfp-title" value={draft.title} onChange={(e) => set('title', e.target.value)} />

            <label
              htmlFor="cfp-type"
              title="The kind of call — drives deadlines, review, and which proposal types are allowed."
            >
              Type
            </label>
            <Dropdown
              inputId="cfp-type"
              value={draft.type}
              options={CFP_TYPES.map((t) => ({ label: CFP_TYPE_LABEL[t], value: t }))}
              onChange={(e) => set('type', e.value as CfpType)}
            />

            <label htmlFor="cfp-sem" title="The semester this call is for (e.g. 2027B).">
              Semester
            </label>
            <InputText id="cfp-sem" value={draft.semester} onChange={(e) => set('semester', e.target.value)} />

            <label htmlFor="cfp-start" title="First day the call accepts submissions.">
              Active Start
            </label>
            <InputText
              id="cfp-start"
              value={draft.activeStart}
              placeholder="YYYY-MM-DD"
              onChange={(e) => set('activeStart', e.target.value)}
            />

            <label htmlFor="cfp-end" title="Last day the call accepts submissions.">
              Active End
            </label>
            <InputText
              id="cfp-end"
              value={draft.activeEnd}
              placeholder="YYYY-MM-DD"
              onChange={(e) => set('activeEnd', e.target.value)}
            />

            <label title="Whether PIs not affiliated with a partner country may submit — derived by the ODB from the call type, so not directly editable.">
              Allow non-Partner PI
            </label>
            <span className="cfp-readonly">{draft.allowsNonPartnerPi ? 'Yes' : 'No'}</span>

            <label
              htmlFor="cfp-prop"
              title="Default months data stay proprietary for programs awarded under this call."
            >
              Proprietary Period
            </label>
            <div className="cfp-suffixed">
              <InputNumber
                inputId="cfp-prop"
                value={draft.proprietaryMonths}
                min={0}
                max={36}
                onValueChange={(e) => set('proprietaryMonths', e.value ?? 0)}
              />
              <span className="cfp-suffix">months</span>
            </div>
          </div>

          <table
            className="cfp-coords"
            title="RA/Dec windows that bound where targets may lie for each Gemini site under this call (SiteCoordinateLimits)."
          >
            <tbody>
              {(['north', 'south'] as const).map((site) => (
                <tr key={site}>
                  <td
                    className="cfp-site"
                    title={`RA (hours) and Dec (degrees) limits for Gemini ${site === 'north' ? 'North (Maunakea)' : 'South (Cerro Pachón)'}.`}
                  >
                    Gemini {site === 'north' ? 'North' : 'South'}
                  </td>
                  <td>
                    <InputNumber
                      value={draft[site].raStart}
                      suffix=" h"
                      maxFractionDigits={1}
                      onValueChange={(e) => setLimit(site, 'raStart', e.value ?? 0)}
                      inputClassName="cfp-coord-input"
                    />
                  </td>
                  <td className="cfp-le">≤ RA ≤</td>
                  <td>
                    <InputNumber
                      value={draft[site].raEnd}
                      suffix=" h"
                      maxFractionDigits={1}
                      onValueChange={(e) => setLimit(site, 'raEnd', e.value ?? 0)}
                      inputClassName="cfp-coord-input"
                    />
                  </td>
                  <td>
                    <InputNumber
                      value={draft[site].decStart}
                      suffix="°"
                      onValueChange={(e) => setLimit(site, 'decStart', e.value ?? 0)}
                      inputClassName="cfp-coord-input"
                    />
                  </td>
                  <td className="cfp-le">≤ Dec ≤</td>
                  <td>
                    <InputNumber
                      value={draft[site].decEnd}
                      suffix="°"
                      onValueChange={(e) => setLimit(site, 'decEnd', e.value ?? 0)}
                      inputClassName="cfp-coord-input"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Middle column — Partners & Deadlines */}
        <div className="cfp-col">
          <h3
            className="cfp-col-title"
            title="Which partner countries participate in this call, and each one's submission deadline."
          >
            Partners &amp; Deadlines
          </h3>
          <div className="cfp-default-deadline">
            <span
              className="cfp-dd-label"
              title="The deadline applied to any partner that doesn't set its own override below."
            >
              Default Deadline
            </span>
            <InputText
              value={draft.defaultDeadline}
              placeholder="YYYY-MM-DD HH:MM:SS"
              onChange={(e) => set('defaultDeadline', e.target.value)}
            />
          </div>
          <table className="cfp-partners">
            <thead>
              <tr>
                <th title="Tick a partner to include it in this call.">Partner</th>
                <th title="Optional per-partner deadline; leave blank to use the default deadline above.">
                  Custom Deadline
                </th>
              </tr>
            </thead>
            <tbody>
              {PARTNERS.map((p) => {
                const row = draft.partners.find((x) => x.partner === p);
                return (
                  <tr key={p}>
                    <td className="cfp-partner-cell" title={`Include ${PARTNER_NAME[p]} (${p}) in this call.`}>
                      <Checkbox checked={partnerEnabled(p)} onChange={() => togglePartner(p)} />
                      <span>{p}</span>
                    </td>
                    <td>
                      <InputText
                        value={row?.deadlineOverride ?? ''}
                        placeholder="default"
                        disabled={!partnerEnabled(p)}
                        title={`Override ${PARTNER_NAME[p]}'s deadline (blank = use the default).`}
                        onChange={(e) => setPartnerDeadline(p, e.target.value)}
                        className="cfp-deadline-input"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right column — Instruments */}
        <div className="cfp-col">
          <h3
            className="cfp-col-title"
            title="Which instruments are offered in this call. Proposals may only request checked instruments."
          >
            Instruments
          </h3>
          <div className="cfp-instruments">
            {INSTRUMENTS.map((name) => (
              <label key={name} className="cfp-instrument" title={`Offer ${INSTRUMENT_LABEL[name]} in this call.`}>
                <Checkbox checked={draft.instruments.includes(name)} onChange={() => toggleInstrument(name)} />
                <span>{INSTRUMENT_LABEL[name]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="cfp-actions">
        {/* title-spans so the hint shows even while disabled. */}
        <span
          title={
            dirty ? 'Discard unsaved edits to this call and revert to the loaded values.' : 'No changes to discard.'
          }
        >
          <Button text label="Cancel" icon="pi pi-times" disabled={!dirty} onClick={() => setDraft(original)} />
        </span>
        <span
          title={
            dirty
              ? 'Save the call via updateCallsForProposals, then reload it from the ODB.'
              : 'Nothing to save — edit a field first.'
          }
        >
          <Button
            label="Save"
            icon="pi pi-upload"
            disabled={!dirty || saving}
            loading={saving}
            onClick={() => void onSave(draft)}
          />
        </span>
      </div>
    </Tile>
  );
}
