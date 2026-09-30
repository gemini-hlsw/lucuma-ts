import type { JSX } from 'react';
import { Outlet } from 'react-router';

import BottomNav from './BottomNav';
import { EnvBanner } from './EnvBanner';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function Layout(): JSX.Element {
  return (
    <div className="xp-shell grid grid-rows-[auto_1fr_auto] overflow-hidden print:block print:overflow-visible">
      {/* A real block, not `contents`, so the row heights to both and the body geometry never moves. */}
      <div className="print:hidden">
        <EnvBanner />
        <Navbar />
      </div>
      <div className="row-start-2 grid min-h-0 grid-cols-[196px_1fr] overflow-hidden max-md:grid-cols-1 print:row-start-auto print:block print:overflow-visible">
        <div className="contents print:hidden">
          <Sidebar />
        </div>
        <main className="min-w-0 overflow-y-auto p-4 print:overflow-visible">
          <Outlet />
        </main>
      </div>
      {/* The third row is the phone's; at `md` and up the bar is `display: none` and the row measures 0. */}
      <BottomNav />
    </div>
  );
}
