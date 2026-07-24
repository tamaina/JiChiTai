import { describe, expect, it } from 'vitest'
import { searchMunicipalities } from '../src/shared/data/municipality-search'

function resultCodes(query: string) {
  return searchMunicipalities(query).map((result) => result.municipality.code)
}

describe('municipality search', () => {
  it('partially matches municipality names in kanji and normalized kana', () => {
    expect(resultCodes('川崎')).toContain('14130')
    expect(resultCodes('かわさき')).toContain('14130')
    expect(resultCodes('カワサキ')).toContain('14130')
    expect(resultCodes('kawasaki')).toContain('14130')
  })

  it('matches normalized area codes', () => {
    const result = searchMunicipalities('０８５７').find(
      ({ municipality }) => municipality.code === '31201',
    )
    expect(result?.matchedAreaCodes).toContain('0857')
  })

  it('matches three-digit and full postal codes by postal prefix', () => {
    expect(resultCodes('680')).toContain('31201')
    expect(resultCodes('〒680-8571')).toContain('31201')
  })

  it('returns no results for an empty query', () => {
    expect(searchMunicipalities('   ')).toEqual([])
  })
})
