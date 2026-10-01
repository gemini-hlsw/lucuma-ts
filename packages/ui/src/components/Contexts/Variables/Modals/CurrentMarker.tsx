import './CurrentMarker.css';

/** Label for the table row of the entry currently in use. CurrentMarker.css also draws an accent bar on that row. */
export function CurrentMarker() {
  return <span className="current-marker ml-2 text-xs font-bold text-(--primary-color)">Current</span>;
}
