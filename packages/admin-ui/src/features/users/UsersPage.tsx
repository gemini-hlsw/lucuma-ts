import './UsersPage.css';

import { Checkbox } from 'primereact/checkbox';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { type JSX, useEffect, useMemo, useState } from 'react';

import {
  addRole,
  deleteRole,
  fetchAllUsers,
  type Partner,
  PARTNER_NAME,
  PARTNERS,
  type RoleType,
  type RosterUser,
} from '@/auth/ssoGraphql';
import { useOdbTokenValue } from '@/components/atoms/auth';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { Tile } from '@/components/Tile';
import { useToast } from '@/components/toastContext';

/** Does the user currently hold this role? NGO roles must match the partner. */
function hasRole(user: RosterUser, type: RoleType, partner?: Partner): boolean {
  return user.roles.some((r) => r.type === type && r.partner === partner);
}

/** A role column's identity, used for the header facet ("show only holders"). */
interface RoleKey {
  readonly type: RoleType;
  readonly partner?: Partner;
}

const sameRole = (a: RoleKey | null, b: RoleKey): boolean => a !== null && a.type === b.type && a.partner === b.partner;

/**
 * Users view (sc-9096): assign and revoke staff & NGO roles. One row per
 * user, one checkbox column per partner NGO plus Staff and Admin — the layout
 * in the design doc. The roster comes from SSO's `users` query, checking a
 * box calls `addRole`, and unchecking calls `deleteRole` (sc-8978 — revokes
 * the role and ends its sessions server-side).
 *
 * The table is a single scrolling page (no paginator) and each role column
 * header is a toggle that facets the table down to holders of that role.
 */
export default function UsersPage(): JSX.Element {
  const toast = useToast();
  const token = useOdbTokenValue();
  const [users, setUsers] = useState<RosterUser[]>([]);
  // Hand-rolled loading/error state, pending the SSO schema joining Apollo
  // codegen (sc-9059) — at which point this becomes a useQuery result.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [globalFilter, setGlobalFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleKey | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    void fetchAllUsers().then((result) => {
      if (cancelled) return;
      if (typeof result === 'string') {
        setError(result);
      } else {
        setUsers(result);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Filtering happens here rather than via DataTable's `filters` so it composes
  // with the role facet and stays compatible with the scroller.
  const visibleUsers = useMemo(() => {
    const text = globalFilter.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && !hasRole(u, roleFilter.type, roleFilter.partner)) return false;
      if (text === '') return true;
      return [u.givenName, u.familyName, u.email, u.orcidId].some((f) => f.toLowerCase().includes(text));
    });
  }, [users, globalFilter, roleFilter]);

  /** Grant a role via `addRole`, recording the returned RoleId so the same
   *  checkbox can immediately revoke it again without a refetch. */
  async function grantRole(userId: string, type: RoleType, partner?: Partner): Promise<void> {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const label = `${type}${partner ? `, ${partner}` : ''}`;
    const result = await addRole(userId, type, partner);
    if ('error' in result) {
      toast.error('Grant failed', result.error);
      return;
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, roles: [...u.roles, { id: result.roleId, type, ...(partner ? { partner } : {}) }] }
          : u,
      ),
    );
    toast.success('Role granted', `${target.givenName} ${target.familyName} — ${label}`);
  }

  /** Revoke a role via `deleteRole` (sc-8978). SSO also deletes the role's
   *  sessions, so a signed-in holder loses it on their next token renewal. */
  async function revokeRole(userId: string, roleId: string, label: string): Promise<void> {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const failure = await deleteRole(roleId);
    if (failure) {
      toast.error('Revoke failed', failure);
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, roles: u.roles.filter((r) => r.id !== roleId) } : u)),
    );
    toast.success('Role revoked', `${target.givenName} ${target.familyName} — ${label}`);
  }

  function roleColumnBody(type: RoleType, partner?: Partner) {
    const label = partner ? `${type} for ${partner}` : type;
    // A PrimeReact column body render function (called per row), not a component.
    return function roleCell(user: RosterUser): JSX.Element {
      const held = user.roles.find((r) => r.type === type && r.partner === partner);
      return (
        <span
          title={
            held
              ? `Revoke the ${label} role from ${user.givenName} ${user.familyName}. Calls the SSO deleteRole mutation (Admin only) — any sessions under this role are ended.`
              : `Grant the ${label} role to ${user.givenName} ${user.familyName}. Calls the SSO addRole mutation (Admin only).`
          }
        >
          <Checkbox
            checked={held !== undefined}
            onChange={() => void (held ? revokeRole(user.id, held.id, label) : grantRole(user.id, type, partner))}
          />
        </span>
      );
    };
  }

  /** Clickable role-column header: toggles the facet down to that role's holders. */
  function roleColumnHeader(label: string, key: RoleKey, describe: string): JSX.Element {
    const active = sameRole(roleFilter, key);
    return (
      <button
        type="button"
        className={`users-role-facet${active ? 'users-role-facet-active' : ''}`}
        title={
          active
            ? `Showing only ${describe} holders — click to show everyone again.`
            : `${describe}. Click to show only users who hold it.`
        }
        onClick={() => setRoleFilter(active ? null : key)}
      >
        {label}
      </button>
    );
  }

  const controls = (
    <>
      <DataSourceBadge loading={loading} error={error} empty={users.length === 0} />
      <span className="users-count" title="Users shown / users loaded from SSO.">
        {visibleUsers.length}/{users.length}
      </span>
      <IconField iconPosition="left">
        <InputIcon className="pi pi-search" />
        <InputText
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Filter name, email, or ORCiD"
          title="Type to filter the table by name, email, or ORCiD (matches any of them)."
        />
      </IconField>
    </>
  );

  return (
    <Tile title="Users — Role Assignment" controls={controls} flush>
      <DataTable
        value={visibleUsers}
        dataKey="id"
        scrollable
        scrollHeight="calc(100vh - 240px)"
        emptyMessage={
          loading ? 'Loading users…' : (error ?? (users.length > 0 ? 'No users match the filters.' : 'No users found.'))
        }
      >
        <Column
          field="familyName"
          header="Last"
          sortable
          headerTooltip="Family name. Click to sort."
          style={{ minWidth: '9rem' }}
        />
        <Column
          field="givenName"
          header="First"
          sortable
          headerTooltip="Given name. Click to sort."
          style={{ minWidth: '9rem' }}
        />
        <Column
          field="email"
          header="Email"
          sortable
          headerTooltip="Contact email. Click to sort."
          style={{ minWidth: '16rem' }}
        />
        <Column
          field="orcidId"
          header="ORCiD"
          headerTooltip="The user's ORCID identifier (their SSO identity)."
          style={{ minWidth: '12rem' }}
        />

        {PARTNERS.map((p) => (
          <Column
            key={p}
            header={roleColumnHeader(p, { type: 'NGO', partner: p }, `NGO role for ${PARTNER_NAME[p]} (${p})`)}
            dataType="boolean"
            align="center"
            body={roleColumnBody('NGO', p)}
            style={{ width: '3.5rem' }}
          />
        ))}
        <Column
          header={roleColumnHeader('Staff', { type: 'STAFF' }, 'Gemini staff role')}
          dataType="boolean"
          align="center"
          body={roleColumnBody('STAFF')}
          style={{ width: '4rem' }}
        />
        <Column
          header={roleColumnHeader('Adm', { type: 'ADMIN' }, 'Admin role')}
          dataType="boolean"
          align="center"
          body={roleColumnBody('ADMIN')}
          style={{ width: '4rem' }}
        />
      </DataTable>
    </Tile>
  );
}
