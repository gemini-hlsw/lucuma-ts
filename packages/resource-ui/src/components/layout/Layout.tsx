import type { JSX } from 'react';
import { Outlet } from 'react-router';

import { LiveFailureBanner } from './LiveFailureBanner';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

/** `row-start-2` is load bearing: auto-placement sizes the body to content and leaves 1fr empty. */
export default function Layout(): JSX.Element {
  return (
    <div className="grid h-screen grid-rows-[auto_1fr] overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* A real block, not `contents`, so the row heights to both and the body geometry never moves. */}
      <div className="print:hidden">
        <Navbar />
        <LiveFailureBanner />
      </div>
      <div className="row-start-2 grid min-h-0 grid-cols-[14rem_1fr] overflow-hidden max-md:grid-cols-1 max-md:grid-rows-[auto_1fr] print:row-start-auto print:block print:overflow-visible">
        <div className="contents print:hidden">
          <Sidebar />
        </div>
        <main className="min-w-0 overflow-y-auto p-4 print:overflow-visible">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
