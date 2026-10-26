import 'vitest-browser-react';

import { loadDevMessages, loadErrorMessages } from '@apollo/client/dev';

import { failOnUnansweredQueries } from '../testing/unansweredQueries.ts';

// Applies to the tests of every package.
// Show the full Apollo messages instead of go.apollo.dev links.
loadDevMessages();
loadErrorMessages();
failOnUnansweredQueries();
