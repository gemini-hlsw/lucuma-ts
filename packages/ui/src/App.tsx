import { ApolloProvider } from '@apollo/client/react';
import { Authentication } from '@Contexts/Auth/Authentication';
import { Modals } from '@Contexts/Variables/Modals/Modals';
import { when } from '@gemini-hlsw/lucuma-common-ui';
import { client } from '@gql/ApolloConfigs';
import { useServerConfiguration } from '@gql/server/ServerConfiguration';
import { Provider as AtomProvider } from 'jotai';
import { Message } from 'primereact/message';
import { startTransition, useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { serverConfigAtom } from './components/atoms/config';
import { store } from './components/atoms/store';
import { useThemeValue } from './components/atoms/theme';
import Home from './components/Layout/Home/Home';
import Layout from './components/Layout/Layout';
import Login from './components/Login/Login';
import { SolarProgress } from './components/SolarProgress';
import { VersionManager } from './components/VersionManager/VersionManager';
import { ToastProvider } from './Helpers/ToastProvider';

const router = createBrowserRouter([
  { path: '/', element: <Layout />, children: [{ index: true, element: <Home /> }] },
  { path: '/login', element: <Login /> },
]);

const formatTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function App() {
  const theme = useThemeValue();
  // Re-render on theme change
  useEffect(() => {
    document.body.classList.value = theme;
  }, [theme]);

  const [loading, setLoading] = useState(true);
  const { data, error, refetch } = useServerConfiguration({ client });

  useEffect(() => {
    if (data?.serverConfiguration) {
      startTransition(() => {
        store.set(serverConfigAtom, data.serverConfiguration);
        setLoading(false);
      });
    }
  }, [data?.serverConfiguration]);

  const [retryInSeconds, setRetryInSeconds] = useState<number | null>(null);

  // On an error, retry after 10 seconds. And show a countdown.
  useEffect(() => {
    if (error) {
      const startRetryInSeconds = 10;
      startTransition(() => setRetryInSeconds(startRetryInSeconds));
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      const timeout = setTimeout(() => refetch(), startRetryInSeconds * 1000);
      const interval = setInterval(
        () => setRetryInSeconds((prev) => (prev === null || prev <= 0 ? null : prev - 1)),
        1000,
      );

      return () => {
        clearTimeout(timeout);
        clearInterval(interval);
      };
    }
    return;
  }, [error, refetch]);

  if (error) {
    return (
      <div className="error-container">
        <Message
          text={
            <>
              <p>
                <b>Could not load server configuration.</b>
              </p>
              <p>{error.message}</p>
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

  if (loading) {
    return <SolarProgress />;
  }

  return (
    <AtomProvider store={store}>
      <ApolloProvider client={client}>
        <ToastProvider>
          <Authentication />
          <Modals />
          <RouterProvider router={router} />
          <VersionManager />
        </ToastProvider>
      </ApolloProvider>
    </AtomProvider>
  );
}
