import { defineConfig, devices } from '@playwright/test';
import { CHEMIN_SON_MODE2 } from './tests/e2e/son';

// Tests de bout en bout (spec §10) sur le build servi par `vite preview`.
// En local, CHROMIUM_PATH peut désigner un Chromium déjà installé ; en CI : `npx playwright install chromium`.
// Le micro est simulé par un fichier WAV écrit par tests/e2e/son.ts avant le lancement de Chromium,
// et lu une seule fois (%noloop) à partir de l'ouverture du micro.
export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/son.ts',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    permissions: ['microphone'],
    launchOptions: {
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${CHEMIN_SON_MODE2}%noloop`,
      ],
    },
  },
  projects: [{ name: 'android', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
