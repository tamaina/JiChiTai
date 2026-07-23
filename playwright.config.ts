import { defineConfig, devices } from '@playwright/test'

const useElectron = process.env.PLAYWRIGHT_USE_ELECTRON === '1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm exec vite preview --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: useElectron ? 'electron' : 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
