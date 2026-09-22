import './styles/global.css';
import './styles/main.css';

import { ApolloProvider } from '@apollo/client/react';
import { Provider as JotaiProvider } from 'jotai';
import { PrimeReactProvider } from 'primereact/api';
import { type ReactNode, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import App from './app/App';
import { AuthSession } from './auth/AuthSession';
import { store } from './components/atoms/store';
import { client } from './gql/ApolloConfigs';

// The lucuma-ui PrimeReact theme is scoped under `.dark`, and dialogs portal to <body>.
document.documentElement.classList.add('dark');

const rootElement: HTMLElement | null = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root: Root = createRoot(rootElement);

const app: ReactNode = (
  <StrictMode>
    <PrimeReactProvider>
      <JotaiProvider store={store}>
        <ApolloProvider client={client}>
          <AuthSession>
            <App />
          </AuthSession>
        </ApolloProvider>
      </JotaiProvider>
    </PrimeReactProvider>
  </StrictMode>
);

root.render(app);
