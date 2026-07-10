import './ProgramsPage.css';

import { AutoComplete } from 'primereact/autocomplete';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { type JSX, useEffect, useMemo, useState } from 'react';

import { fetchAllUsers, type RosterUser } from '@/auth/ssoGraphql';
import { useOdbTokenValue } from '@/components/atoms/auth';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { Tile } from '@/components/Tile';
import { TimeAwardsGrid } from '@/components/TimeAwardsGrid';
import { useToast } from '@/components/toastContext';
import { friendlyError } from '@/gql/errors';
import {
  allocationsInput,
  mapPrograms,
  programPropertiesInput,
  proposalTypeInput,
  useAddProgramUser,
  useCreateProgramNote,
  useDeleteProgramUser,
  useLinkUser,
  usePrograms,
  useSetAllocations,
  useUpdateProgram,
  useUpdateProgramNote,
  useUpdateProposalType,
} from '@/gql/programs';
import {
  type ContactScientist,
  type Program,
  PROGRAM_CLASS_LABEL,
  PROGRAM_CLASSES,
  type ProgramClass,
  TOO_LABEL,
  TOO_STATUSES,
  type TooStatus,
} from '@/gql/types';

/** "Show everything" sentinel for the Class facet (PrimeReact mishandles null
 *  option values). */
const ALL = 'ALL';

const EMPTY_PROGRAMS: Program[] = [];

/**
 * Programs view (sc-9090). Layout follows Andy's updated mockup: a filterable
 * programs table on top (ACCEPTED programs only — the WHERE clause in
 * PROGRAMS_QUERY), then a Selected Program editor — parameter form on the
 * left, Private Program Note on the right, Time Awards grid beneath. Saving is
 * real: updatePrograms, updateProposal, setAllocations, note create/update,
 * and contact-scientist link/unlink, then a reload from the ODB.
 */
