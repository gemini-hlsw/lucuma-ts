import './ReviewView.css';

import { cn } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { InputTextarea } from 'primereact/inputtextarea';
import { type JSX, type ReactNode, useState } from 'react';

import { ConflictsTable } from '@/components/ConflictsTable';
import { DuplicatesTable } from '@/components/DuplicatesTable';
import { Tile } from '@/components/Tile';
import type { ObservationRow } from '@/gql/types';

/** Minimal shape both Proposals and Change Requests satisfy, so this view can
 *  render either. Each page supplies the type-specific bits via props. */
export interface ReviewItem {
  readonly id: string;
  readonly resolved: boolean;
  readonly observations: readonly ObservationRow[];
}

export interface ReviewColumn<T> {
  readonly header: string;
  readonly value: (item: T) => ReactNode;
  readonly width?: string;
  /** Optional hover description for the column header. */
  readonly headerTooltip?: string;
}

export interface ReviewViewProps<T extends ReviewItem> {
  readonly title: string;
  readonly blurb: string;
  readonly badge: ReactNode;
  /** Facet controls (status/type/semester dropdowns…) shown in the list tile's
   *  control strip. The page owns the filtering and passes `items` already
   *  narrowed — per Andy's sc-9092 note the old Resolved/Unresolved toggle is
   *  gone in favour of status filtering. */
  readonly controls?: ReactNode;
  /** True while the page's resolve mutation is in flight (disables Resolve). */
  readonly resolving?: boolean;
  readonly items: readonly T[];
  /** Columns for the master list table. */
  readonly columns: readonly ReviewColumn<T>[];
  /** The detail panel's body for the selected item (abstract, justification…). */
  readonly renderDetail: (item: T) => ReactNode;
  /** Optional extra panel between the observations table and the response box
   *  (Proposals uses this for its Accept/Reject Decision panel). */
  readonly renderExtra?: (item: T, decision: Decision | null) => ReactNode;
  /** Boilerplate response seeded when the reviewer picks accept / reject. */
  readonly boilerplate: (item: T, decision: Decision) => string;
  /** Called when the reviewer resolves an item. Resolves true when the
   *  mutation landed (clears the decision/response), false to keep the
   *  reviewer's draft so they can retry. */
  readonly onResolve: (item: T, decision: Decision, response: string) => Promise<boolean>;
  /** Short label for the selected item, shown in the Detail tile title. */
  readonly detailTitle: (item: T) => string;
  /** Singular noun for this item type ("proposal" / "change request"), used in
   *  tooltips. */
  readonly noun: string;
  /** The ODB mutation invoked on resolve, named in the Resolve tooltip. */
  readonly resolveMutation: string;
}

export type Decision = 'ACCEPT' | 'REJECT';

/**
 * Shared review surface for proposal-style decisions (sc-9092): a faceted
 * master list, a detail panel with an observations table (target, coordinates,
 * time, configuration, conditions), and an accept/reject response box
 * pre-filled with boilerplate. The page owns filtering and supplies facet
 * controls via `controls`.
 */
