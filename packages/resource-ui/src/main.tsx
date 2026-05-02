import './styles/global.css';
import './styles/main.css';

import { ApolloProvider } from '@apollo/client/react';
import { type ReactNode, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import App from './app/App';
import { client } from './gql/ApolloConfigs';

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
