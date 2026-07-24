import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import polygonClipping from 'polygon-clipping'
import { feature as topojsonFeature } from 'topojson-client'

const require = createRequire(import.meta.url)
const japanAtlasFile = require.resolve('jpn-atlas/japan/japan.json')
const japanAtlasPackage = require('jpn-atlas/package.json')

const ADMINS_URL =
  'https://github.com/geolonia/japanese-admins/archive/refs/heads/master.zip'
const LAKES_URL =
  'https://nlftp.mlit.go.jp/ksj/gml/data/W09/W09-05/W09-05_GML.zip'
const LARGE_LAKE_MINIMUM_AREA_KM2 = 10
const LAKE_SIMPLIFICATION_TOLERANCE = 0.0005
const standardRegionsFile = path.resolve('data/e-stat-standard-regions.csv')
const outputDirectory = path.resolve('public/generated/geometry')
const prefectureOutputDirectory = path.resolve('public/generated/prefectures')
const mapOutputDirectory = path.resolve('public/generated/maps')
const dataFile = path.resolve('src/shared/data/generated-municipalities.ts')
const nationalMapDataFile = path.resolve(
  'src/shared/data/generated-national-map.ts',
)

// Administrative wards are merged into their designated city for the initial game.
const designatedCities = new Map([
  ['札幌市', '01100'],
  ['仙台市', '04100'],
  ['さいたま市', '11100'],
  ['千葉市', '12100'],
  ['横浜市', '14100'],
  ['川崎市', '14130'],
  ['相模原市', '14150'],
  ['新潟市', '15100'],
  ['静岡市', '22100'],
  ['浜松市', '22130'],
  ['名古屋市', '23100'],
  ['京都市', '26100'],
  ['大阪市', '27100'],
  ['堺市', '27140'],
  ['神戸市', '28100'],
  ['岡山市', '33100'],
  ['広島市', '34100'],
  ['北九州市', '40100'],
  ['福岡市', '40130'],
  ['熊本市', '43100'],
])

// japanese-admins still contains Hamamatsu's seven wards from before the
// 2024 reorganization, while the e-Stat master only contains the three new
// wards. Merge those legacy boundary codes into the current parent city.
const legacyDesignatedCityParentByCode = new Map(
  ['22131', '22132', '22133', '22134', '22135', '22136', '22137'].map(
    (code) => [code, '22130'],
  ),
)

const prefectureKanaByName = new Map([
  ['北海道', 'ほっかいどう'],
  ['青森県', 'あおもりけん'],
  ['岩手県', 'いわてけん'],
  ['宮城県', 'みやぎけん'],
  ['秋田県', 'あきたけん'],
  ['山形県', 'やまがたけん'],
  ['福島県', 'ふくしまけん'],
  ['茨城県', 'いばらきけん'],
  ['栃木県', 'とちぎけん'],
  ['群馬県', 'ぐんまけん'],
  ['埼玉県', 'さいたまけん'],
  ['千葉県', 'ちばけん'],
  ['東京都', 'とうきょうと'],
  ['神奈川県', 'かながわけん'],
  ['新潟県', 'にいがたけん'],
  ['富山県', 'とやまけん'],
  ['石川県', 'いしかわけん'],
  ['福井県', 'ふくいけん'],
  ['山梨県', 'やまなしけん'],
  ['長野県', 'ながのけん'],
  ['岐阜県', 'ぎふけん'],
  ['静岡県', 'しずおかけん'],
  ['愛知県', 'あいちけん'],
  ['三重県', 'みえけん'],
  ['滋賀県', 'しがけん'],
  ['京都府', 'きょうとふ'],
  ['大阪府', 'おおさかふ'],
  ['兵庫県', 'ひょうごけん'],
  ['奈良県', 'ならけん'],
  ['和歌山県', 'わかやまけん'],
  ['鳥取県', 'とっとりけん'],
  ['島根県', 'しまねけん'],
  ['岡山県', 'おかやまけん'],
  ['広島県', 'ひろしまけん'],
  ['山口県', 'やまぐちけん'],
  ['徳島県', 'とくしまけん'],
  ['香川県', 'かがわけん'],
  ['愛媛県', 'えひめけん'],
  ['高知県', 'こうちけん'],
  ['福岡県', 'ふくおかけん'],
  ['佐賀県', 'さがけん'],
  ['長崎県', 'ながさきけん'],
  ['熊本県', 'くまもとけん'],
  ['大分県', 'おおいたけん'],
  ['宮崎県', 'みやざきけん'],
  ['鹿児島県', 'かごしまけん'],
  ['沖縄県', 'おきなわけん'],
])

