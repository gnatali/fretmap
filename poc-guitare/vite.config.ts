/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:https` (mode « https ») sert la page en HTTPS avec un certificat
// auto-signé, pour tester le micro depuis un téléphone du réseau local.
// Vite ne propose plus l'option CLI `--https` : le plugin la remplace.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'https' ? [basicSsl()] : [],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
