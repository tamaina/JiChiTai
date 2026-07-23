import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { generatedEmblems } from '../src/shared/data/generated-emblems'
import { municipalityByCode } from '../src/shared/data/municipalities'

describe('municipality emblem data', () => {
  it('contains only unique known municipalities with attribution', () => {
    expect(generatedEmblems.length).toBeGreaterThan(100)
    expect(new Set(generatedEmblems.map((item) => item.code)).size).toBe(
      generatedEmblems.length,
    )
    for (const emblem of generatedEmblems) {
      expect(municipalityByCode.has(emblem.code)).toBe(true)
      expect(emblem.imageUrl).toMatch(
        new RegExp(`^/generated/emblems/${emblem.code}\\.`),
      )
      expect(emblem.sourceUrl).toMatch(
        /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
      )
      expect(emblem.author).not.toBe('')
      expect(emblem.licenseName).toMatch(/^(Public domain|CC0|CC BY(?:-SA)?)/)
      expect(existsSync(path.resolve('public', emblem.imageUrl.slice(1)))).toBe(
        true,
      )
    }
  })

  it('excludes municipalities without verified emblem metadata', () => {
    const withoutEmblem = [...municipalityByCode.values()].find(
      (item) => item.emblem === null,
    )
    expect(withoutEmblem).toBeDefined()
  })
})
