import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { App } from './app/App';
import { ToastProvider } from './app/toast';
import { SecureContextGate } from './ui/SecureContextGate';
import { initSession, installAutoLock } from './core/vault';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 5_000,
      refetchOnWindowFocus: true,
    },
  },
});

void initSession();
installAutoLock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SecureContextGate>
        <BrowserRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </SecureContextGate>
    </QueryClientProvider>
  </StrictMode>,
);
