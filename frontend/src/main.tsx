import React from 'react';
import ReactDOM from 'react-dom/client';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './styles/global.css';

import App from './App';
import { queryClient } from './lib/queryClient';
import { ThemedApp } from './theme/ThemedApp';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemedApp>
        <Notifications position="top-right" />
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemedApp>
    </QueryClientProvider>
  </React.StrictMode>,
);
