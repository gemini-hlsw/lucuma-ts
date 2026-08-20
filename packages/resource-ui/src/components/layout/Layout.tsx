import type { JSX } from 'react';
import { Outlet } from 'react-router';

import { LiveFailureBanner } from './LiveFailureBanner';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

/**
 * The application shell.
 *
 * The masthead is fixed-height, so changing route never moves the sidebar or
 * the page content vertically.
 *
 * The body row is placed explicitly with `row-start-2`, and that is load
 * bearing. Left to auto-placement the body lands in an `auto` track, sizes
 * itself to its content, and leaves the `1fr` track empty - which stops the
 * sidebar rail partway down the window with dead space beneath it instead of
 * running the full height of the page.
 */
export default function Layout(): JSX.Element {
  return (
    // print: the chrome disappears and the content flows across pages instead of scrolling.
    <div className="grid h-screen grid-rows-[auto_1fr] overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* One header row holding the masthead and, when the live source fails,
          the banner beneath it - a real block, not `contents`, so the row
          heights to both and the body geometry below never needs to change. */}
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
