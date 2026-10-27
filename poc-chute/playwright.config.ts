import { defineConfig, devices } from '@playwright/test';

// Tests de bout en bout (spec du POC §12) sur le build servi par `vite preview`.
// En local, CHROMIUM_PATH peut désigner un Chromium déjà installé ; en CI : `npx playwright install chromium`.
// Port 4174 : en local, l'application occupe déjà 4173 et reuseExistingServer la testerait à la place du POC.
// Le micro simulé (fichier WAV, comme dans app/) arrive en phase 4 ; le mode simulation sert d'ici là.
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4174',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'android', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run preview -- --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
  },
});
