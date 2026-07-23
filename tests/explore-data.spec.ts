import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { nationalPrefecturePaths } from '../src/shared/data/generated-national-map'
import { generatedPostalPrefixes } from '../src/shared/data/generated-postal-prefixes'
import {
  municipalities,
  municipalityByCode,
  prefectures,
} from '../src/shared/data/municipalities'

describe('explorer data', () => {
  it('provides postal prefixes for every Japan Post municipality', () => {
    expect(generatedPostalPrefixes).toHaveLength(1741)
    expect(new Set(generatedPostalPrefixes.map((item) => item.code)).size).toBe(
      generatedPostalPrefixes.length,
    )
    for (const record of generatedPostalPrefixes) {
      expect(municipalityByCode.has(record.code)).toBe(true)
      expect(record.prefixes.length).toBeGreaterThan(0)
      expect(record.prefixes.every((prefix) => /^\d{2}$/.test(prefix))).toBe(
        true,
      )
    }

    expect(municipalityByCode.get('10202')?.postalCodePrefixes).toContain('37')
    expect(municipalityByCode.get('01100')?.postalCodePrefixes).toEqual(
      expect.arrayContaining(['00', '06']),
    )
    expect(
      municipalities.find((item) => item.name === '色丹村')?.postalCodePrefixes,
    ).toEqual([])
  })

  it('has one nationwide path per prefecture', () => {
    expect(nationalPrefecturePaths).toHaveLength(prefectures.length)
    expect(new Set(nationalPrefecturePaths.map((item) => item.code)).size).toBe(
      47,
    )
    expect(nationalPrefecturePaths.every((item) => item.path.length > 0)).toBe(
      true,
    )
  })

  it('has one clickable detail path per municipality', async () => {
    const mapDirectory = path.resolve('public/generated/maps')
    const files = (await readdir(mapDirectory)).sort()
    expect(files).toHaveLength(47)
    const paths = (
      await Promise.all(
        files.map(async (file) => {
          const source = await readFile(path.join(mapDirectory, file), 'utf8')
          return JSON.parse(source) as Array<{ code: string; path: string }>
        }),
      )
    ).flat()
    expect(paths).toHaveLength(municipalities.length)
    expect(new Set(paths.map((item) => item.code)).size).toBe(
      municipalities.length,
    )
    expect(paths.every((item) => item.path.length > 0)).toBe(true)
  })
})
