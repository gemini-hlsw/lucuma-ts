import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import type { JSX } from 'react';

import { Search } from '@/components/Icons';

/**
 * The magnifying-glass filter box used above the admin tables (Programs, Users,
 * Proposals). A controlled input — the owning view holds the query and filters
 * its rows with `matchesQuery` (lib/search.ts). Pairing this with that helper
 * keeps every table's search looking and behaving identically.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  title,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Ghost text naming the searchable fields, e.g. "Filter reference, PI, or title". */
  readonly placeholder: string;
  /** Tooltip spelling out what the search matches. */
  readonly title: string;
}): JSX.Element {
  return (
    <IconField iconPosition="left">
      <InputIcon>
        <Search />
      </InputIcon>
      <InputText
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        title={title}
      />
    </IconField>
  );
}