export function ReviewView<T extends ReviewItem>(props: ReviewViewProps<T>): JSX.Element {
  const {
    title,
    blurb,
    badge,
    controls,
    resolving = false,
    items,
    columns,
    renderDetail,
    renderExtra,
    boilerplate,
    onResolve,
    detailTitle,
    noun,
    resolveMutation,
  } = props;

  const nounTitle = `${noun[0]!.toUpperCase()}${noun.slice(1)}`;
  const visible = items;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = visible.find((i) => i.id === selectedId) ?? visible[0] ?? null;

  const [decision, setDecision] = useState<Decision | null>(null);
  const [response, setResponse] = useState('');

  /** Select an item, clearing any in-progress decision/response from the
   *  previously selected one (they belong to that item, not the new one). */
  function select(id: string | null): void {
    setSelectedId(id);
    setDecision(null);
    setResponse('');
  }

  /** Pick accept/reject and seed the response box with boilerplate. */
  function choose(item: T, next: Decision): void {
    setDecision(next);
    setResponse(boilerplate(item, next));
  }

  function resolve(item: T): void {
    if (!decision) return;
    void onResolve(item, decision, response).then((ok) => {
      if (ok) {
        setDecision(null);
        setResponse('');
      }
    });
  }

  const listControls = (
    <>
      {controls}
      {badge}
    </>
  );

  return (
    <>
      <Tile title={title} controls={listControls} flush>
        <p className="review-blurb">{blurb}</p>
        <DataTable
          value={visible as T[]}
          dataKey="id"
          selectionMode="single"
          selection={selected ?? undefined}
          onSelectionChange={(e) => select((e.value as T | null)?.id ?? null)}
          emptyMessage={`No ${noun}s match the filters.`}
          className="review-table"
        >
          {columns.map((col) => (
            <Column
              key={col.header}
              header={col.header}
              headerTooltip={col.headerTooltip ?? `Click a row to review and respond to that ${noun}.`}
              body={(row: T) => col.value(row)}
              style={col.width ? { width: col.width } : undefined}
            />
          ))}
        </DataTable>
      </Tile>

      {selected && (
        <Tile title={detailTitle(selected)}>
          <div className="review-detail-body">{renderDetail(selected)}</div>

          <h3 className="review-obs-title" title={`The observations attached to this ${noun}.`}>
            Observations
          </h3>
          <DataTable value={selected.observations as ObservationRow[]} dataKey="id" className="pl-striped-table">
            <Column field="target" header="Target" headerTooltip="The science target for this observation." />
            <Column
              field="ra"
              header="RA"
              headerTooltip="Right ascension of the science target (hh:mm:ss); — for non-sidereal targets."
              style={{ width: '8rem' }}
            />
            <Column
              field="dec"
              header="Dec"
              headerTooltip="Declination of the science target (±dd:mm:ss); — for non-sidereal targets."
              style={{ width: '8rem' }}
            />
            <Column
              field="hours"
              header="Time"
              headerTooltip="Time requested for this observation."
              body={(o: ObservationRow) => `${o.hours} h`}
              style={{ width: '5rem' }}
            />
            <Column
              field="config"
              header="Config"
              headerTooltip="The instrument and observing mode requested (Observation.observingMode)."
              style={{ width: '11rem' }}
            />
            <Column
              field="conditions"
              header="Conditions"
              headerTooltip="Requested observing conditions (Observation.constraintSet): image quality bound, cloud cover / sky background / water vapor percentiles."
              style={{ width: '13rem' }}
            />
          </DataTable>

          <ConflictsTable
            title={`Potential Conflicts of this ${nounTitle}’s Observations`}
            sources={selected.observations.map((o) => ({ ...o, programId: selected.id }))}
          />

          <DuplicatesTable
            title={`Potential Duplicate Observations of this ${nounTitle}`}
            sources={selected.observations}
          />

          {renderExtra?.(selected, decision)}

          {!selected.resolved && (
            <div className="review-respond">
              <div className="review-decision">
                <Button
                  label="Accept"
                  icon="pi pi-check"
                  severity="success"
                  outlined={decision !== 'ACCEPT'}
                  tooltip={`Mark this ${noun} for acceptance and seed an approval response to the PI below.`}
                  tooltipOptions={{ position: 'top' }}
                  onClick={() => choose(selected, 'ACCEPT')}
                />
                <Button
                  label="Reject"
                  icon="pi pi-times"
                  severity="danger"
                  outlined={decision !== 'REJECT'}
                  tooltip={`Mark this ${noun} for rejection and seed a decline response to the PI below.`}
                  tooltipOptions={{ position: 'top' }}
                  onClick={() => choose(selected, 'REJECT')}
                />
              </div>

              <InputTextarea
                className={cn('review-response', !decision && 'is-disabled')}
                rows={5}
                placeholder="Choose accept or reject to seed a response to the PI…"
                value={response}
                disabled={!decision}
                title="The message sent to the PI. Pre-filled with boilerplate from your accept/reject choice; edit freely before resolving."
                onChange={(e) => setResponse(e.target.value)}
              />

              <div className="review-resolve">
                {/* title-span so the hint shows even before a decision enables it. */}
                <span
                  title={
                    decision
                      ? `Record the decision and notify the PI (${resolveMutation}).`
                      : 'Choose Accept or Reject first to enable resolving.'
                  }
                >
                  <Button
                    label="Resolve"
                    icon="pi pi-send"
                    disabled={!decision || resolving}
                    loading={resolving}
                    onClick={() => resolve(selected)}
                  />
                </span>
              </div>
            </div>
          )}

          {selected.resolved && (
            <p className="review-resolved-note">
              <i className="pi pi-check-circle" /> This {noun} has been resolved.
            </p>
          )}
        </Tile>
      )}
    </>
  );
}
