import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import Layout from '../components/layout/Layout';
import ComponentsPage from './pages/ComponentsPage';
import InstrumentsPage from './pages/InstrumentsPage';
import NightPage from './pages/NightPage';
import SemesterPage from './pages/SemesterPage';
import WeekPage from './pages/WeekPage';

/**
 * The application's routing structure.
 *
 * Tonight is the front door: landing on the app answers "what is on the
 * telescope right now" (no `night` in the URL means the night in progress).
 * The semester remains the readable reproduction of what Gemini publishes,
 * one click away in the sidebar.
 */
const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/night" replace /> },
      { path: 'semester', element: <SemesterPage /> },
      { path: 'week', element: <WeekPage /> },
      { path: 'night', element: <NightPage /> },
      { path: 'instruments', element: <InstrumentsPage /> },
      { path: 'components', element: <ComponentsPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
