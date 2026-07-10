import { createBrowserRouter, type RouteObject } from 'react-router';

import Layout from '@/components/layout/Layout';
import { Tile } from '@/components/Tile';

// Views register here and in Layout's NAV_ITEMS, one story at a time. Each is
// its own lazy chunk — switching tabs loads only what that view needs.
const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <Tile title="GPP Admin" collapsible={false}>
            <p>Select a view from the rail. Views arrive one story at a time as they land.</p>
          </Tile>
        ),
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
