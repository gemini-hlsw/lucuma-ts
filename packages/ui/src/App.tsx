import { ApolloProvider } from '@apollo/client/react';
import { Authentication } from '@Contexts/Auth/Authentication';
import { Modals } from '@Contexts/Variables/Modals/Modals';
import { when } from '@gemini-hlsw/lucuma-common-ui';
import { client } from '@gql/ApolloConfigs';
import { useServerConfiguration } from '@gql/server/ServerConfiguration';
import { Provider as AtomProvider } from 'jotai';
import { Message } from 'primereact/message';
import { type PropsWithChildren, Suspense, useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { store } from './components/atoms/store';
import { useThemeValue } from './components/atoms/theme';
import Home from './components/Layout/Home/Home';
import Layout from './components/Layout/Layout';
import Login from './components/Login/Login';
import { SolarProgress } from './components/SolarProgress';
import { VersionManager } from './components/VersionManager/VersionManager';
import { ToastProvider } from './Helpers/ToastProvider';

const router = createBrowserRouter([
  { path: '/', Component: Layout, children: [{ index: true, Component: Home }] },
  { path: '/login', Component: Login },
]);

const formatTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function App() {
  const theme = useThemeValue();
  // Re-render on theme change
  useEffect(() => {
    document.body.classList.value = theme;
  }, [theme]);

  return (
    <AtomProvider store={store}>
      <ApolloProvider client={client}>
        <ToastProvider>
          <Suspense fallback={<SolarProgress />}>
            <ServerConfigGate>
              <Authentication />
              <Modals />
              <RouterProvider router={router} useTransitions />
              <VersionManager />
            </ServerConfigGate>
          </Suspense>
        </ToastProvider>
      </ApolloProvider>
    </AtomProvider>
  );
}

function ServerConfigGate({ children }: PropsWithChildren) {
  const { data, error, refetch } = useServerConfiguration();

  const [retryInSeconds, setRetryInSeconds] = useState<number | null>(null);

  // On an error, retry after 10 seconds. And show a countdown.
  useEffect(() => {
    if (!error) return;

    const retryAt = Date.now() + 10_000;
    const update = () => {
      const remaining = Math.max(0, Math.round((retryAt - Date.now()) / 1000));
      setRetryInSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setRetryInSeconds(null);
        void refetch();
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [error, refetch]);

  if (error || !data) {
    return (
      <div className="error-container">
        <Message
          text={
            <>
              <p>
                <b>Could not load server configuration.</b>
              </p>
              <p>{error?.message}</p>
              {when(retryInSeconds, (retryInSeconds) => (
                <p>Retrying {formatTime.format(retryInSeconds, 'second')}...</p>
              ))}
            </>
          }
          severity="error"
        />
      </div>
    );
  }

  return children;
}