function parseCsvLine(line) {
  const fields = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) {
      fields.push(value)
      value = ''
    } else value += character
  }
  fields.push(value)
  return fields
}

function districtFromBoundaryName(boundaryName, region) {
  const prefix = region.prefectureName
  const suffix = region.municipalityName
  if (
    !suffix ||
    !boundaryName.startsWith(prefix) ||
    !boundaryName.endsWith(suffix)
  )
    return ''
  const hierarchy = boundaryName.slice(prefix.length, -suffix.length)
  const districtEnd = hierarchy.lastIndexOf('郡')
  return districtEnd < 0 ? '' : hierarchy.slice(0, districtEnd + 1)
}

function rings(geometry) {
  return geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates
}

function mergeGeometries(geometries) {
  if (geometries.length === 1) return geometries[0]
  const merged = polygonClipping.union(...geometries.map(rings))
  return { type: 'MultiPolygon', coordinates: merged }
}

function parseLargeLakes(archive) {
  const files = unzipSync(archive)
  const source = strFromU8(files['W09-05-g.xml'])
  const curves = new Map()
  for (const match of source.matchAll(
    /<gml:Curve gml:id="([^"]+)">[\s\S]*?<gml:posList>([\s\S]*?)<\/gml:posList>[\s\S]*?<\/gml:Curve>/g,
  )) {
    const values = match[2].trim().split(/\s+/).map(Number)
    const coordinates = []
    for (let index = 0; index < values.length; index += 2)
      coordinates.push([values[index + 1], values[index]])
    curves.set(match[1], coordinates)
  }

  const surfaces = new Map()
  for (const match of source.matchAll(
    /<gml:Surface gml:id="([^"]+)">([\s\S]*?)<\/gml:Surface>/g,
  )) {
    const references = [...match[2].matchAll(/xlink:href="#_?([^"]+)"/g)].map(
      (item) => item[1],
    )
    const coordinates = references.map((reference) => curves.get(reference))
    if (coordinates.length && coordinates.every(Boolean))
      surfaces.set(match[1], { type: 'Polygon', coordinates })
  }

  const lakes = []
  for (const match of source.matchAll(
    /<ksj:Lake[^>]*>([\s\S]*?)<\/ksj:Lake>/g,
  )) {
    const body = match[1]
    const surfaceId = body.match(/<ksj:bounds xlink:href="#([^"]+)"/)?.[1]
    const name = body.match(/<ksj:lakeName>([^<]+)<\/ksj:lakeName>/)?.[1]
    const geometry = surfaces.get(surfaceId)
    if (!geometry || !name) continue
    const areaKm2 = geometry.coordinates.reduce((total, ring, index) => {
      const latitude =
        ring.reduce((sum, point) => sum + point[1], 0) / ring.length
      const longitudeScale = Math.cos((latitude * Math.PI) / 180)
      const area = Math.abs(
        ring.reduce((sum, point, pointIndex) => {
          const next = ring[(pointIndex + 1) % ring.length]
          return (
            sum +
            point[0] * longitudeScale * next[1] -
            next[0] * longitudeScale * point[1]
          )
        }, 0) *
          0.5 *
          111.32 ** 2,
      )
      return total + (index === 0 ? area : -area)
    }, 0)
    if (areaKm2 >= LARGE_LAKE_MINIMUM_AREA_KM2)
      lakes.push({
        name,
        geometry: {
          ...geometry,
          coordinates: geometry.coordinates.map((ring) =>
            simplify(ring, LAKE_SIMPLIFICATION_TOLERANCE),
          ),
        },
        areaKm2,
      })
  }
  return lakes
}

