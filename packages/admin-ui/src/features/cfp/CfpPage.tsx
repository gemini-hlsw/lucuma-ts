import './CfpPage.css';

import { NumberInput } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Column, type ColumnSortEvent } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { SplitButton } from 'primereact/splitbutton';
import { type JSX, useMemo, useState } from 'react';

import { DataSourceBadge } from '@/components/DataSourceBadge';
import { CircleCheck, CircleXMark, Copy, Plus, Upload, XMark } from '@/components/Icons';
import { Tile } from '@/components/Tile';
import { useToast } from '@/components/toastContext';
import { friendlyError } from '@/gql/errors';
import { cfpPropertiesInput, mapCfps, newCallInput, useCfps, useCreateCfp, useUpdateCfp } from '@/gql/odb/cfp';
import type { CallForProposalsPropertiesInput } from '@/gql/odb/gen/graphql';
import { type Partner, PARTNER_NAME, PARTNERS } from '@/gql/sso/roster';
import {
  type CallForProposals,
  CFP_TYPE_LABEL,
  type CfpDetails,
  type CfpType,
  cfpTypeLabel,
  EXCHANGE_PARTNER_LABEL,
  EXCHANGE_PARTNERS,
  type ExchangePartner,
  INSTRUMENT_LABEL,
  INSTRUMENTS,
  KECK_INSTRUMENT_LABEL,
  KECK_INSTRUMENTS,
  type Observatory,
  OBSERVATORY_LABEL,
  type SiteCoordinateLimits,
  SUBARU_CFP_TYPE_LABEL,
  SUBARU_INSTRUMENT_LABEL,
  SUBARU_INSTRUMENTS,
  type SubaruCallForProposalsType,
} from '@/gql/types';

const CFP_TYPES = Object.keys(CFP_TYPE_LABEL) as CfpType[];
const SUBARU_CFP_TYPES = Object.keys(SUBARU_CFP_TYPE_LABEL) as SubaruCallForProposalsType[];
const OBSERVATORIES = Object.keys(OBSERVATORY_LABEL) as Observatory[];
const EMPTY_CFPS: CallForProposals[] = [];

/** The Gemini variant of the details union — the only observatory with exchange
 *  partners (sc-9610). Narrowed once via the `observatory` tag. */
type GeminiDetails = Extract<CfpDetails, { observatory: 'GEMINI' }>;

/** Facet options: All / Open / Closed show visible calls; Invisible shows the
 *  soft-deleted ones (sc-9612), which the first three hide. */
const OPEN_FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
  { label: 'Invisible', value: 'invisible' },
] as const;
type OpenFilter = (typeof OPEN_FILTER_OPTIONS)[number]['value'];

/** A DataTable `sortFunction` that orders rows by a rendered label rather than
 *  a raw field — the Observatory and Type columns show computed labels, so
 *  sorting must use the same text the cell displays. PrimeReact only invokes a
 *  `sortFunction` when the column also declares a (non-empty) `sortField`. */
