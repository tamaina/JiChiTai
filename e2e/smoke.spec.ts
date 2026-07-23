import { expect, test, type Locator, type Page } from './test'
import { toRomaji } from 'wanakana'
import { municipalities } from '../src/shared/data/municipalities'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173'

async function goto(page: Page, pathname: string) {
  await page.goto(new URL(pathname, baseURL).href)
}

async function expectShareText(textarea: Locator, expectedContent: RegExp) {
  const value = await textarea.inputValue()
  const separatorIndex = value.lastIndexOf('\n\n')
  expect(separatorIndex).toBeGreaterThan(0)
  expect(value.slice(0, separatorIndex)).toMatch(expectedContent)

  const shareUrl = new URL(value.slice(separatorIndex + 2))
  expect(shareUrl.protocol).toBe('https:')
  expect(shareUrl.hostname).not.toBe('')
}

for (const path of ['/', '/play', '/about']) {
  test(`${path} opens directly`, async ({ page }) => {
    await goto(page, path)
    await expect(page.locator('header')).toBeVisible()
  })
}

test('root page starts at mode selection', async ({ page }) => {
  await goto(page, '/')
  await expect(
    page.getByRole('heading', { name: 'モードを選ぶ' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '開始する' })).toBeVisible()
})

test('about page exposes credits as external links', async ({ page }) => {
  await goto(page, '/about')
  for (const name of [
    'e-Stat「市区町村名・コード」',
    'ShiKuChoSon',
    'Hokkaidle',
    'tamaina/JiChiTai',
    'sponsors/tamaina',
  ]) {
    await expect(page.getByRole('link', { name })).toHaveAttribute(
      'target',
      '_blank',
    )
  }
})

test('health API is available in the browser', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)
  await expect(response.json()).resolves.toMatchObject({ status: 'ok' })
})

test('does not overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await goto(page, '/')
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  )
  expect(overflows).toBe(false)
})

test('keeps the answer form visible in a landscape viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await goto(page, '/play')
  await page.getByLabel('練習').check()
  await page.getByRole('button', { name: '開始する' }).click()
  await expect(page.locator('.countdown-number')).toHaveText('3')
  const formIsVisible = await page
    .locator('.question-current .answer-input')
    .evaluate(
      (element) => element.getBoundingClientRect().bottom <= innerHeight,
    )
  expect(formIsVisible).toBe(true)
})

test('shows a shareable result text', async ({ page }) => {
  await goto(page, '/play')
  await page.getByLabel('練習').check()
  await page.getByRole('button', { name: '開始する' }).click()
  await page.getByRole('button', { name: '練習を終了' }).click()
  await expectShareText(
    page.getByLabel('共有用の結果テキスト'),
    /^#JiChiTai 都道府県当て 練習\n結果: 正答0問\/誤答0問\/出題1問 \(正答率0%\)\nキータイプ: 0回\/\d+分\d{2}秒\/0KPM\/0WPM$/,
  )
  await expect(page.getByRole('button', { name: 'コピー' })).toBeVisible()
})

test('shows the compact result after completing every city', async ({
  page,
}) => {
  await goto(page, '/play')
  await page.getByRole('combobox', { name: '都道府県' }).selectOption('31')
  await page.getByLabel('市のみ').check()
  await page.getByLabel('タイピング').check()
  await page.getByLabel('練習').check()
  await page.getByRole('button', { name: '開始する' }).click()

  for (let index = 0; index < 4; index += 1) {
    const question = page.locator(
      '.question-current:has(.answer-input:enabled)',
    )
    const source = await question
      .locator('.municipality-shape-image')
      .getAttribute('src')
    const code = source?.match(/(\d{5})\.svg$/)?.[1]
    const record = municipalities.find((item) => item.code === code)
    expect(record).toBeDefined()
    await question
      .getByLabel('都道府県+市区町村 ローマ字入力')
      .fill(toRomaji(`${record!.prefecture.kana}${record!.kana}`))
    await question.getByLabel('都道府県+市区町村 ローマ字入力').press('Enter')
    if (index < 3) {
      const nextQuestion = page.locator(
        '.question-current:has(.answer-input:enabled)',
      )
      await expect(nextQuestion).toBeVisible()
      await expect(
        nextQuestion.locator('.municipality-shape-image'),
      ).not.toHaveAttribute('src', source ?? '')
    }
  }

  await expectShareText(
    page.getByLabel('共有用の結果テキスト'),
    /^#JiChiTai 鳥取県全市 タイピング\n結果: \d+分\d{2}秒\nキータイプ: [1-9]\d*回\/\d+分\d{2}秒\/\d+KPM\/\d+(?:\.\d+)?WPM$/,
  )
  await page.locator('.history-shape-button').first().click()
  const locationPreview = page.locator('.history-location-preview').first()
  await expect(locationPreview).toBeVisible()
  await expect(
    locationPreview.locator('.history-prefecture-shape'),
  ).toHaveAttribute('src', /\/generated\/prefectures\/31\.svg$/)
  await expect(
    locationPreview.locator('.history-municipality-placement'),
  ).toBeVisible()
  await expect(page.locator('.history-location-preview')).toHaveCount(1)
  const trigger = page.locator('.history-shape-button').first()
  const beforeScroll = await Promise.all([
    trigger.boundingBox(),
    locationPreview.boundingBox(),
  ])
  await page.evaluate(() => window.scrollBy(0, 120))
  const afterScroll = await Promise.all([
    trigger.boundingBox(),
    locationPreview.boundingBox(),
  ])
  expect(beforeScroll[0]).not.toBeNull()
  expect(beforeScroll[1]).not.toBeNull()
  expect(afterScroll[0]).not.toBeNull()
  expect(afterScroll[1]).not.toBeNull()
  expect(
    Math.abs(
      beforeScroll[1]!.y -
        beforeScroll[0]!.y -
        (afterScroll[1]!.y - afterScroll[0]!.y),
    ),
  ).toBeLessThan(2)
  await page.getByRole('button', { name: '位置表示を閉じる' }).click({
    position: { x: 4, y: 4 },
  })
  await expect(page.locator('.history-location-preview')).toHaveCount(0)
})

test('starts a practice game and accepts a correct answer', async ({
  page,
}) => {
  await goto(page, '/play')
  await page.getByLabel('練習').check()
  await page.getByRole('button', { name: '開始する' }).click()
  const source = await page
    .locator('.question-current .municipality-shape-image')
    .getAttribute('src')
  const code = source?.match(/(\d{5})\.svg$/)?.[1]
  const record = municipalities.find((item) => item.code === code)
  expect(record).toBeDefined()
  const answer = page
    .locator('.question-current')
    .getByLabel('都道府県 ローマ字入力')
  await answer.fill(toRomaji(record!.prefecture.kana))
  await answer.press('Enter')
  await expect(
    page.locator('.question-current .prefecture-placement-image'),
  ).toBeVisible()
  await expect(
    page.locator('.question-current .feedback').getByText(/^正解/),
  ).toBeVisible()
})
