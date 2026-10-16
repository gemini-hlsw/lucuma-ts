import { afterEach } from 'vitest';

import { assertNoUnansweredQueries, recordUnansweredQueries } from './unansweredQueries';

recordUnansweredQueries();

afterEach(assertNoUnansweredQueries);