function geometryBounds(geometry) {
  return rings(geometry)
    .flat(2)
    .reduce(
      (bounds, [longitude, latitude]) => ({
        minLongitude: Math.min(bounds.minLongitude, longitude),
        maxLongitude: Math.max(bounds.maxLongitude, longitude),
        minLatitude: Math.min(bounds.minLatitude, latitude),
        maxLatitude: Math.max(bounds.maxLatitude, latitude),
      }),
      {
        minLongitude: Infinity,
        maxLongitude: -Infinity,
        minLatitude: Infinity,
        maxLatitude: -Infinity,
      },
    )
}

function boundsIntersect(first, second) {
  return (
    first.minLongitude <= second.maxLongitude &&
    first.maxLongitude >= second.minLongitude &&
    first.minLatitude <= second.maxLatitude &&
    first.maxLatitude >= second.minLatitude
  )
}

function subtractLakes(geometry, lakes) {
  const bounds = geometryBounds(geometry)
  let coordinates = rings(geometry)
  for (const lake of lakes) {
    if (!boundsIntersect(bounds, lake.bounds)) continue
    coordinates = polygonClipping.difference(coordinates, rings(lake.geometry))
  }
  return { type: 'MultiPolygon', coordinates }
}

function perpendicularDistance(point, start, end) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  if (!dx && !dy) return Math.hypot(point[0] - start[0], point[1] - start[1])
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
        (dx * dx + dy * dy),
    ),
  )
  return Math.hypot(point[0] - start[0] - t * dx, point[1] - start[1] - t * dy)
}

function simplifyOpen(points, tolerance) {
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop()
    let distance = 0
    let selected = 0
    for (let index = start + 1; index < end; index += 1) {
      const candidate = perpendicularDistance(
        points[index],
        points[start],
        points[end],
      )
      if (candidate > distance) [distance, selected] = [candidate, index]
    }
    if (distance > tolerance) {
      keep[selected] = 1
      stack.push([start, selected], [selected, end])
    }
  }
  return points.filter((_, index) => keep[index])
}

function simplify(points, tolerance) {
  if (points.length <= 4) return points
  const open = points.slice(0, -1)
  const [startX, startY] = open[0]
  let oppositeIndex = 1
  let oppositeDistance = 0
  for (let index = 1; index < open.length; index += 1) {
    const distance = Math.hypot(
      open[index][0] - startX,
      open[index][1] - startY,
    )
    if (distance > oppositeDistance)
      [oppositeDistance, oppositeIndex] = [distance, index]
  }
  const first = simplifyOpen(open.slice(0, oppositeIndex + 1), tolerance)
  const second = simplifyOpen(
    [...open.slice(oppositeIndex), open[0]],
    tolerance,
  )
  const result = [...first, ...second.slice(1)]
  if (new Set(result.slice(0, -1).map((point) => point.join(','))).size >= 3)
    return result

  let thirdIndex = 1
  let thirdDistance = 0
  for (let index = 1; index < open.length; index += 1) {
    if (index === oppositeIndex) continue
    const distance = perpendicularDistance(
      open[index],
      open[0],
      open[oppositeIndex],
    )
    if (distance > thirdDistance)
      [thirdDistance, thirdIndex] = [distance, index]
  }
  const triangle = [0, oppositeIndex, thirdIndex]
    .sort((firstIndex, secondIndex) => firstIndex - secondIndex)
    .map((index) => open[index])
  return [...triangle, triangle[0]]
}

