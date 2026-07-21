import { describe, expect, it } from 'vitest'
import {
  municipalities,
  municipalityShapeUrl,
  prefectureShapeUrl,
} from '../src/shared/data/municipalities'
import {
  canonicalAnswer,
  isCorrectAnswer,
  isValidPlaceAnswer,
  normalizeRomanInput,
  romanToComparableKana,
} from '../src/shared/game/roman'

const fujioka = municipalities.find((item) => item.code === '10209')!

describe('roman input', () => {
  it('keeps district names for every Hokkaido town and village', () => {
    const hokkaidoTownsAndVillages = municipalities.filter(
      (item) => item.prefectureCode === '01' && /(?:町|村)$/.test(item.name),
    )
    expect(hokkaidoTownsAndVillages.length).toBeGreaterThan(0)
    expect(
      hokkaidoTownsAndVillages.filter((item) => !item.districtName),
    ).toEqual([])
  })

  it('derives static SVG URLs from municipality codes', () => {
    for (const municipality of municipalities) {
      expect(municipalityShapeUrl(municipality.code)).toBe(
        `/generated/geometry/${municipality.code}.svg`,
      )
      expect(prefectureShapeUrl(municipality.prefectureCode)).toBe(
        `/generated/prefectures/${municipality.prefectureCode}.svg`,
      )
      expect(municipality.placementTransform).toMatch(
        /^translate\(.+%, .+%\) scale\(.+\)$/,
      )
    }
  })

  it('normalizes width, case, spaces and punctuation', () => {
    expect(normalizeRomanInput(' ＧＵＮＭＡ－ＫＥＮ ')).toBe('gunmaken')
  })

  it('accepts supported romanization variants', () => {
    expect(
      isCorrectAnswer(fujioka, 'prefecture-from-municipality', 'GUNMA KEN'),
    ).toBe(true)
    expect(
      isCorrectAnswer(fujioka, 'municipality-from-shape', 'gunmaken-huziokasi'),
    ).toBe(true)
  })

  it('accepts every n/nn combination for syllabic n', () => {
    expect(
      isCorrectAnswer(fujioka, 'prefecture-from-municipality', 'gunmakenn'),
    ).toBe(true)
    expect(
      isCorrectAnswer(
        fujioka,
        'municipality-from-shape',
        'gunmakennfujiokashi',
      ),
    ).toBe(true)
    expect(
      isValidPlaceAnswer('prefecture-from-municipality', 'gunmakenn'),
    ).toBe(true)
    expect(
      isCorrectAnswer(fujioka, 'prefecture-from-municipality', 'gunnmakenn'),
    ).toBe(true)

    const shinto = municipalities.find((item) => item.code === '10344')!
    expect(
      isCorrectAnswer(
        shinto,
        'municipality-from-shape',
        'gunnmakennshinntoumura',
      ),
    ).toBe(true)
  })

  it('does not duplicate n used by na-ni-nu-ne-no', () => {
    expect(romanToComparableKana('kanagawaken')).toBe('かながわけん')
    expect(romanToComparableKana('kannagawaken')).toBe('かんあがわけん')
    expect(
      isValidPlaceAnswer('prefecture-from-municipality', 'kannagawakenn'),
    ).toBe(false)
  })

  it('uses WanaKana for Hepburn and keyboard-style variants', () => {
    expect(romanToComparableKana('shinzyukuku')).toBe('しんじゅくく')
    expect(romanToComparableKana('sintoumura')).toBe('しんとうむら')
    expect(romanToComparableKana('hatioujisi')).toBe('はちおうじし')
  })

  it('uses common IME keystrokes for syllabic n before a vowel', () => {
    const eiheiji = municipalities.find((item) => item.code === '18322')!
    expect(canonicalAnswer(eiheiji, 'municipality-from-shape')).toBe(
      'fukuikenneiheijichou',
    )
    expect(
      isCorrectAnswer(
        eiheiji,
        'municipality-from-shape',
        'fukuikenneiheijichou',
      ),
    ).toBe(true)
    expect(
      isCorrectAnswer(
        eiheiji,
        'municipality-from-shape',
        "fukuiken'eiheijichou",
      ),
    ).toBe(true)
    expect(canonicalAnswer(fujioka, 'prefecture-from-municipality')).toBe(
      'gunmakenn',
    )
  })

  it('distinguishes valid wrong places from arbitrary text', () => {
    expect(
      isValidPlaceAnswer('prefecture-from-municipality', 'toukyouto'),
    ).toBe(true)
    expect(isValidPlaceAnswer('prefecture-from-municipality', 'tokyoto')).toBe(
      false,
    )
    expect(isValidPlaceAnswer('prefecture-from-municipality', 'foobar')).toBe(
      false,
    )
  })

  it('builds canonical answers with required suffixes', () => {
    expect(canonicalAnswer(fujioka, 'municipality-from-shape')).toBe(
      'gunmakenfujiokashi',
    )
    expect(canonicalAnswer(fujioka, 'municipality-typing')).toBe(
      'gunmakenfujiokashi',
    )
    expect(
      isCorrectAnswer(fujioka, 'municipality-typing', 'gunmakenfujiokashi'),
    ).toBe(true)
  })

  it('uses kana spelling, not English-style long-vowel omission', () => {
    const tokyo = municipalities.find((item) => item.prefectureCode === '13')!
    const hokkaido = municipalities.find(
      (item) => item.prefectureCode === '01',
    )!
    expect(canonicalAnswer(tokyo, 'prefecture-from-municipality')).toBe(
      'toukyouto',
    )
    expect(canonicalAnswer(hokkaido, 'prefecture-from-municipality')).toBe(
      'hokkaidou',
    )
  })
})
