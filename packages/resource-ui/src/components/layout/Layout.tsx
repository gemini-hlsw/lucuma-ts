import type { JSX } from 'react';
import { Outlet } from 'react-router';

import Navbar from './Navbar';
import Sidebar from './Sidebar';

/**
 * Renders the main application layout for the Resource UI.
 */
export default function Layout(): JSX.Element {
  return (
    <div className="grid h-screen grid-rows-[2.5rem_1fr] overflow-hidden">
      <Navbar />
      <div className="grid min-h-0 grid-cols-[14rem_1fr] overflow-hidden">
        <Sidebar />
        <main className="min-w-0 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
