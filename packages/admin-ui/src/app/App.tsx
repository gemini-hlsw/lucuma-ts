import type { JSX } from 'react';
import { RouterProvider } from 'react-router';

import { AuthGate } from '@/auth/AuthGate';

import { router } from './router';

/**
 * GPP Admin (Shortcut epic 5747): the internal interface for editing program
 * administrative information — five views: Programs (sc-9090), Proposals
 * (sc-9092), Change Requests (sc-9094), Users (sc-9096), and Calls for
 * Proposals (sc-9098). The whole app sits behind the staff/admin role gate.
 */
export default function App(): JSX.Element {
  return (
    <AuthGate>
      <RouterProvider router={router} />
    </AuthGate>
  );
}
