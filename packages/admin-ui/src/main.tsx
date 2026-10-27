import './styles/global.css';
import './styles/main.css';

import { ApolloProvider } from '@apollo/client/react';
import { ToastOutlet } from '@gemini-hlsw/lucuma-common-ui';
import { Provider as JotaiProvider } from 'jotai';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './app/App';
import { AuthSession } from './auth/AuthSession';
import { store } from './components/atoms/store';
import { client } from './gql/ApolloConfigs';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JotaiProvider store={store}>
      <ApolloProvider client={client}>
        <ToastOutlet position="bottom-right" />
        <AuthSession />
        <App />
      </ApolloProvider>
    </JotaiProvider>
  </StrictMode>,
);