function sortByLabel(label: (c: CallForProposals) => string) {
  return (e: ColumnSortEvent): CallForProposals[] => {
    const dir = e.order ?? 1;
    return [...(e.data as CallForProposals[])].sort((a, b) => dir * label(a).localeCompare(label(b)));
  };
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
  const { data, loading, error } = useCfps();
  const cfps = useMemo(() => (data ? mapCfps(data) : EMPTY_CFPS), [data]);
  const [updateCfp, { loading: updating }] = useUpdateCfp();
  const [createCfp, { loading: creating }] = useCreateCfp();
  const saving = updating || creating;

  const [observatoryFilter, setObservatoryFilter] = useState<Observatory | 'all'>('all');
  const [openFilter, setOpenFilter] = useState<OpenFilter>('all');
  const visibleCfps = useMemo(
    () =>
      cfps.filter((c) => {
        if (observatoryFilter !== 'all' && c.details.observatory !== observatoryFilter) return false;
        // "Invisible" shows only soft-deleted calls; every other facet shows
        // visible calls and additionally narrows by open status (sc-9612).
        if (openFilter === 'invisible') return !c.visible;
        if (!c.visible) return false;
        return openFilter === 'all' || c.active === (openFilter === 'open');
      }),
    [cfps, observatoryFilter, openFilter],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? cfps[0]?.id ?? '';
  const original = useMemo(() => cfps.find((c) => c.id === activeId) ?? cfps[0], [cfps, activeId]);

  async function save(draft: CallForProposals): Promise<void> {
    try {
      await updateCfp({ variables: { id: draft.id, set: cfpPropertiesInput(draft) } });
      toast.success('Call saved', draft.title || draft.id);
    } catch (err) {
      toast.error('Save failed', friendlyError(err));
    }
  }

  /** Create a call and select it. `set` is a fresh minimal call for New, or the
   *  selected call's full properties for Copy. */
  async function create(set: CallForProposalsPropertiesInput, verb: string): Promise<void> {
    try {
      const res = await createCfp({ variables: { set } });
      const newId = res.data?.createCallForProposals.callForProposals?.id;
      if (newId) setSelectedId(newId);
      toast.success(`Call ${verb}`, newId ?? '');
    } catch (err) {
      toast.error(`${verb === 'created' ? 'Create' : 'Copy'} failed`, friendlyError(err));
    }
  }

  return (
    <>
      <Tile
        title="Calls for Proposals"
        flush
        controls={
          <>
            <DataSourceBadge loading={loading} error={error && friendlyError(error)} empty={cfps.length === 0} />
            <Dropdown
              value={openFilter}
              options={[...OPEN_FILTER_OPTIONS]}
              onChange={(e) => setOpenFilter(e.value as OpenFilter)}
              tooltip="Show only open calls, only closed calls, or all."
              tooltipOptions={{ position: 'bottom' }}
              className="cfp-facet"
            />
            <Dropdown
              value={observatoryFilter}
              options={[
                { label: 'All observatories', value: 'all' },
                ...OBSERVATORIES.map((o) => ({ label: OBSERVATORY_LABEL[o], value: o })),
              ]}
              onChange={(e) => setObservatoryFilter(e.value as Observatory | 'all')}
              tooltip="Show only calls for one observatory (Gemini, or the Keck / Subaru exchange calls), or all."
              tooltipOptions={{ position: 'bottom' }}
              className="cfp-facet"
            />
            <Button
              text
              label="Copy"
              icon={<Copy />}
              disabled={!original || saving}
              tooltip="Duplicate the selected call as a starting point for a new one (everything but the id is copied)."
              tooltipOptions={{ position: 'bottom' }}
              onClick={() => {
                if (!original) return;
                void create({ ...cfpPropertiesInput(original), title: `${original.title} (copy)` }, 'copied');
              }}
            />
            <SplitButton
              text
              label="New"
              icon={<Plus />}
              disabled={saving}
              // The default click creates a Gemini call; the menu creates a call
              // for a specific observatory (each seeds its own properties block).
              onClick={() => void create(newCallInput('GEMINI'), 'created')}
              model={OBSERVATORIES.map((o) => ({
                label: `${OBSERVATORY_LABEL[o]} call`,
                command: () => void create(newCallInput(o), 'created'),
              }))}
              tooltip="Create a brand-new Call for Proposals — click for a Gemini call, or pick an observatory."
              tooltipOptions={{ position: 'bottom' }}
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
            loading
              ? 'Loading…'
              : error
                ? friendlyError(error)
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
                <span title="Open — today is on or before the latest partner submission deadline.">
                  <CircleCheck className="cfp-open-yes" />
                </span>
              ) : (
                <span title="Closed — every partner's submission deadline has passed.">
                  <CircleXMark className="cfp-open-no" />
                </span>
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
            header="Observatory"
            sortable
            // sortField activates PrimeReact's sort; sortFunction orders by the
            // displayed label so the order can't drift from the rendered cell.
            sortField="details.observatory"
            sortFunction={sortByLabel((c) => OBSERVATORY_LABEL[c.details.observatory])}
            headerTooltip="Which observatory the call solicits time for — Gemini, or a Keck / Subaru exchange call."
            style={{ width: '9rem' }}
            body={(c: CallForProposals) => OBSERVATORY_LABEL[c.details.observatory]}
          />
          <Column
            header="Type"
            sortable
            sortField="details.observatory"
            sortFunction={sortByLabel(cfpTypeLabel)}
            headerTooltip="Call type — the Gemini or Subaru call type, or the observatory name for Keck (which has no call type)."
            body={cfpTypeLabel}
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
  const details = draft.details;

  function set<K extends keyof CallForProposals>(key: K, value: CallForProposals[K]): void {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  /** Patch the observatory-specific block. Generic over the current variant, so
   *  the patch is type-checked against the observatory the caller has narrowed
   *  to (`current`) — merging two `D`s yields a `D`, no cast needed. */
  function setDetails<D extends CfpDetails>(current: D, patch: Partial<D>): void {
    setDraft((d) => ({ ...d, details: { ...current, ...patch } }));
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
  // Exchange partners (Keck/Subaru) live on the Gemini details block (sc-9610),
  // so these handlers narrow to the GEMINI variant before patching it. The
  // Partners table that calls them only renders for Gemini calls.
  function exchangeEnabled(g: GeminiDetails, p: ExchangePartner): boolean {
    return g.exchangePartners.some((x) => x.partner === p);
  }
  function toggleExchange(g: GeminiDetails, p: ExchangePartner): void {
    setDetails(g, {
      exchangePartners: exchangeEnabled(g, p)
        ? g.exchangePartners.filter((x) => x.partner !== p)
        : [...g.exchangePartners, { partner: p }],
    });
  }
  function setExchangeDeadline(g: GeminiDetails, p: ExchangePartner, value: string): void {
    setDetails(g, {
      exchangePartners: g.exchangePartners.map((x) => (x.partner === p ? { ...x, deadlineOverride: value } : x)),
    });
  }

  return (
    <Tile title={`Selected Call · ${draft.id} · ${OBSERVATORY_LABEL[details.observatory]}`}>
      <div className="cfp-editor">
        {/* Left column — parameters + coordinate limits */}
        <div className="cfp-col">
          <div className="cfp-form">
            <label title="The call's ODB identifier — assigned by the system and not editable.">Id</label>
            <span className="cfp-readonly">{draft.id}</span>

            <label title="Which observatory the call solicits time for — set when the call is created and not editable afterward.">
              Observatory
            </label>
            <span className="cfp-readonly">{OBSERVATORY_LABEL[details.observatory]}</span>

            <label htmlFor="cfp-title" title="The call's display title (e.g. “2027B Regular Semester”).">
              Title
            </label>
            <InputText id="cfp-title" value={draft.title} onChange={(e) => set('title', e.target.value)} />

            {details.observatory === 'GEMINI' && (
              <>
                <label
                  htmlFor="cfp-type"
                  title="The kind of call — drives deadlines, review, and which proposal types are allowed."
                >
                  Type
                </label>
                <Dropdown
                  inputId="cfp-type"
                  value={details.type}
                  options={CFP_TYPES.map((t) => ({ label: CFP_TYPE_LABEL[t], value: t }))}
                  onChange={(e) => setDetails(details, { type: e.value as CfpType })}
                />
              </>
            )}
            {details.observatory === 'SUBARU' && (
              <>
                <label htmlFor="cfp-type" title="The Subaru proposal type.">
                  Type
                </label>
                <Dropdown
                  inputId="cfp-type"
                  value={details.type}
                  options={SUBARU_CFP_TYPES.map((t) => ({ label: SUBARU_CFP_TYPE_LABEL[t], value: t }))}
                  onChange={(e) => setDetails(details, { type: e.value as SubaruCallForProposalsType })}
                />
              </>
            )}

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

            {details.observatory === 'GEMINI' && (
              <>
                <label title="Whether PIs not affiliated with a partner country may submit — derived by the ODB from the call type, so not directly editable.">
                  Allow non-Partner PI
                </label>
                <span className="cfp-readonly">{details.allowsNonPartnerPi ? 'Yes' : 'No'}</span>

                <label
                  htmlFor="cfp-prop"
                  title="Default months data stay proprietary for programs awarded under this call."
                >
                  Proprietary Period
                </label>
                <div className="cfp-suffixed">
                  <NumberInput
                    inputId="cfp-prop"
                    value={details.proprietaryMonths}
                    min={0}
                    max={36}
                    onValueChange={(e) => setDetails(details, { proprietaryMonths: e.value ?? 0 })}
                  />
                  <span className="cfp-suffix">months</span>
                </div>
              </>
            )}

            <label
              htmlFor="cfp-visible"
              title="Whether this call is visible. Unchecking soft-deletes it (ODB existence = DELETED); it stays reachable via the Invisible filter."
            >
              Visible
            </label>
            <Checkbox
              inputId="cfp-visible"
              checked={draft.visible}
              onChange={(e) => set('visible', e.checked ?? false)}
            />
          </div>

          <CoordinateLimits details={details} onChange={(next) => set('details', next)} />
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
              {/* Exchange partners (Keck/Subaru) — Gemini calls only (sc-9610),
                  same checkbox + custom-deadline treatment as the partners above. */}
              {details.observatory === 'GEMINI' && (
                <>
                  <tr>
                    <th
                      colSpan={2}
                      className="cfp-partners-group"
                      title="Exchange partners (Keck, Subaru) that may apply for Gemini time on this call."
                    >
                      Exchange
                    </th>
                  </tr>
                  {EXCHANGE_PARTNERS.map((p) => {
                    const enabled = exchangeEnabled(details, p);
                    const row = details.exchangePartners.find((x) => x.partner === p);
                    return (
                      <tr key={p}>
                        <td className="cfp-partner-cell" title={`Include ${EXCHANGE_PARTNER_LABEL[p]} in this call.`}>
                          <Checkbox checked={enabled} onChange={() => toggleExchange(details, p)} />
                          <span>{EXCHANGE_PARTNER_LABEL[p]}</span>
                        </td>
                        <td>
                          <InputText
                            value={row?.deadlineOverride ?? ''}
                            placeholder="default"
                            disabled={!enabled}
                            title={`Override ${EXCHANGE_PARTNER_LABEL[p]}'s deadline (blank = use the default).`}
                            onChange={(e) => setExchangeDeadline(details, p, e.target.value)}
                            className="cfp-deadline-input"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Right column — Instruments (each observatory has its own set) */}
        <div className="cfp-col">
          <h3
            className="cfp-col-title"
            title="Which instruments are offered in this call. Proposals may only request checked instruments."
          >
            Instruments
          </h3>
          <Instruments details={details} onChange={(next) => set('details', next)} />
        </div>
      </div>

      <div className="cfp-actions">
        {/* title-spans so the hint shows even while disabled. */}
        <span
          title={
            dirty ? 'Discard unsaved edits to this call and revert to the loaded values.' : 'No changes to discard.'
          }
        >
          <Button text label="Cancel" icon={<XMark />} disabled={!dirty} onClick={() => setDraft(original)} />
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
            icon={<Upload />}
            disabled={!dirty || saving}
            loading={saving}
            onClick={() => void onSave(draft)}
          />
        </span>
      </div>
    </Tile>
  );
}

/** Coordinate-limit editor: Gemini has per-site (North/South) windows; Keck and
 *  Subaru have a single window. Each row edits one site's RA/Dec limits. */
function CoordinateLimits({
  details,
  onChange,
}: {
  readonly details: CfpDetails;
  readonly onChange: (next: CfpDetails) => void;
}): JSX.Element {
  // One row per site: its label, current limits, and how to write them back —
  // each `update` rebuilds the whole (narrowed) variant, so no cast is needed.
  const sites: { label: string; limits: SiteCoordinateLimits; update: (limits: SiteCoordinateLimits) => void }[] =
    details.observatory === 'GEMINI'
      ? [
          { label: 'Gemini North', limits: details.north, update: (north) => onChange({ ...details, north }) },
          { label: 'Gemini South', limits: details.south, update: (south) => onChange({ ...details, south }) },
        ]
      : [
          {
            label: OBSERVATORY_LABEL[details.observatory],
            limits: details.limits,
            update: (limits) => onChange({ ...details, limits }),
          },
        ];

  return (
    <table
      className="cfp-coords"
      title="RA/Dec windows that bound where targets may lie under this call (CoordinateLimits)."
    >
      <tbody>
        {sites.map(({ label, limits, update }) => (
          <tr key={label}>
            <td className="cfp-site" title={`RA (hours) and Dec (degrees) limits for ${label}.`}>
              {label}
            </td>
            <td>
              <NumberInput
                value={limits.raStart}
                suffix=" h"
                maxFractionDigits={1}
                onValueChange={(e) => update({ ...limits, raStart: e.value ?? 0 })}
                inputClassName="cfp-coord-input"
              />
            </td>
            <td className="cfp-le">≤ RA ≤</td>
            <td>
              <NumberInput
                value={limits.raEnd}
                suffix=" h"
                maxFractionDigits={1}
                onValueChange={(e) => update({ ...limits, raEnd: e.value ?? 0 })}
                inputClassName="cfp-coord-input"
              />
            </td>
            <td>
              <NumberInput
                value={limits.decStart}
                suffix="°"
                onValueChange={(e) => update({ ...limits, decStart: e.value ?? 0 })}
                inputClassName="cfp-coord-input"
              />
            </td>
            <td className="cfp-le">≤ Dec ≤</td>
            <td>
              <NumberInput
                value={limits.decEnd}
                suffix="°"
                onValueChange={(e) => update({ ...limits, decEnd: e.value ?? 0 })}
                inputClassName="cfp-coord-input"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Instrument checklist for the call's observatory — each observatory offers a
 *  different set of instruments (sc-9608). Toggling adds/removes the enum value. */
function Instruments({
  details,
  onChange,
}: {
  readonly details: CfpDetails;
  readonly onChange: (next: CfpDetails) => void;
}): JSX.Element {
  // Each observatory offers a different instrument enum. A per-variant row
  // (label + selected + toggle) keeps every value typed to its own enum, so
  // flipping one rebuilds the narrowed variant with no cast.
  const rows =
    details.observatory === 'GEMINI'
      ? INSTRUMENTS.map((i) => ({
          label: INSTRUMENT_LABEL[i],
          selected: details.instruments.includes(i),
          toggle: () => onChange({ ...details, instruments: toggled(details.instruments, i) }),
        }))
      : details.observatory === 'KECK'
        ? KECK_INSTRUMENTS.map((i) => ({
            label: KECK_INSTRUMENT_LABEL[i],
            selected: details.instruments.includes(i),
            toggle: () => onChange({ ...details, instruments: toggled(details.instruments, i) }),
          }))
        : SUBARU_INSTRUMENTS.map((i) => ({
            label: SUBARU_INSTRUMENT_LABEL[i],
            selected: details.instruments.includes(i),
            toggle: () => onChange({ ...details, instruments: toggled(details.instruments, i) }),
          }));

  return (
    <div className="cfp-instruments">
      {rows.map(({ label, selected, toggle }) => (
        <label key={label} className="cfp-instrument" title={`Offer ${label} in this call.`}>
          <Checkbox checked={selected} onChange={toggle} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

/** Add `value` to `list` if absent, remove it if present — preserving the
 *  list's element type so it stays a valid instrument list for its observatory. */
function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((i) => i !== value) : [...list, value];
}
