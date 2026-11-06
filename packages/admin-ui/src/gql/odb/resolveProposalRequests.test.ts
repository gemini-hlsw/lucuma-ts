import { print } from 'graphql';
import { describe, expect, it } from 'vitest';

import { RESOLVE_PROPOSAL_REQUESTS_MUTATION } from './changeRequests';

describe('RESOLVE_PROPOSAL_REQUESTS_MUTATION', () => {
  it('only decides requests that are still pending, so a withdrawn or decided one keeps its outcome — sc-9595', () => {
    // The server applies the filter, so the document is the only place a test can see it.
    const text = print(RESOLVE_PROPOSAL_REQUESTS_MUTATION).replace(/\s+/g, '');
    expect(text).toContain('WHERE:{id:{IN:$approved},status:{EQ:REQUESTED}}');
    expect(text).toContain('WHERE:{id:{IN:$denied},status:{EQ:REQUESTED}}');
  });

  it('leaves any stored response alone: feedback is not in SET', () => {
    // A SET that named `feedback` would write or clear the note an earlier review left.
    const text = print(RESOLVE_PROPOSAL_REQUESTS_MUTATION).replace(/\s+/g, '');
    expect(text).toContain('SET:{status:APPROVED}');
    expect(text).toContain('SET:{status:DENIED}');
  });
});