function toSvg(geometry, label, sharedLongitudeScale) {
  const geographicRings = rings(geometry).flat()
  const latitudes = geographicRings.flat().map((point) => point[1])
  const latitudeBounds = latitudes.reduce(
    ([minimum, maximum], value) => [
      Math.min(minimum, value),
      Math.max(maximum, value),
    ],
    [Infinity, -Infinity],
  )
  const centerLatitude = (latitudeBounds[0] + latitudeBounds[1]) / 2
  const longitudeScale =
    sharedLongitudeScale ?? Math.cos((centerLatitude * Math.PI) / 180)
  const projected = geographicRings.map((ring) =>
    ring.map(([x, y]) => [x * longitudeScale, y]),
  )
  const points = projected.flat()
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const [minX, maxX] = xs.reduce(
    ([minimum, maximum], value) => [
      Math.min(minimum, value),
      Math.max(maximum, value),
    ],
    [Infinity, -Infinity],
  )
  const [minY, maxY] = ys.reduce(
    ([minimum, maximum], value) => [
      Math.min(minimum, value),
      Math.max(maximum, value),
    ],
    [Infinity, -Infinity],
  )
  const width = maxX - minX
  const height = maxY - minY
  const scale = 84 / Math.max(width, height)
  const offsetX = 8 + (84 - width * scale) / 2
  const offsetY = 8 + (84 - height * scale) / 2
  const command = ([x, y], prefix) =>
    `${prefix}${(offsetX + (x - minX) * scale).toFixed(2)} ${(offsetY + (maxY - y) * scale).toFixed(2)}`
  const tolerance = Math.max(width, height) * 0.002
  const d = projected
    .map((ring) => {
      const reduced = simplify(ring, tolerance)
      return `${command(reduced[0], 'M')}${reduced
        .slice(1)
        .map((point) => command(point, 'L'))
        .join('')}Z`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${label}"><path fill="#47c8bd" stroke="#0e706c" stroke-width="1.4" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill-rule="evenodd" d="${d}"/></svg>\n`
}

function createSharedProjection(
  geometries,
  { x = 8, y = 8, width: viewportWidth = 84, height: viewportHeight = 84 } = {},
) {
  const geographicPoints = geometries.flatMap((geometry) =>
    rings(geometry).flat(2),
  )
  const latitudes = geographicPoints.map((point) => point[1])
  const minLatitude = latitudes.reduce(
    (value, item) => Math.min(value, item),
    Infinity,
  )
  const maxLatitude = latitudes.reduce(
    (value, item) => Math.max(value, item),
    -Infinity,
  )
  const longitudeScale = Math.cos(
    (((minLatitude + maxLatitude) / 2) * Math.PI) / 180,
  )
  const projectedPoints = geographicPoints.map(([x, y]) => [
    x * longitudeScale,
    y,
  ])
  const minX = projectedPoints.reduce(
    (value, point) => Math.min(value, point[0]),
    Infinity,
  )
  const maxX = projectedPoints.reduce(
    (value, point) => Math.max(value, point[0]),
    -Infinity,
  )
  const minY = projectedPoints.reduce(
    (value, point) => Math.min(value, point[1]),
    Infinity,
  )
  const maxY = projectedPoints.reduce(
    (value, point) => Math.max(value, point[1]),
    -Infinity,
  )
  const width = maxX - minX
  const height = maxY - minY
  const scale = Math.min(viewportWidth / width, viewportHeight / height)
  const offsetX = x + (viewportWidth - width * scale) / 2
  const offsetY = y + (viewportHeight - height * scale) / 2
  const mapPoint = ([longitude, latitude]) => [
    offsetX + (longitude * longitudeScale - minX) * scale,
    offsetY + (maxY - latitude) * scale,
  ]
  const maximumSpan = Math.max(width, height)
  const pathFor = (
    geometry,
    simplificationRatio = 0.0015,
    { maxPointsPerRing = Infinity, minimumBoundsArea = 0 } = {},
  ) =>
    rings(geometry)
      .flat()
      .map((ring) => {
        let reduced = simplify(
          ring.map(([x, y]) => [x * longitudeScale, y]),
          maximumSpan * simplificationRatio,
        )
        if (reduced.length - 1 > maxPointsPerRing) {
          const open = reduced.slice(0, -1)
          const sampled = Array.from(
            { length: maxPointsPerRing },
            (_, index) =>
              open[Math.floor((index * open.length) / maxPointsPerRing)],
          )
          reduced = [...sampled, sampled[0]]
        }
        const mapped = reduced.map(([x, y]) => [
          offsetX + (x - minX) * scale,
          offsetY + (maxY - y) * scale,
        ])
        if (minimumBoundsArea) {
          const xs = mapped.map(([x]) => x)
          const ys = mapped.map(([, y]) => y)
          const boundsArea =
            (Math.max(...xs) - Math.min(...xs)) *
            (Math.max(...ys) - Math.min(...ys))
          if (boundsArea < minimumBoundsArea) return ''
        }
        return `M${mapped.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}Z`
      })
      .filter(Boolean)
      .join('')
  const boundsFor = (geometry) => {
    const points = rings(geometry).flat(2).map(mapPoint)
    return {
      minX: points.reduce(
        (value, point) => Math.min(value, point[0]),
        Infinity,
      ),
      maxX: points.reduce(
        (value, point) => Math.max(value, point[0]),
        -Infinity,
      ),
      minY: points.reduce(
        (value, point) => Math.min(value, point[1]),
        Infinity,
      ),
      maxY: points.reduce(
        (value, point) => Math.max(value, point[1]),
        -Infinity,
      ),
    }
  }
  return { pathFor, boundsFor, longitudeScale }
}

function createPlanarPathProjection(
  geometries,
  { x = 0, y = 0, width: viewportWidth = 100, height: viewportHeight = 100 },
) {
  const points = geometries.flatMap((geometry) => rings(geometry).flat(2))
  const xs = points.map(([pointX]) => pointX)
  const ys = points.map(([, pointY]) => pointY)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = maxX - minX
  const height = maxY - minY
  const scale = Math.min(viewportWidth / width, viewportHeight / height)
  const offsetX = x + (viewportWidth - width * scale) / 2
  const offsetY = y + (viewportHeight - height * scale) / 2

  return (geometry) =>
    rings(geometry)
      .flat()
      .map((ring) => {
        const projected = ring.map(([pointX, pointY]) => [
          offsetX + (pointX - minX) * scale,
          offsetY + (pointY - minY) * scale,
        ])
        // The atlas is already merged by prefecture. Reduce only sub-pixel
        // detail after fitting it to the viewBox, without capping ring points.
        const reduced = simplify(projected, 0.02)
        return `M${reduced
          .map(
            ([pointX, pointY]) => `${pointX.toFixed(2)} ${pointY.toFixed(2)}`,
          )
          .join('L')}Z`
      })
      .join('')
}

function largestPolygon(geometry) {
  if (geometry.type === 'Polygon') return geometry
  const areaOf = (polygon) =>
    Math.abs(
      polygon[0].reduce((sum, point, index, ring) => {
        const previous = ring[(index + ring.length - 1) % ring.length]
        return sum + previous[0] * point[1] - point[0] * previous[1]
      }, 0),
    )
  const coordinates = geometry.coordinates.reduce((largest, polygon) =>
    areaOf(polygon) > areaOf(largest) ? polygon : largest,
  )
  return { type: 'Polygon', coordinates }
}

async function downloadZip(url) {
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`Download failed (${response.status}): ${url}`)
  return new Uint8Array(await response.arrayBuffer())
}

const [standardRegionsCsv, adminsArchive, lakesArchive, japanAtlasSource] =
  await Promise.all([
    readFile(standardRegionsFile, 'utf8'),
    downloadZip(ADMINS_URL),
    downloadZip(LAKES_URL),
    readFile(japanAtlasFile, 'utf8'),
  ])
const japanAtlas = JSON.parse(japanAtlasSource)
const largeLakes = parseLargeLakes(lakesArchive).map((lake) => ({
  ...lake,
  bounds: geometryBounds(lake.geometry),
}))
console.log(
  `Cutting out ${largeLakes.length} lakes (${largeLakes.map((lake) => lake.name).join(', ')})`,
)
const standardRegionByCode = new Map()
for (const line of standardRegionsCsv.trim().split(/\r?\n/).slice(1)) {
  const fields = parseCsvLine(line)
  standardRegionByCode.set(fields[0], {
    code: fields[0],
    prefectureName: fields[1],
    upperName: fields[2],
    upperKana: fields[3],
    municipalityName: fields[4],
    municipalityKana: fields[5],
  })
}

const files = unzipSync(adminsArchive)
const grouped = new Map()
for (const [filename, bytes] of Object.entries(files)) {
  const match = filename.match(/\/docs\/(\d{2})\/(\d{5})\.json$/)
  if (!match) continue
  const [, prefectureCode, sourceCode] = match
  const geojson = JSON.parse(strFromU8(bytes))
  const sourceRegion = standardRegionByCode.get(sourceCode)
  const parentCode =
    legacyDesignatedCityParentByCode.get(sourceCode) ??
    (sourceRegion ? designatedCities.get(sourceRegion.upperName) : undefined)
  if (!sourceRegion && !parentCode) continue
  const code = parentCode ?? sourceCode
  const region = parentCode
    ? standardRegionByCode.get(parentCode)
    : sourceRegion
  if (!region) continue
  const item = grouped.get(code) ?? {
    code,
    prefectureCode,
    sources: [],
    geometries: [],
    region,
    boundaryDistrictName: districtFromBoundaryName(
      geojson.features[0]?.properties?.name ?? '',
      sourceRegion ?? region,
    ),
  }
  item.sources.push(sourceCode)
  item.geometries.push(...geojson.features.map((feature) => feature.geometry))
  grouped.set(code, item)
}

const records = []
const recordByCode = new Map()
const prefectureRecordByCode = new Map()
const prefectureItems = new Map()
await rm(outputDirectory, { recursive: true, force: true })
await rm(prefectureOutputDirectory, { recursive: true, force: true })
await rm(mapOutputDirectory, { recursive: true, force: true })
await mkdir(outputDirectory, { recursive: true })
await mkdir(prefectureOutputDirectory, { recursive: true })
await mkdir(mapOutputDirectory, { recursive: true })
for (const item of [...grouped.values()].sort((a, b) =>
  a.code.localeCompare(b.code),
)) {
  const name = item.region.municipalityName || item.region.upperName
  const kana = item.region.municipalityKana || item.region.upperKana
  const prefectureKana = prefectureKanaByName.get(item.region.prefectureName)
  if (!name || !kana || !prefectureKana) {
    throw new Error(`Incomplete e-Stat metadata for municipality ${item.code}`)
  }
  const hasDistrict = item.region.upperName.endsWith('郡')
  const districtName = hasDistrict
    ? item.region.upperName
    : item.boundaryDistrictName
  const geometry = subtractLakes(mergeGeometries(item.geometries), largeLakes)
  const items = prefectureItems.get(item.prefectureCode) ?? []
  items.push({ item, geometry, name })
  prefectureItems.set(item.prefectureCode, items)
  const record = {
    code: item.code,
    prefectureCode: item.prefectureCode,
    name,
    kana,
    districtName,
    placementTransform: '',
  }
  prefectureRecordByCode.set(item.prefectureCode, {
    code: item.prefectureCode,
    name: item.region.prefectureName,
    kana: prefectureKana,
  })
  records.push(record)
  recordByCode.set(item.code, record)
}

const insetPrefectureCodes = new Set(['13', '46', '47'])
// 久米島町 includes the remote Iōtorishima, which pulls its overall center
// into the Okinawa-main-area bounds even though Kume Island itself is west of it.
const mainAreaExclusions = new Set(['47361'])

function geographicCenter(geometry) {
  const points = rings(geometry).flat(2)
  const bounds = points.reduce(
    (result, [longitude, latitude]) => ({
      minLongitude: Math.min(result.minLongitude, longitude),
      maxLongitude: Math.max(result.maxLongitude, longitude),
      minLatitude: Math.min(result.minLatitude, latitude),
      maxLatitude: Math.max(result.maxLatitude, latitude),
    }),
    {
      minLongitude: Infinity,
      maxLongitude: -Infinity,
      minLatitude: Infinity,
      maxLatitude: -Infinity,
    },
  )
  return {
    longitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
    latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
  }
}

function belongsToMainArea(prefectureCode, municipalityCode, geometry) {
  if (mainAreaExclusions.has(municipalityCode)) return false
  const { longitude, latitude } = geographicCenter(geometry)
  if (prefectureCode === '13') return latitude >= 35.3
  if (prefectureCode === '46') return latitude >= 30.8
  if (prefectureCode === '47')
    return (
      longitude >= 127 &&
      longitude <= 128.5 &&
      latitude >= 25.75 &&
      latitude <= 27.4
    )
  return true
}

const atlasPrefectures = topojsonFeature(
  japanAtlas,
  japanAtlas.objects.prefectures,
)
if (
  atlasPrefectures.type !== 'FeatureCollection' ||
  atlasPrefectures.features.length !== 47
)
  throw new Error('jpn-atlas must contain 47 prefectures')
const nationalPrefectureFeatures = atlasPrefectures.features.map((feature) => ({
  ...feature,
  // Remote Tokyo islands make the nationwide overview too small to read.
  // Municipality detail data remains untouched.
  geometry:
    feature.id === '13' ? largestPolygon(feature.geometry) : feature.geometry,
}))
const nationalPathFor = createPlanarPathProjection(
  nationalPrefectureFeatures.map(({ geometry }) => geometry),
  {
    x: 3,
    y: 3,
    width: 94,
    height: 94,
  },
)
const nationalPrefecturePaths = nationalPrefectureFeatures
  .map(({ id, geometry }) => ({
    code: String(id).padStart(2, '0'),
    path: nationalPathFor(geometry),
  }))
  .sort((first, second) => first.code.localeCompare(second.code))
const municipalityPathsByPrefecture = {}

for (const [prefectureCode, items] of prefectureItems) {
  const usesInset = insetPrefectureCodes.has(prefectureCode)
  const fullProjection = createSharedProjection(
    items.map(({ geometry }) => geometry),
    usesInset ? { x: 72, y: 12, width: 24, height: 76 } : undefined,
  )
  const mainlandItems = usesInset
    ? items.filter(({ item, geometry }) =>
        belongsToMainArea(prefectureCode, item.code, geometry),
      )
    : items
  const mainlandProjection = usesInset
    ? createSharedProjection(
        mainlandItems.map(({ geometry }) => geometry),
        { x: 4, y: 8, width: 62, height: 84 },
      )
    : fullProjection
  const mainPath = mainlandItems
    .map(({ geometry }) => mainlandProjection.pathFor(geometry))
    .join('')
  const fullPath = usesInset
    ? items.map(({ geometry }) => fullProjection.pathFor(geometry)).join('')
    : ''
  const insetDecoration = usesInset
    ? '<path fill="none" stroke="#56615e" stroke-width="0.55" d="M69 8V92"/>'
    : ''
  municipalityPathsByPrefecture[prefectureCode] = items
    .map(({ item, geometry }) => {
      const inMainArea = belongsToMainArea(prefectureCode, item.code, geometry)
      const mainPath =
        !usesInset || inMainArea
          ? mainlandProjection.pathFor(geometry, 0.006, {
              maxPointsPerRing: 60,
            })
          : ''
      const insetPath = usesInset
        ? fullProjection.pathFor(geometry, 0.006, {
            maxPointsPerRing: 60,
          })
        : ''
      return { code: item.code, path: `${mainPath}${insetPath}` }
    })
    .sort((first, second) => first.code.localeCompare(second.code))
  await writeFile(
    path.join(prefectureOutputDirectory, `${prefectureCode}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#34413e" fill-rule="evenodd" d="${mainPath}"/><path fill="#34413e" fill-rule="evenodd" d="${fullPath}"/>${insetDecoration}</svg>\n`,
  )
  for (const { item, geometry } of items) {
    const projection =
      usesInset && !belongsToMainArea(prefectureCode, item.code, geometry)
        ? fullProjection
        : mainlandProjection
    await writeFile(
      path.join(outputDirectory, `${item.code}.svg`),
      toSvg(
        geometry,
        recordByCode.get(item.code).name,
        projection.longitudeScale,
      ),
    )
    const bounds = projection.boundsFor(geometry)
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    const scale = Math.max(width, height) / 84
    const translateX = (bounds.minX + bounds.maxX) / 2 - 50 * scale
    const translateY = (bounds.minY + bounds.maxY) / 2 - 50 * scale
    recordByCode.get(item.code).placementTransform =
      `translate(${translateX.toFixed(3)}%, ${translateY.toFixed(3)}%) scale(${scale.toFixed(5)})`
  }
}
const prefectureRecords = [...prefectureRecordByCode.values()].sort((a, b) =>
  a.code.localeCompare(b.code),
)
const generated = `// Generated by scripts/build-national-dataset.mjs. Do not edit.\nimport type { GeneratedMunicipalityRecord, PrefectureRecord } from './municipalities'\nexport const generatedPrefectures: PrefectureRecord[] = ${JSON.stringify(prefectureRecords)}\nexport const generatedMunicipalities: GeneratedMunicipalityRecord[] = ${JSON.stringify(records)}\n`
await writeFile(dataFile, generated)
const generatedNationalMap = `// Generated by scripts/build-national-dataset.mjs. Do not edit.
export interface GeneratedMapPath {
  code: string
  path: string
}

export const nationalPrefecturePaths: GeneratedMapPath[] = ${JSON.stringify(nationalPrefecturePaths)}
`
await writeFile(nationalMapDataFile, generatedNationalMap)
for (const [prefectureCode, mapPaths] of Object.entries(
  municipalityPathsByPrefecture,
))
  await writeFile(
    path.join(mapOutputDirectory, `${prefectureCode}.json`),
    `${JSON.stringify(mapPaths)}\n`,
  )
await mkdir(path.resolve('generated'), { recursive: true })
await writeFile(
  path.resolve('generated/national-dataset-metadata.json'),
  `${JSON.stringify(
    {
      datasetVersion: '2026-06.v1',
      generatedAt: new Date().toISOString(),
      municipalityCount: records.length,
      sources: [
        {
          file: path.relative(process.cwd(), standardRegionsFile),
          provider: 'e-Stat',
          sha256: createHash('sha256').update(standardRegionsCsv).digest('hex'),
        },
        {
          url: ADMINS_URL,
          sha256: createHash('sha256').update(adminsArchive).digest('hex'),
        },
        {
          url: LAKES_URL,
          sha256: createHash('sha256').update(lakesArchive).digest('hex'),
          minimumAreaKm2: LARGE_LAKE_MINIMUM_AREA_KM2,
          simplificationToleranceDegrees: LAKE_SIMPLIFICATION_TOLERANCE,
          includedLakes: largeLakes.map(({ name, areaKm2 }) => ({
            name,
            areaKm2: Number(areaKm2.toFixed(2)),
          })),
        },
        {
          package: 'jpn-atlas',
          version: japanAtlasPackage.version,
          file: path.relative(process.cwd(), japanAtlasFile),
          usage: 'nationwide-prefecture-map',
          sha256: createHash('sha256').update(japanAtlasSource).digest('hex'),
        },
      ],
    },
    null,
    2,
  )}\n`,
)
console.log(`Generated ${records.length} municipalities and SVG assets.`)
