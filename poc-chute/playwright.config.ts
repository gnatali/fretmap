import { defineConfig, devices } from '@playwright/test';
import { CHEMIN_SON } from './tests/e2e/son';

// Tests de bout en bout (spec du POC §12) sur le build servi par `vite preview`.
// En local, CHROMIUM_PATH peut désigner un Chromium déjà installé ; en CI : `npx playwright install chromium`.
// Port 4174 : en local, l'application occupe déjà 4173 et reuseExistingServer la testerait à la place du POC.
// Le micro est simulé, comme dans app/, par un fichier WAV écrit par tests/e2e/son.ts avant le lancement de
// Chromium, et lu une seule fois (%noloop) à partir de l'ouverture du micro. Les parties en mode simulation
// n'ouvrent pas le micro.
export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/son.ts',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4174',
    permissions: ['microphone'],
    launchOptions: {
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${CHEMIN_SON}%noloop`,
      ],
    },
  },
  projects: [{ name: 'android', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run preview -- --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
  },
});
