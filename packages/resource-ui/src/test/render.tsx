import type { ReactElement } from 'react';
import { BrowserRouter } from 'react-router';
import { render } from 'vitest-browser-react';

export async function renderWithContext(ui: ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}
