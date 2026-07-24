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

for (const path of ['/', '/play', '/quiz', '/review', '/explore', '/about']) {
  test(`${path} opens directly`, async ({ page }) => {
    await goto(page, path)
    await expect(page.locator('header')).toBeVisible()
  })
}

test('reviews independently and replaces history only after confirmation', async ({
  page,
}) => {
  await goto(page, '/review')
  await expect(
    page.getByRole('heading', { name: 'FSRS暗記モード' }),
  ).toBeVisible()
  await expect(page.locator('.review-stats')).toContainText('1747')

  await page.getByRole('button', { name: '最大20枚を学習する' }).click()
  await expect(page.locator('.review-progress')).toContainText('1 / 20')
  const frontName = (
    await page.locator('.review-card-front h1').textContent()
  )?.trim()
  expect(municipalities.some((record) => record.name === frontName)).toBe(true)
  await page.getByRole('button', { name: '答えを見る' }).click()
  await expect(page.getByRole('button', { name: /^忘れた/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^難しい/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^普通/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^簡単/ })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: /^普通/ }).click()
  await page.getByRole('button', { name: '学習を終了' }).click()
  await expect(page.locator('.review-stats')).toContainText('1学習済み')

  await page.getByLabel('輪郭 → 自治体').check()
  await expect(page.locator('.review-stats')).toContainText('0学習済み')
  await page.getByLabel('詰め込みモード').check()
  await page.getByRole('button', { name: '対象カードをすべて学習する' }).click()
  await expect(page.locator('.review-progress')).toContainText('1 / 1747')
  await page.getByRole('button', { name: '学習を終了' }).click()

  await page.getByLabel('市外局番 → 自治体').check()
  await page.getByLabel('通常モード').check()
  await page.getByRole('button', { name: '最大20枚を学習する' }).click()
  await expect(page.locator('.review-card-front h1')).toHaveText(/^\d{2,5}$/)
  await expect(page.locator('.review-quiz-choice')).toHaveCount(4)
  await page.locator('.review-quiz-choice').first().click()
  await expect(page.locator('.review-quiz-choice-correct')).toHaveCount(1)
  await expect(page.getByText('正解', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '次へ' })).toBeVisible()
  await expect(page.getByRole('button', { name: '次へ' })).toBeInViewport()
  await expect(page.getByRole('button', { name: /^普通/ })).toHaveCount(0)
  await page.getByRole('button', { name: '次へ' }).click()
  await expect(page.locator('.review-progress')).toContainText('2 / 20')
  await page.getByRole('button', { name: '学習を終了' }).click()

  await page.getByLabel('自治体名 → 都道府県').check()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSONを書き出す' }).click()
  const download = await downloadPromise
  const exportPath = await download.path()
  expect(exportPath).not.toBeNull()

  await page.getByRole('button', { name: '最大20枚を学習する' }).click()
  await page.getByRole('button', { name: '答えを見る' }).click()
  await page.getByRole('button', { name: /^普通/ }).click()
  await page.getByRole('button', { name: '学習を終了' }).click()
  await expect(page.locator('.review-stats')).toContainText('2学習済み')

  page.once('dialog', (dialog) => dialog.dismiss())
  await page.locator('input[type="file"]').setInputFiles(exportPath!)
  await expect(page.getByRole('status')).toContainText(
    '読み込みをキャンセルしました。',
  )
  await expect(page.locator('.review-stats')).toContainText('2学習済み')

  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('input[type="file"]').setInputFiles(exportPath!)
  await expect(page.getByRole('status')).toContainText(
    '2件の学習履歴に置き換えました。',
  )
  await expect(page.locator('.review-stats')).toContainText('1学習済み')
})

