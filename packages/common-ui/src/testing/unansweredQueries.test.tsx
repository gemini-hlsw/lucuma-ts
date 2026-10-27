import { gql, type TypedDocumentNode } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { AtomsAndApollo } from './providers.tsx';
import { takeUnansweredQueries } from './unansweredQueries.ts';

const GREETING: TypedDocumentNode<{ greeting: string }, Record<string, never>> = gql`
  query Greeting {
    greeting
  }
`;

function Greeting() {
  const { data } = useQuery(GREETING);
  return <p>{data?.greeting ?? 'Loading'}</p>;
}

describe(takeUnansweredQueries, () => {
  it('reports a query that no mocked response answers', async () => {
    await render(
      <AtomsAndApollo mocks={[]}>
        <Greeting />
      </AtomsAndApollo>,
    );

    await expect.poll(takeUnansweredQueries).toEqual([expect.stringContaining('query Greeting')]);
  });

  it('reports nothing when every query is answered', async () => {
    const sut = await render(
      <AtomsAndApollo mocks={[{ request: { query: GREETING }, result: { data: { greeting: 'Hello' } } }]}>
        <Greeting />
      </AtomsAndApollo>,
    );

    await expect.element(sut.getByText('Hello')).toBeVisible();
    expect(takeUnansweredQueries()).toEqual([]);
  });
});
