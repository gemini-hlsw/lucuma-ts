import './styles/global.css';
import './styles/main.css';

import { ApolloProvider } from '@apollo/client/react';
import { Provider as JotaiProvider } from 'jotai';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './app/App';
import { AuthSession } from './auth/AuthSession';
import { store } from './components/atoms/store';
import { ToastProvider } from './components/toast';
import { client } from './gql/ApolloConfigs';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JotaiProvider store={store}>
      <ApolloProvider client={client}>
        <ToastProvider>
          <AuthSession />
          <App />
        </ToastProvider>
      </ApolloProvider>
    </JotaiProvider>
  </StrictMode>,
);
