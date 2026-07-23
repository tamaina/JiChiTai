import {
  access,
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

const WIKIDATA_QUERY_URL = 'https://query.wikidata.org/sparql'
const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php'
const generatedMunicipalitiesFile = path.resolve(
  'src/shared/data/generated-municipalities.ts',
)
const outputFile = path.resolve('src/shared/data/generated-emblems.ts')
const assetDirectory = path.resolve('public/generated/emblems')
const userAgent =
  'JiChiTai municipality data builder/1.0 (https://github.com/tamaina/JiChiTai)'

function targetMunicipalityCodes(source) {
  const match = source.match(
    /generatedMunicipalities: GeneratedMunicipalityRecord\[\] = (\[[\s\S]*\])\n/,
  )
  if (!match) throw new Error('Could not parse generated municipality data')
  return new Set(
    [...match[1].matchAll(/\bcode:\s*'(\d{5})'/g)].map((item) => item[1]),
  )
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'User-Agent': userAgent, ...options.headers },
  })
  if (!response.ok)
    throw new Error(`${response.status} ${response.statusText}: ${url}`)
  return response.json()
}

async function wikidataEmblems(targets) {
  const query = `
    SELECT ?code ?emblem WHERE {
      ?item wdt:P429 ?code;
            wdt:P94 ?emblem.
      FILTER(STRLEN(STR(?code)) = 6)
    }
  `
  const url = new URL(WIKIDATA_QUERY_URL)
  url.searchParams.set('query', query)
  url.searchParams.set('format', 'json')
  const data = await fetchJson(url)
  const records = []
  for (const binding of data.results.bindings) {
    const fullCode = binding.code.value
    const code = fullCode.slice(0, 5)
    if (!targets.has(code)) continue
    const fileTitle = decodeURIComponent(
      new URL(binding.emblem.value).pathname.split('/').at(-1),
    )
    records.push({ code, fullCode, fileTitle })
  }
  return records
}

function normalizedTitle(value) {
  return value
    .replace(/^File:/i, '')
    .replaceAll('_', ' ')
    .trim()
    .toLowerCase()
}

function plainText(value = '') {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function acceptedLicense(value) {
  return (
    value === 'Public domain' ||
    value === 'CC0' ||
    /^CC BY(?:-SA)?(?: \d(?:\.\d)?)?(?: [A-Za-z]+)?$/.test(value)
  )
}

function extensionForMime(mime) {
  return {
    'image/svg+xml': 'svg',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }[mime]
}

async function commonsMetadata(wikidataRecords) {
  const byFileTitle = new Map()
  for (const record of wikidataRecords) {
    const key = normalizedTitle(record.fileTitle)
    const matches = byFileTitle.get(key) ?? []
    matches.push(record)
    byFileTitle.set(key, matches)
  }

  const results = []
  const titles = [...byFileTitle.values()].map(
    (records) => records[0].fileTitle,
  )
  for (let index = 0; index < titles.length; index += 20) {
    const batch = titles.slice(index, index + 20)
    const url = new URL(COMMONS_API_URL)
    url.searchParams.set('action', 'query')
    url.searchParams.set('format', 'json')
    url.searchParams.set('formatversion', '2')
    url.searchParams.set('prop', 'imageinfo')
    url.searchParams.set('iiprop', 'url|mime|extmetadata')
    url.searchParams.set(
      'titles',
      batch.map((title) => `File:${title}`).join('|'),
    )
    const data = await fetchJson(url)
    for (const page of data.query.pages) {
      const image = page.imageinfo?.[0]
      if (!image) continue
      const licenseName = plainText(image.extmetadata?.LicenseShortName?.value)
      const extension = extensionForMime(image.mime)
      if (!acceptedLicense(licenseName) || !extension) continue
      const sourceRecords = byFileTitle.get(normalizedTitle(page.title)) ?? []
      for (const sourceRecord of sourceRecords) {
        results.push({
          ...sourceRecord,
          extension,
          downloadUrl: image.url,
          sourceUrl: image.descriptionurl,
          author: plainText(image.extmetadata?.Artist?.value) || '不明',
          licenseName,
          licenseUrl:
            image.extmetadata?.LicenseUrl?.value?.replace(
              /^\/\//,
              'https://',
            ) ?? null,
        })
      }
    }
  }
  return results
}

async function downloadAsset(record) {
  const destination = path.join(
    assetDirectory,
    `${record.code}.${record.extension}`,
  )
  try {
    await access(destination)
    return `/generated/emblems/${record.code}.${record.extension}`
  } catch {
    // Continue with the download.
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(record.downloadUrl, {
        headers: { 'User-Agent': userAgent },
      })
      if (response.ok) {
        await writeFile(destination, Buffer.from(await response.arrayBuffer()))
        await new Promise((resolve) => setTimeout(resolve, 700))
        return `/generated/emblems/${record.code}.${record.extension}`
      }
      if (response.status !== 429 || attempt === 5)
        throw new Error(
          `${response.status} ${response.statusText}: ${record.downloadUrl}`,
        )
      const retryAfterSeconds = Number(response.headers.get('retry-after')) || 5
      await new Promise((resolve) =>
        setTimeout(resolve, retryAfterSeconds * 1000 * (attempt + 1)),
      )
    } catch (error) {
      if (attempt === 5) throw error
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)))
    }
  }
  throw new Error(`Could not download: ${record.downloadUrl}`)
}

const municipalitySource = await readFile(generatedMunicipalitiesFile, 'utf8')
const targets = targetMunicipalityCodes(municipalitySource)
const candidates = await wikidataEmblems(targets)
const licensed = await commonsMetadata(candidates)
const byCode = new Map()
for (const record of licensed) {
  const previous = byCode.get(record.code)
  if (!previous || (record.extension === 'svg' && previous.extension !== 'svg'))
    byCode.set(record.code, record)
}

await mkdir(assetDirectory, { recursive: true })
const selected = [...byCode.values()].sort((first, second) =>
  first.code.localeCompare(second.code),
)
const records = selected.map((record) => ({
  code: record.code,
  imageUrl: `/generated/emblems/${record.code}.${record.extension}`,
  sourceUrl: record.sourceUrl,
  author: record.author,
  licenseName: record.licenseName,
  licenseUrl: record.licenseUrl,
}))

const generated = `// Generated by scripts/build-emblems.mjs. Do not edit.
export interface GeneratedEmblemRecord {
  code: string
  imageUrl: string
  sourceUrl: string
  author: string
  licenseName: string
  licenseUrl: string | null
}

export const generatedEmblems: GeneratedEmblemRecord[] = ${JSON.stringify(records)}

export const emblemSources = ${JSON.stringify({
  wikidataQuery: WIKIDATA_QUERY_URL,
  commonsApi: COMMONS_API_URL,
})}
`
await writeFile(outputFile, generated)
await Promise.all(
  Array.from({ length: 2 }, async (_, workerIndex) => {
    for (let index = workerIndex; index < selected.length; index += 2)
      await downloadAsset(selected[index])
  }),
)
const expectedAssets = new Set(
  records.map((record) => path.basename(record.imageUrl)),
)
for (const filename of await readdir(assetDirectory)) {
  if (/^\d{5}\.[a-z]+$/.test(filename) && !expectedAssets.has(filename))
    await unlink(path.join(assetDirectory, filename))
}
console.log(
  `Generated licensed emblems for ${records.length}/${targets.size} municipalities.`,
)
