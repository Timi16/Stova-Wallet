/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// STOVA is a static single-page app. Everything here builds to plain files;
// there is no server code. Security headers live in vercel.json.
//
// Dev runs over HTTPS with a self-signed certificate: WebCrypto (the vault's
// encryption) only exists on secure pages, so a phone opening the LAN address
// over plain HTTP would have no crypto.subtle. Accept the certificate warning once.
export default defineConfig(({ command, mode }) => ({
  // Only the dev server gets the self-signed cert; `vite preview` (used by the e2e suite) stays plain HTTP on localhost.
  plugins: [react(), tailwindcss(), ...(command === 'serve' && mode === 'development' ? [basicSsl()] : [])],
  server: { host: true, port: 5173, strictPort: true },
  preview: { port: 4173 },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        // Long-lived vendor chunks cache well on Vercel; app code changes more often.
        manualChunks: {
          stellar: ['@stellar/stellar-sdk'],
          react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          crypto: ['@scure/bip39', '@noble/hashes', 'qrcode', 'idb-keyval'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
}));