test('plays both directions of the area-code quiz', async ({ page }) => {
  await goto(page, '/quiz')
  await page.getByRole('button', { name: '10問はじめる' }).click()

  const municipalityHeading = page.locator('.area-code-question h1')
  const municipalityName = (await municipalityHeading.textContent())
    ?.replace(/\s/g, '')
    .trim()
  const municipality = municipalities.find(
    (record) => `${record.prefecture.name}${record.name}` === municipalityName,
  )
  expect(municipality?.primaryAreaCode).toBeTruthy()
  await page
    .getByLabel('市外局番', { exact: true })
    .fill(municipality!.primaryAreaCode!)
  await page.getByRole('button', { name: '回答する' }).click()
  await expect(page.locator('.quiz-feedback > strong')).toHaveText('正解')

  await goto(page, '/quiz')
  await page.getByLabel('市外局番 → 自治体').check()
  await page.getByRole('button', { name: '10問はじめる' }).click()
  const areaCode = (
    await page.locator('.area-code-number').textContent()
  )?.trim()
  const choices = page.locator('.area-code-choices button')
  const choiceLabels = await choices.allTextContents()
  const correctChoiceIndex = choiceLabels.findIndex((label) =>
    municipalities.some(
      (record) =>
        `${record.prefecture.name}${record.name}` === label.trim() &&
        record.areaCodes.includes(areaCode ?? ''),
    ),
  )
  expect(correctChoiceIndex).toBeGreaterThanOrEqual(0)
  await choices.nth(correctChoiceIndex).click()
  await expect(page.locator('.quiz-feedback > strong')).toHaveText('正解')
})

test('root page starts at mode selection', async ({ page }) => {
  await goto(page, '/')
  await expect(
    page.getByRole('heading', { name: 'モードを選ぶ' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '開始する' })).toBeVisible()
})

test('wraps the navbar at the 720px breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 721, height: 800 })
  await goto(page, '/')
  await expect(page.locator('.site-header')).toHaveCSS('flex-direction', 'row')

  await page.setViewportSize({ width: 720, height: 800 })
  await expect(page.locator('.site-header')).toHaveCSS(
    'flex-direction',
    'column',
  )
})

