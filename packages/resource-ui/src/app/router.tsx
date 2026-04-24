import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import Layout from '../components/layout/Layout';
import TelescopeSchedulePage from '../features/telescope-schedule/TelescopeSchedulePage';

/**
 * Defines the application's routing structure.
 */
const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        // For now, redirect the root path to the telescope schedule page.
        index: true,
        element: <Navigate to="/telescope-schedule" replace />,
      },
      {
        path: 'telescope-schedule',
        element: <TelescopeSchedulePage />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