export default function ProgramsPage(): JSX.Element {
  const toast = useToast();
  const { data, loading, error, refetch } = usePrograms();
  const programs = useMemo(() => (data ? mapPrograms(data) : EMPTY_PROGRAMS), [data]);

  const [updateProgram, { loading: updatingProgram }] = useUpdateProgram();
  const [updateProposalType, { loading: updatingProposalType }] = useUpdateProposalType();
  const [setAllocations, { loading: settingAllocations }] = useSetAllocations();
  const [createNote, { loading: creatingNote }] = useCreateProgramNote();
  const [updateNote, { loading: updatingNote }] = useUpdateProgramNote();
  const [addProgramUser, { loading: addingUser }] = useAddProgramUser();
  const [linkUser, { loading: linkingUser }] = useLinkUser();
  const [deleteProgramUser, { loading: deletingUser }] = useDeleteProgramUser();
  const saving =
    updatingProgram ||
    updatingProposalType ||
    settingAllocations ||
    creatingNote ||
    updatingNote ||
    addingUser ||
    linkingUser ||
    deletingUser;

  /** Persist every edited aspect of the program through its own mutation.
   *  Order matters only in that program properties validate first; each
   *  remaining step is independent. Throws on the first failure so the user
   *  sees exactly what broke (the ODB is transactional per mutation). */
  async function saveProgram(original: Program, draft: Program): Promise<void> {
    await updateProgram({ variables: { programId: draft.id, SET: programPropertiesInput(draft) } });

    await updateProposalType({ variables: { programId: draft.id, gemini: proposalTypeInput(draft) } });

    if (JSON.stringify(draft.allocations) !== JSON.stringify(original.allocations)) {
      await setAllocations({ variables: { programId: draft.id, allocations: allocationsInput(draft.allocations) } });
    }

    if (draft.privateNote !== original.privateNote && draft.privateNote.trim() !== '') {
      if (draft.privateNoteId) {
        await updateNote({ variables: { noteId: draft.privateNoteId, text: draft.privateNote } });
      } else {
        await createNote({ variables: { programId: draft.id, text: draft.privateNote } });
      }
    }

    // Contact scientists: link roster picks that are new, unlink removals.
    const draftIds = new Set(draft.contactScientists.map((c) => c.programUserId).filter(Boolean));
    for (const removed of original.contactScientists.filter((c) => !draftIds.has(c.programUserId))) {
      await deleteProgramUser({ variables: { programUserId: removed.programUserId ?? '' } });
    }
    for (const added of draft.contactScientists.filter((c) => !c.programUserId && c.userId)) {
      const res = await addProgramUser({ variables: { programId: draft.id } });
      const programUserId = res.data?.addProgramUser.programUser.id;
      if (programUserId) await linkUser({ variables: { programUserId, userId: added.userId ?? '' } });
    }
  }

  const [classFilter, setClassFilter] = useState<ProgramClass | typeof ALL>(ALL);
  const [search, setSearch] = useState('');
  const filteredPrograms = useMemo(() => {
    const text = search.trim().toLowerCase();
    return programs.filter(
      (p) =>
        (classFilter === ALL || p.programClass === classFilter) &&
        (text === '' || [p.reference, p.name, p.pi].some((f) => f.toLowerCase().includes(text))),
    );
  }, [programs, classFilter, search]);

  const [programId, setProgramId] = useState<string | null>(null);
  const original = useMemo(
    () => filteredPrograms.find((p) => p.id === programId) ?? filteredPrograms[0],
    [filteredPrograms, programId],
  );

  const tileControls = (
    <>
      <DataSourceBadge loading={loading} error={error && friendlyError(error)} empty={programs.length === 0} />
      <Dropdown
        value={classFilter}
        options={[
          { label: 'All classes', value: ALL },
          ...PROGRAM_CLASSES.map((c) => ({ label: PROGRAM_CLASS_LABEL[c], value: c })),
        ]}
        onChange={(e) => setClassFilter(e.value as ProgramClass | typeof ALL)}
        title="Facet the table to Queue or Classical programs only."
      />
      <IconField iconPosition="left">
        <InputIcon className="pi pi-search" />
        <InputText
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter reference, PI, or title"
          title="Type to filter the table by program reference, PI, or title."
        />
      </IconField>
    </>
  );

  return (
    <>
      <Tile title="Programs" controls={tileControls} flush>
        <p className="programs-blurb">
          Accepted programs only. Select a program below to edit its administrative parameters.
        </p>
        <DataTable
          value={filteredPrograms}
          dataKey="id"
          selectionMode="single"
          selection={original ?? undefined}
          onSelectionChange={(e) => setProgramId((e.value as Program | null)?.id ?? null)}
          scrollable
          scrollHeight="19rem"
          className="programs-table"
          emptyMessage={
            loading
              ? 'Loading programs…'
              : error
                ? friendlyError(error)
                : programs.length > 0
                  ? 'No programs match the filters.'
                  : 'No accepted programs are visible to your role.'
          }
        >
          <Column
            field="reference"
            header="Program"
            sortable
            style={{ width: '13rem' }}
            headerTooltip="The program's reference label. Click a row to edit it below."
          />
          <Column
            field="programClass"
            header="Class"
            sortable
            style={{ width: '8rem' }}
            body={(p: Program) => PROGRAM_CLASS_LABEL[p.programClass]}
            headerTooltip="Queue or Classical, from the proposal type."
          />
          <Column field="pi" header="PI" sortable style={{ width: '13rem' }} />
          <Column
            field="tooStatus"
            header="ToO"
            sortable
            style={{ width: '7rem' }}
            body={(p: Program) => TOO_LABEL[p.tooStatus]}
            headerTooltip="Target-of-Opportunity activation."
          />
          <Column field="name" header="Title" sortable />
        </DataTable>
      </Tile>

      {original && (
        <ProgramEditor
          key={original.id}
          original={original}
          saving={saving}
          onSave={async (draft) => {
            try {
              await saveProgram(original, draft);
              toast.success('Program saved', draft.reference);
              void refetch();
            } catch (err) {
              toast.error('Save failed', friendlyError(err));
            }
          }}
        />
      )}
    </>
  );
}

