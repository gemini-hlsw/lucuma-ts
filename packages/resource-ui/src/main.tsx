import './styles/global.css';

import { type ReactNode, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import App from './app/App';

const rootElement: HTMLElement | null = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root: Root = createRoot(rootElement);

const app: ReactNode = (
  <StrictMode>
    <App />
  </StrictMode>
);

root.render(app);
