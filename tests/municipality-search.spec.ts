import { describe, expect, it } from 'vitest'
import {
  searchMunicipalities,
  type MunicipalitySearchMode,
} from '../src/shared/data/municipality-search'

function resultCodes(query: string, mode: MunicipalitySearchMode = 'all') {
  return searchMunicipalities(query, mode).map(
    (result) => result.municipality.code,
  )
}

describe('municipality search', () => {
  it('partially matches municipality names in kanji and normalized kana', () => {
    expect(resultCodes('川崎')).toContain('14130')
    expect(resultCodes('かわさき')).toContain('14130')
    expect(resultCodes('カワサキ')).toContain('14130')
    expect(resultCodes('kawasaki')).toContain('14130')
  })

  it('matches normalized area codes', () => {
    const result = searchMunicipalities('０８５７', 'phone').find(
      ({ municipality }) => municipality.code === '31201',
    )
    expect(result?.matchedAreaCodes).toContain('0857')
  })

  it('matches three-digit and full postal codes by postal prefix', () => {
    expect(resultCodes('680', 'postal')).toContain('31201')
    expect(resultCodes('〒680-8571', 'postal')).toContain('31201')
  })

  it('matches normalized five-digit municipality codes', () => {
    expect(resultCodes('31201', 'code')).toEqual(['31201'])
    expect(resultCodes('３１２０１', 'code')).toEqual(['31201'])
    expect(resultCodes('31201')).toContain('31201')
  })

  it('limits each number type to its selected search mode', () => {
    expect(resultCodes('川崎', 'postal')).toEqual([])
    expect(resultCodes('0857', 'postal')).not.toContain('31201')
    expect(resultCodes('680', 'phone')).not.toContain('31201')
    expect(resultCodes('31201', 'postal')).not.toContain('31201')
    expect(resultCodes('0857', 'code')).toEqual([])
  })

  it('uses only the longest phone prefix for a longer number', () => {
    const results = searchMunicipalities('01547-2-0000', 'phone')
    expect(results).not.toHaveLength(0)
    expect(results.flatMap((result) => result.matchedAreaCodes)).toEqual([
      '01547',
    ])
  })

  it('uses a full known representative phone before its area code', () => {
    const results = searchMunicipalities('0857-22-8111', 'phone')
    expect(results).toHaveLength(1)
    expect(results[0].municipality.code).toBe('31201')
    expect(results[0].matchedAreaCodes).toEqual([])
    expect(results[0].matchedPhoneNumbers).toEqual(['0857-22-8111'])
  })

  it('does not treat a full phone number as a postal code in all mode', () => {
    const results = searchMunicipalities('0857-22-8111')
    expect(results).toHaveLength(1)
    expect(results[0].municipality.code).toBe('31201')
    expect(results[0].matchedPostalCodePrefixes).toEqual([])
  })

  it('normalizes parenthesized and international phone numbers', () => {
    expect(resultCodes('(0857) 22-8111', 'phone')).toEqual(['31201'])
    expect(resultCodes('+81 857 22 8111', 'phone')).toEqual(['31201'])
  })

  it('returns no results for an empty query', () => {
    expect(searchMunicipalities('   ')).toEqual([])
  })
})
