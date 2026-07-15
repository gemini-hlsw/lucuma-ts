/*
 * Programs view (sc-9090): codegen-typed query/mutations + the mapper onto
 * the editable Program shape. See Program's doc comments in types.ts for
 * where each field lives in the schema.
 */
import { useMutation, useQuery } from '@apollo/client/react';

import type { DocumentType } from './odb/gen';
import { graphql } from './odb/gen';
import type {
  AllocationInput,
  GeminiProposalTypeInput,
  ProgramItemFragment,
  ProgramPropertiesInput,
} from './odb/gen/graphql';
import type { Allocation, Program } from './types';

export const PROGRAM_ITEM_FRAGMENT = graphql(`
  fragment ProgramItem on Program {
    id
    name
    reference {
      label
    }
    proposalStatus
    pi {
      id
      user {
        id
        profile {
          givenName
          familyName
        }
      }
    }
    active {
      start
      end
    }
    allocations {
      category
      scienceBand
      duration {
        hours
      }
    }
    goa {
      proprietaryMonths
      privateHeader
    }
    proposal {
      gemini {
        __typename
        ... on Queue {
          toOActivation
          considerForBand3
          minPercentTime
        }
        ... on Classical {
          minPercentTime
        }
      }
    }
    notes {
      id
      text
      isPrivate
    }
    users {
      id
      role
      thesis
      user {
        id
        profile {
          givenName
          familyName
        }
      }
    }
  }
`);

export const PROGRAMS_QUERY = graphql(`
  query AdminPrograms {
    programs(WHERE: { proposalStatus: { EQ: ACCEPTED } }, LIMIT: 200) {
      matches {
        ...ProgramItem
      }
    }
  }
`);

/** The accepted-programs list — cached rows render immediately, refreshed in
 *  background. Saving is multi-step, so pages refetch() once at the end
 *  rather than per mutation. */
export function usePrograms() {
  return useQuery(PROGRAMS_QUERY, { fetchPolicy: 'cache-and-network' });
}

const CONTACT_SCIENTIST_ROLES = new Set(['SUPPORT_PRIMARY', 'SUPPORT_SECONDARY']);

/** The updatePrograms SET for a draft's directly-editable program properties. */
export function programPropertiesInput(draft: Program): ProgramPropertiesInput {
  return {
    goa: { proprietaryMonths: draft.proprietaryMonths, privateHeader: draft.privateHeader },
    ...(draft.activeStart ? { activeStart: draft.activeStart } : {}),
    ...(draft.activeEnd ? { activeEnd: draft.activeEnd } : {}),
  };
}

export const UPDATE_PROGRAM_MUTATION = graphql(`
  mutation AdminUpdateProgram($programId: ProgramId!, $SET: ProgramPropertiesInput!) {
    updatePrograms(input: { WHERE: { id: { EQ: $programId } }, SET: $SET }) {
      programs {
        id
      }
    }
  }
`);

export function useUpdateProgram() {
  return useMutation(UPDATE_PROGRAM_MUTATION);
}

export const SET_ALLOCATIONS_MUTATION = graphql(`
  mutation AdminSetAllocations($programId: ProgramId!, $allocations: [AllocationInput!]!) {
    setAllocations(input: { programId: $programId, allocations: $allocations }) {
      allocations {
        category
      }
    }
  }
`);

export function useSetAllocations() {
  return useMutation(SET_ALLOCATIONS_MUTATION);
}

/** Time-awards grid rows → `[AllocationInput!]` (hours → TimeSpanInput).
 *  Zero-hour cells are editing state (they keep a partner's grid row alive),
 *  not awards — only positive allocations are sent. */
export function allocationsInput(allocations: readonly Allocation[]): AllocationInput[] {
  return allocations
    .filter((a) => a.hours > 0)
    .map((a) => ({
      category: a.category,
      scienceBand: a.scienceBand,
      duration: { hours: a.hours },
    }));
}

export const UPDATE_PROPOSAL_TYPE_MUTATION = graphql(`
  mutation AdminUpdateProposalType($programId: ProgramId!, $gemini: GeminiProposalTypeInput!) {
    updateProposal(input: { programId: $programId, SET: { gemini: $gemini } }) {
      proposal {
        category
      }
    }
  }
`);

export function useUpdateProposalType() {
  return useMutation(UPDATE_PROPOSAL_TYPE_MUTATION);
}

/** ToO / minPercentTime / band-3 edits → `GeminiProposalTypeInput` (a oneOf),
 *  keyed by the program's class. Only Queue proposals carry ToO and band-3. */
export function proposalTypeInput(p: Program): GeminiProposalTypeInput {
  return p.programClass === 'QUEUE'
    ? {
        queue: {
          toOActivation: p.tooStatus,
          minPercentTime: p.minPercentTime,
          considerForBand3: p.considerForBand3 ? 'CONSIDER' : 'DO_NOT_CONSIDER',
        },
      }
    : { classical: { minPercentTime: p.minPercentTime } };
}