test('explores prefectures and municipality details from the map and list', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await goto(page, '/explore')
  await expect(
    page.getByRole('heading', { name: '都道府県一覧' }),
  ).toBeVisible()
  await expect(page.locator('.prefecture-list > li')).toHaveCount(47)
  const prefectureListBox = await page.locator('.prefecture-list').boundingBox()
  const initialDataBox = await page.locator('.explore-data-panel').boundingBox()
  expect(prefectureListBox).not.toBeNull()
  expect(initialDataBox).not.toBeNull()
  await expect(page.locator('.municipality-map svg')).toHaveClass(
    /map-national/,
  )
  const nationalRegionColors = await page
    .locator('.map-national .map-region')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element)
      return { fill: style.fill, stroke: style.stroke }
    })
  expect(nationalRegionColors.stroke).toBe(nationalRegionColors.fill)
  await expect(page.locator('.map-national .map-region').first()).toHaveCSS(
    'stroke-width',
    '0.6px',
  )
  expect(
    Math.abs(
      prefectureListBox!.x +
        prefectureListBox!.width -
        (initialDataBox!.x + initialDataBox!.width),
    ),
  ).toBeLessThanOrEqual(2)

  await page.getByRole('button', { name: '鳥取県を選択' }).press('Enter')
  await expect(page).toHaveURL(/\/explore\?prefecture=31$/)
  await expect(
    page.getByRole('heading', { name: '市区町村一覧' }),
  ).toBeVisible()
  const mapBox = await page.locator('.explore-map-panel').boundingBox()
  const dataBox = await page.locator('.explore-data-panel').boundingBox()
  expect(mapBox).not.toBeNull()
  expect(dataBox).not.toBeNull()
  expect(
    await page.locator('.explore-map-panel').evaluate((element) => ({
      map: getComputedStyle(element).minHeight,
      data: getComputedStyle(document.querySelector('.explore-data-panel')!)
        .minHeight,
    })),
  ).toEqual({ map: 'auto', data: 'auto' })
  expect(dataBox!.x).toBeGreaterThan(mapBox!.x + mapBox!.width - 1)

  const focusedRegion = page.locator('.map-region').first()
  await focusedRegion.focus()
  await expect(focusedRegion).toHaveCSS('outline-style', 'none')
  await expect(focusedRegion).toHaveCSS('filter', 'brightness(0.68)')

  await page.locator('.viewer-list-row').filter({ hasText: '鳥取市' }).click()
  await expect(page).toHaveURL(/\/explore\?prefecture=31&municipality=31201$/)
  await expect(
    page.getByRole('heading', { name: '鳥取市', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.detail-data')).toContainText('31201')
  await expect(page.locator('.detail-data')).toContainText('0857')
  await expect(page.locator('.detail-data')).toContainText('680')
  await expect(page.getByRole('button', { name: '鳥取市を選択' })).toHaveClass(
    /map-region-selected/,
  )
  const selectedRegion = page.getByRole('button', { name: '鳥取市を選択' })
  const otherRegion = page
    .locator('.map-region:not(.map-region-selected)')
    .first()
  await expect(selectedRegion).toHaveCSS('fill', /rgb/)
  await expect(otherRegion).toHaveCSS('fill', /rgb/)
  await expect(otherRegion).not.toHaveCSS('fill', 'rgba(0, 0, 0, 0)')

  await page.getByRole('button', { name: '鳥取県の一覧へ戻る' }).click()
  await expect(
    page.getByRole('heading', { name: '市区町村一覧' }),
  ).toBeVisible()
  await page.getByRole('button', { name: '全国へ戻る' }).click()
  await expect(
    page.getByRole('heading', { name: '都道府県一覧' }),
  ).toBeVisible()
  await expect(page.getByText('地図を読み込み中…')).toHaveCount(0)

  await goto(page, '/explore?prefecture=10&municipality=10202')
  await expect(page.locator('.detail-data')).toContainText('027、0274')
  await expect(page.locator('.detail-data')).toContainText('027-321-1111')
})

test('stacks the explorer map and detail on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await goto(page, '/explore')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)

  await goto(page, '/explore?prefecture=31&municipality=31201')
  await expect(
    page.getByRole('heading', { name: '鳥取市', exact: true }),
  ).toBeVisible()
  const mapBox = await page.locator('.explore-map-panel').boundingBox()
  const dataBox = await page.locator('.explore-data-panel').boundingBox()
  expect(mapBox).not.toBeNull()
  expect(dataBox).not.toBeNull()
  expect(dataBox!.y).toBeGreaterThanOrEqual(mapBox!.y + mapBox!.height)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('keeps municipality postal data compact in the viewer list', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await goto(page, '/explore?prefecture=01')

  const list = page.locator('.municipality-list')
  const panel = page.locator('.explore-data-panel')
  const listBox = await list.boundingBox()
  const panelBox = await panel.boundingBox()
  expect(listBox).not.toBeNull()
  expect(panelBox).not.toBeNull()
  expect(
    Math.abs(listBox!.x + listBox!.width - (panelBox!.x + panelBox!.width)),
  ).toBeLessThanOrEqual(2)

  const sapporo = page.locator('.viewer-list-row').filter({ hasText: '札幌市' })
  await expect(sapporo).toContainText('〒 001〜007・060〜065')
  await expect(sapporo.locator('.viewer-list-name strong')).toHaveCSS(
    'white-space',
    'nowrap',
  )

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(sapporo).toHaveCSS('justify-content', 'flex-start')
  const mobileRowBox = await sapporo.boundingBox()
  expect(mobileRowBox).not.toBeNull()
  expect(mobileRowBox!.height).toBeLessThan(180)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('answers a prefecture from a licensed municipality emblem', async ({
  page,
}) => {
  await goto(page, '/play')
  await page.getByLabel('市区町村章当て').check()
  await page.getByLabel('練習').check()
  await page.getByRole('button', { name: '開始する' }).click()

  const question = page.locator('.question-current:has(.answer-input:enabled)')
  const emblem = question.getByAltText('市区町村章')
  await expect(emblem).toBeVisible()
  await expect
    .poll(() =>
      emblem.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0)
  await expect(question.locator('.municipality-name')).toHaveCount(0)
  const source = await emblem.getAttribute('src')
  const code = source?.match(/(\d{5})\.[a-z]+$/)?.[1]
  const record = municipalities.find((item) => item.code === code)
  expect(record?.emblem).toBeTruthy()

  await question
    .getByLabel('都道府県 ローマ字入力')
    .fill(toRomaji(record!.prefecture.kana))
  await question.getByLabel('都道府県 ローマ字入力').press('Enter')
  await expect(page.locator('.emblem-attribution')).toContainText('画像:')
  await question.getByRole('button', { name: '練習を終了' }).click()
  await expect(page.locator('.history-emblem')).toBeVisible()
  await expect(page.locator('.history-emblem-attribution')).toBeVisible()
})

test('about page exposes credits as external links', async ({ page }) => {
  await goto(page, '/about')
  for (const name of [
    'e-Stat「市区町村名・コード」',
    'ShiKuChoSon',
    'Hokkaidle',
    'Wikidata',
    'Wikimedia Commons',
    '日本郵便「郵便番号データ」',
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

test('keeps the municipality and input visible above a mobile keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), {
      height: 844,
      width: 390,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
      onresize: null,
      onscroll: null,
    })
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    })
  })
  await goto(page, '/play')
  await page.getByLabel('練習').check()
  await page.getByRole('button', { name: '開始する' }).click()

  const question = page.locator('.question-current:has(.answer-input:enabled)')
  await expect(question).toBeVisible()
  await page.evaluate(() => {
    const viewport = window.visualViewport!
    Object.assign(viewport, { height: 360, offsetTop: 24 })
    viewport.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('scroll'))
  })

  const stageBox = await page.locator('.game-start-stage').boundingBox()
  const nameBox = await question.locator('.municipality-name').boundingBox()
  const inputBox = await question.locator('.answer-input').boundingBox()
  expect(stageBox).not.toBeNull()
  expect(nameBox).not.toBeNull()
  expect(inputBox).not.toBeNull()
  expect(stageBox!.y).toBeCloseTo(24, 0)
  expect(stageBox!.height).toBeCloseTo(360, 0)
  expect(nameBox!.y).toBeGreaterThanOrEqual(stageBox!.y)
  expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(
    stageBox!.y + stageBox!.height,
  )

  const source = await question
    .locator('.municipality-shape-image')
    .getAttribute('src')
  const code = source?.match(/(\d{5})\.svg$/)?.[1]
  const record = municipalities.find((item) => item.code === code)
  expect(record).toBeDefined()
  await question
    .getByLabel('都道府県 ローマ字入力')
    .fill(toRomaji(record!.prefecture.kana))
  await question.getByLabel('都道府県 ローマ字入力').press('Enter')

  const nextQuestion = page.locator(
    '.question-current:has(.answer-input:enabled)',
  )
  await expect(nextQuestion).toBeVisible()
  await expect
    .poll(async () => {
      const nextBox = await nextQuestion.boundingBox()
      return nextBox ? nextBox.x + nextBox.width : Number.POSITIVE_INFINITY
    })
    .toBeLessThanOrEqual(stageBox!.x + stageBox!.width + 0.5)
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

  const enteredAnswer = page.locator('.history-entered-answer').first()
  const expectedAnswer = page.locator('.history-expected-answer').first()
  await expect(enteredAnswer).toHaveCSS('overflow-wrap', 'anywhere')
  await expect(expectedAnswer).toHaveCSS('overflow-wrap', 'anywhere')
  const answerCellWidth = await page
    .locator('.history-answer-cell')
    .first()
    .evaluate((element) => element.getBoundingClientRect().width)
  expect(answerCellWidth).toBeLessThanOrEqual(280)
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
