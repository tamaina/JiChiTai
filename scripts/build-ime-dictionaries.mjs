import { readFile, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { zipSync, strToU8 } from 'fflate'

const root = path.resolve(import.meta.dirname, '..')
const source = await readFile(
  path.join(root, 'src/shared/data/generated-municipalities.ts'),
  'utf8',
)
const prefectureRomaji = JSON.parse(
  await readFile(
    path.join(root, 'src/shared/data/prefecture-romaji.json'),
    'utf8',
  ),
)
const output = path.join(root, 'public/generated/dictionaries')

function parseRecords(section) {
  return [...section.matchAll(/\{([\s\S]*?)\},/g)].map(([, body]) =>
    Object.fromEntries(
      [...body.matchAll(/(\w+): '([^']*)'/g)].map(([, key, value]) => [
        key,
        value,
      ]),
    ),
  )
}

const prefectureSection = source.match(
  /generatedPrefectures[^=]*= \[([\s\S]*?)\n\]/,
)?.[1]
const municipalitySection = source.match(
  /generatedMunicipalities[^=]*= \[([\s\S]*?)\n\]/,
)?.[1]
if (!prefectureSection || !municipalitySection)
  throw new Error('Could not parse generated municipality data')

const prefectures = parseRecords(prefectureSection)
const municipalities = parseRecords(municipalitySection)

function stripPrefecture(record) {
  if (record.name === '北海道')
    return { reading: record.kana, word: record.name }
  const suffixes = [
    ['けん', '県'],
    ['ふ', '府'],
    ['と', '都'],
  ]
  const suffix = suffixes.find(
    ([reading, word]) =>
      record.kana.endsWith(reading) && record.name.endsWith(word),
  )
  if (!suffix) throw new Error(`Unknown prefecture suffix: ${record.name}`)
  return {
    reading: record.kana.slice(0, -suffix[0].length),
    word: record.name.slice(0, -suffix[1].length),
  }
}

function stripMunicipality(record) {
  const suffixes = [
    ['し', '市'],
    ['く', '区'],
    ['まち', '町'],
    ['ちょう', '町'],
    ['むら', '村'],
    ['そん', '村'],
  ]
  const suffix = suffixes.find(
    ([reading, word]) =>
      record.kana.endsWith(reading) && record.name.endsWith(word),
  )
  if (!suffix) throw new Error(`Unknown municipality suffix: ${record.name}`)
  return {
    reading: record.kana.slice(0, -suffix[0].length),
    word: record.name.slice(0, -suffix[1].length),
  }
}

function entriesFor(prefecture) {
  const entries = [{ ...stripPrefecture(prefecture), comment: prefecture.name }]
  for (const municipality of municipalities.filter(
    (item) => item.prefectureCode === prefecture.code,
  )) {
    const comment = [prefecture.name, municipality.districtName]
      .filter(Boolean)
      .join('／')
    entries.push(
      { reading: municipality.kana, word: municipality.name, comment },
      { ...stripMunicipality(municipality), comment },
    )
  }
  return entries.filter(
    (entry, index, all) =>
      index ===
      all.findIndex(
        (candidate) =>
          candidate.reading === entry.reading && candidate.word === entry.word,
      ),
  )
}

function prefectureFileStem(prefecture) {
  const romaji = prefectureRomaji[prefecture.code]
  if (!romaji) throw new Error(`Missing prefecture romaji: ${prefecture.code}`)
  return `${prefecture.code}-${romaji}`
}

const escapeXml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

function macos(entries) {
  const items = entries
    .map(
      ({ reading, word }) => `  <dict>
    <key>phrase</key>
    <string>${escapeXml(word)}</string>
    <key>shortcut</key>
    <string>${escapeXml(reading)}</string>
  </dict>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
${items}
</array>
</plist>
`
}

const google = (entries) =>
  `${entries
    .map(({ reading, word, comment }) =>
      [reading, word, '地名', comment].join('\t'),
    )
    .join('\n')}\n`

const windows = (entries) =>
  `!Microsoft IME Dictionary Tool\r\n!Version:\r\n!Format:WORDLIST\r\n${entries
    .map(({ reading, word, comment }) =>
      [reading, word, '地名その他', comment].join('\t'),
    )
    .join('\r\n')}\r\n`

const formats = {
  macos: { extension: 'plist', render: macos, encoding: 'utf8' },
  windows: { extension: 'txt', render: windows, encoding: 'utf16le' },
  google: { extension: 'txt', render: google, encoding: 'utf8' },
}

const readmes = {
  macos:
    'macOS 日本語ユーザ辞書\n\n日本語入力メニューの「ユーザ辞書を編集」を開き、使いたいplistファイルをウインドウへドラッグしてください。\n',
  windows:
    'Microsoft IME ユーザー辞書\n\nMicrosoft IMEの「ユーザー辞書ツール」から、使いたいテキストファイルを読み込んでください。文字コードはUTF-16 LEです。\n',
  google:
    'Google日本語入力 / Mozc ユーザー辞書\n\n辞書ツールの「新規辞書にインポート」から、使いたいテキストファイルを読み込んでください。\n',
}
const commonReadme =
  '\n47都道府県の各ファイルには都道府県名（接尾辞なし）と、その都道府県の市区町村名（接尾辞あり・なし）を収録しています。北海道は「ほっかいどう → 北海道」です。データはJiChiTai収録のe-Stat「市区町村名・コード」に基づきます。\n'

await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })

for (const [formatName, format] of Object.entries(formats)) {
  const directory = path.join(output, formatName)
  await mkdir(directory, { recursive: true })
  const archive = {}
  for (const prefecture of prefectures) {
    const filename = `${prefectureFileStem(prefecture)}.${format.extension}`
    const rendered = format.render(entriesFor(prefecture))
    const bytes =
      format.encoding === 'utf16le'
        ? Buffer.concat([
            Buffer.from([0xff, 0xfe]),
            Buffer.from(rendered, 'utf16le'),
          ])
        : Buffer.from(rendered, 'utf8')
    await writeFile(path.join(directory, filename), bytes)
    archive[filename] = new Uint8Array(bytes)
  }
  archive['README.txt'] = strToU8(readmes[formatName] + commonReadme)
  await writeFile(
    path.join(output, `jichitai-${formatName}.zip`),
    zipSync(archive, { level: 9, mtime: new Date('1980-01-01T00:00:00Z') }),
  )
}

console.log(
  `Generated ${prefectures.length} prefecture dictionaries in ${Object.keys(formats).length} formats`,
)
