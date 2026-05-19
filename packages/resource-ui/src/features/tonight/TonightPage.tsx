import type { JSX } from 'react';

import { useTelescopeNightTimeline } from '../../gql/telescope';

export default function TonightPage(): JSX.Element {
  // Date and site taken from the mock data in the GraphQL service.
  const { data, loading, error } = useTelescopeNightTimeline('GN', '2026-08-01');

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <p>Error: {error.message}</p>;
  }

  const timeline = data?.telescopeNightTimeline;

  if (!timeline) {
    return <p>No data found.</p>;
  }

  return (
    <main>
      <pre>{JSON.stringify(timeline, null, 2)}</pre>
    </main>
  );
}