/** The Selected Program editor. Keyed by program id from the parent, so
 *  switching programs remounts it with a fresh draft — no reset-during-render
 *  bookkeeping needed. */
function ProgramEditor({
  original,
  saving,
  onSave,
}: {
  readonly original: Program;
  readonly saving: boolean;
  readonly onSave: (draft: Program) => Promise<void>;
}): JSX.Element {
  const [draft, setDraft] = useState<Program>(original);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);

  function set<K extends keyof Program>(key: K, value: Program[K]): void {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  // Roster for the contact-scientist type-ahead, loaded once from SSO. A
  // failure here just leaves suggestions empty — the field still works for
  // removals.
  const token = useOdbTokenValue();
  const [roster, setRoster] = useState<RosterUser[]>([]);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchAllUsers().then((result) => {
      if (!cancelled && typeof result !== 'string') setRoster(result);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const [contactSuggestions, setContactSuggestions] = useState<ContactScientist[]>([]);
  function suggestContacts(query: string): void {
    const text = query.trim().toLowerCase();
    const chosen = new Set(draft.contactScientists.map((c) => c.userId));
    setContactSuggestions(
      roster
        .filter((u) => !chosen.has(u.id))
        .filter((u) => [`${u.givenName} ${u.familyName}`, u.email].some((f) => f.toLowerCase().includes(text)))
        .slice(0, 8)
        .map((u) => ({ name: `${u.givenName} ${u.familyName}`, userId: u.id })),
    );
  }

  return (
    <Tile title={`Selected Program · ${draft.reference}`}>
      <h2 className="program-title" title="The program's title — display only, not editable here.">
        {draft.name || '(untitled program)'}
      </h2>
      <div className="program-grid">
        <div className="program-left">
          <div className="program-form">
            <label title="The principal investigator — display only.">PI</label>
            <span className="program-readonly">{draft.pi}</span>

            <label
              htmlFor="class"
              title="Observing mode: Queue (scheduled into the nightly queue) or Classical (assigned nights). Maps to the proposal type."
            >
              Class
            </label>
            <Dropdown
              inputId="class"
              value={draft.programClass}
              options={PROGRAM_CLASSES.map((c) => ({ label: PROGRAM_CLASS_LABEL[c], value: c }))}
              onChange={(e) => set('programClass', e.value as ProgramClass)}
            />

            <label
              htmlFor="too"
              title="Target-of-Opportunity status — whether this program may interrupt the queue for transient events (None / Standard / Rapid). Queue programs only."
            >
              ToO Status
            </label>
            <Dropdown
              inputId="too"
              value={draft.tooStatus}
              options={TOO_STATUSES.map((t) => ({ label: TOO_LABEL[t], value: t }))}
              onChange={(e) => set('tooStatus', e.value as TooStatus)}
              disabled={draft.programClass !== 'QUEUE'}
            />

            <label
              htmlFor="contacts"
              title="Gemini staff assigned as contact scientists (SUPPORT ProgramUser roles). Type a name or email for suggestions from the SSO roster; click ✕ on a chip to remove."
            >
              Contact Scientists
            </label>
            <AutoComplete
              inputId="contacts"
              multiple
              value={[...draft.contactScientists]}
              suggestions={contactSuggestions}
              completeMethod={(e) => suggestContacts(e.query)}
              field="name"
              onChange={(e) => set('contactScientists', e.value ?? [])}
              placeholder={draft.contactScientists.length === 0 ? 'Add a contact…' : undefined}
            />

            <label title="When the program is active. Every program has a start and end date — edit them directly.">
              Active Period
            </label>
            <div className="active-period">
              <InputText
                value={draft.activeStart}
                placeholder="YYYY-MM-DD"
                onChange={(e) => set('activeStart', e.target.value)}
                className="ap-date-input"
              />
              <span className="ap-dash">–</span>
              <InputText
                value={draft.activeEnd}
                placeholder="YYYY-MM-DD"
                onChange={(e) => set('activeEnd', e.target.value)}
                className="ap-date-input"
              />
            </div>

            <label
              htmlFor="prop"
              title="How many months the data stay proprietary (private to the PI) before becoming public in the archive. Stored on the program's GOA properties (proprietaryMonths)."
            >
              Proprietary Period
            </label>
            <div className="suffixed">
              <InputNumber
                inputId="prop"
                value={draft.proprietaryMonths}
                min={0}
                max={36}
                onValueChange={(e) => set('proprietaryMonths', e.value ?? 0)}
              />
              <span className="suffix">months</span>
            </div>

            <label
              htmlFor="band3"
              title="Whether this program should be considered for Band-3 scheduling if higher bands run out of time (ODB ConsiderForBand3). Queue programs only."
            >
              Consider for Band 3
            </label>
            <Checkbox
              inputId="band3"
              checked={draft.considerForBand3}
              onChange={(e) => set('considerForBand3', Boolean(e.checked))}
              disabled={draft.programClass !== 'QUEUE'}
            />

            <label
              htmlFor="minpct"
              title="Minimum percentage of the awarded time that must be observed for the program to count as successful (proposal minPercentTime)."
            >
              Minimum Time
            </label>
            <div className="suffixed">
              <InputNumber
                inputId="minpct"
                value={draft.minPercentTime}
                min={0}
                max={100}
                onValueChange={(e) => set('minPercentTime', e.value ?? 0)}
              />
              <span className="suffix">%</span>
            </div>

            <label title="Resource usage isn't tracked by the ODB yet — Andy's updated sc-9090 mockup adds 'Resources Used' (display) and 'Resource Limit' (editable); shown here as the schema gap it is rather than faked.">
              Resources
            </label>
            <span className="program-gap">not yet tracked by the ODB</span>

            <label
              htmlFor="header"
              title="When checked, FITS headers are kept private during the proprietary period (GOA privateHeader)."
            >
              Private Headers
            </label>
            <Checkbox
              inputId="header"
              checked={draft.privateHeader}
              onChange={(e) => set('privateHeader', Boolean(e.checked))}
            />

            <label title="Program users (typically COIs) flagged as thesis investigators (ProgramUser.thesis) — tracked per investigator, not per program. Read-only here; edit each investigator's record to change it.">
              Thesis
            </label>
            <span className="thesis-list">
              {draft.thesisInvestigators.length > 0 ? draft.thesisInvestigators.join(', ') : 'None'}
            </span>
          </div>

          <h2
            className="awards-title"
            title="Hours awarded to each time-accounting partner, split by science band. Saved via the ODB setAllocations mutation (one allocation per partner × band)."
          >
            Time Awards
          </h2>
          <TimeAwardsGrid allocations={draft.allocations} onChange={(a) => set('allocations', a)} />
        </div>

        <div className="program-right">
          <h2
            className="note-title"
            title="A free-text internal note about this program, visible to staff only — never shown to the PI."
          >
            Private Program Note
          </h2>
          <InputTextarea
            className="private-note"
            value={draft.privateNote}
            onChange={(e) => set('privateNote', e.target.value)}
            placeholder="Internal note (not visible to the PI)…"
          />
        </div>
      </div>

      <div className="program-actions">
        {/* Wrapped in a title-span so the hint shows even while the button is
            disabled (PrimeReact suppresses tooltips on disabled controls). */}
        <span title={dirty ? 'Discard your unsaved edits and revert to the loaded values.' : 'No changes to discard.'}>
          <Button text label="Cancel" icon="pi pi-times" disabled={!dirty} onClick={() => setDraft(original)} />
        </span>
        <span
          title={
            dirty
              ? 'Save changes via updatePrograms / updateProposal / setAllocations (+ note and contact updates), then reload from the ODB.'
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
