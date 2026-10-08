import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import './index.css';
import { App } from './app/App';
import { ToastProvider } from './app/toast';
import { persistOptions, queryClient } from './app/queryClient';
import { SecureContextGate } from './ui/SecureContextGate';
import { initSession, installAutoLock } from './core/vault';

void initSession();
installAutoLock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <SecureContextGate>
        <BrowserRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </SecureContextGate>
    </PersistQueryClientProvider>
  </StrictMode>,
);