export const CREATE_PROGRAM_NOTE_MUTATION = graphql(`
  mutation AdminCreatePrivateNote($programId: ProgramId!, $text: NonEmptyString!) {
    createProgramNote(input: { programId: $programId, SET: { title: "Admin note", text: $text, isPrivate: true } }) {
      programNote {
        id
      }
    }
  }
`);

export function useCreateProgramNote() {
  return useMutation(CREATE_PROGRAM_NOTE_MUTATION);
}

export const UPDATE_PROGRAM_NOTE_MUTATION = graphql(`
  mutation AdminUpdatePrivateNote($noteId: ProgramNoteId!, $text: NonEmptyString) {
    updateProgramNotes(input: { WHERE: { id: { EQ: $noteId } }, SET: { text: $text } }) {
      programNotes {
        id
      }
    }
  }
`);

export function useUpdateProgramNote() {
  return useMutation(UPDATE_PROGRAM_NOTE_MUTATION);
}

export const ADD_PROGRAM_USER_MUTATION = graphql(`
  mutation AdminAddContact($programId: ProgramId!) {
    addProgramUser(input: { programId: $programId, role: SUPPORT_PRIMARY, SET: {} }) {
      programUser {
        id
      }
    }
  }
`);

export function useAddProgramUser() {
  return useMutation(ADD_PROGRAM_USER_MUTATION);
}

export const LINK_USER_MUTATION = graphql(`
  mutation AdminLinkContact($programUserId: ProgramUserId!, $userId: UserId!) {
    linkUser(input: { programUserId: $programUserId, userId: $userId }) {
      user {
        id
      }
    }
  }
`);

export function useLinkUser() {
  return useMutation(LINK_USER_MUTATION);
}

export const DELETE_PROGRAM_USER_MUTATION = graphql(`
  mutation AdminRemoveContact($programUserId: ProgramUserId!) {
    deleteProgramUser(input: { programUserId: $programUserId }) {
      result
    }
  }
`);

export function useDeleteProgramUser() {
  return useMutation(DELETE_PROGRAM_USER_MUTATION);
}

export type AdminProgramsResult = DocumentType<typeof PROGRAMS_QUERY>;

/** Map Program rows onto the editable Program view shape. */
export function mapPrograms(raw: AdminProgramsResult): Program[] {
  return raw.programs.matches.map((p: ProgramItemFragment): Program => {
    // Hide the ODB's sentinel bounds (1901/2099) — they mean "not set yet".
    const activeStart = p.active?.start === '1901-01-01' ? '' : (p.active?.start ?? '');
    const activeEnd = p.active?.end === '2099-12-31' ? '' : (p.active?.end ?? '');

    const proposalType = p.proposal?.gemini;
    const queue = proposalType?.__typename === 'Queue' ? proposalType : null;
    const classical = proposalType?.__typename === 'Classical' ? proposalType : null;

    const contactScientists = p.users
      .filter((u) => CONTACT_SCIENTIST_ROLES.has(u.role))
      .map((u) => ({
        name: [u.user?.profile?.givenName, u.user?.profile?.familyName].filter(Boolean).join(' '),
        userId: u.user?.id,
        programUserId: u.id,
      }))
      .filter((c) => c.name.length > 0);

    const thesisInvestigators = p.users
      .filter((u) => u.thesis === true)
      .map((u) => [u.user?.profile?.givenName, u.user?.profile?.familyName].filter(Boolean).join(' '))
      .filter((name) => name.length > 0);

    const privateNote = p.notes.find((n) => n.isPrivate);
    const piProfile = p.pi?.user?.profile;
    const pi = [piProfile?.givenName, piProfile?.familyName].filter(Boolean).join(' ') || '(unknown PI)';

    return {
      id: p.id,
      reference: p.reference?.label ?? p.id,
      name: p.name ?? `${p.id} (untitled)`,
      pi,
      // Classical and other proposal types (LargeProgram, FastTurnaround, …)
      // outside Queue/Classical default to QUEUE — the Admin form only edits
      // these two classes, matching the sc-9090 mockup.
      programClass: classical ? 'CLASSICAL' : 'QUEUE',
      tooStatus: queue?.toOActivation ?? 'NONE',
      contactScientists,
      activeStart,
      activeEnd,
      proprietaryMonths: p.goa?.proprietaryMonths ?? 0,
      considerForBand3: queue?.considerForBand3 === 'CONSIDER',
      minPercentTime: queue?.minPercentTime ?? classical?.minPercentTime ?? 100,
      privateHeader: p.goa?.privateHeader ?? false,
      thesisInvestigators,
      privateNote: privateNote?.text ?? '',
      privateNoteId: privateNote?.id ?? null,
      allocations: (p.allocations ?? [])
        .filter((a) => a.scienceBand !== null)
        .map((a) => ({
          category: a.category as Program['allocations'][number]['category'],
          scienceBand: a.scienceBand,
          hours: Math.round(Number(a.duration?.hours ?? 0) * 10) / 10,
        })),
    };
  });
}
