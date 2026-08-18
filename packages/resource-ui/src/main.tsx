import './styles/global.css';
import './styles/main.css';
import './styles/chartOverlays.css';

import { ApolloProvider } from '@apollo/client/react';
import { type ReactNode, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import App from './app/App';
import { client } from './gql/ApolloConfigs';

// Resource is a dark-only operational tool. The lucuma-ui PrimeReact theme is scoped
// under `.dark`; applying it to the document root styles every PrimeReact control -
// including dialogs, which portal to <body> - while the custom Tailwind heat-map keeps
// its own Resource identity.
document.documentElement.classList.add('dark');

const rootElement: HTMLElement | null = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root: Root = createRoot(rootElement);

const app: ReactNode = (
  <StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </StrictMode>
);

root.render(app);
