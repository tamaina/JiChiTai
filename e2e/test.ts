import {
  _electron,
  expect,
  test as base,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const electronMain = fileURLToPath(
  new URL('../scripts/electron-main.mjs', import.meta.url),
)

const electronTest = base.extend<
  { page: Page },
  { electronApp: ElectronApplication }
>({
  electronApp: [
    // Playwright requires fixture callbacks to use object destructuring.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key, value]) =>
            key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined,
        ),
      ) as Record<string, string>

      const electronApp = await _electron.launch({
        args: [electronMain],
        cwd: path.dirname(electronMain),
        env: {
          ...env,
          ELECTRON_TEST_URL:
            process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173',
        },
      })

      await use(electronApp)
      await electronApp.close()
    },
    { scope: 'worker' },
  ],

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.goto(process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await use(page)
  },
})

export const test =
  process.env.PLAYWRIGHT_USE_ELECTRON === '1' ? electronTest : base

export { expect }
export type { Locator, Page } from '@playwright/test'
