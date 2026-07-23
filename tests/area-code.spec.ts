import { describe, expect, it } from 'vitest'
import { municipalities } from '../src/shared/data/municipalities'
import {
  isCorrectAreaCode,
  municipalityChoices,
  normalizeAreaCodeInput,
} from '../src/shared/game/area-code'

describe('area-code data and quiz helpers', () => {
  it('loads representative area codes for every municipality with a J-LIS entry', () => {
    const covered = municipalities.filter(
      (municipality) => municipality.primaryAreaCode,
    )
    expect(covered).toHaveLength(1741)
    for (const municipality of covered) {
      expect(municipality.areaCodes).toContain(municipality.primaryAreaCode)
      expect(municipality.representativePhone).toMatch(
        new RegExp(`^${municipality.primaryAreaCode}-`),
      )
    }
  })

  it('keeps the Takasaki main area code and the Shinmachi exception', () => {
    const takasaki = municipalities.find((item) => item.code === '10202')!
    expect(takasaki.primaryAreaCode).toBe('027')
    expect(takasaki.areaCodes).toEqual(['027', '0274'])
  })

  it('normalizes formatted numeric input', () => {
    expect(normalizeAreaCodeInput(' ０２７－')).toBe('027')
    const takasaki = municipalities.find((item) => item.code === '10202')!
    expect(isCorrectAreaCode(takasaki, '0274')).toBe(true)
  })

  it('does not offer another municipality with the same area code as a distractor', () => {
    const takasaki = municipalities.find((item) => item.code === '10202')!
    const choices = municipalityChoices(
      takasaki,
      '027',
      municipalities,
      municipalities,
      () => 0.5,
    )
    expect(choices).toHaveLength(4)
    expect(choices).toContain(takasaki)
    expect(
      choices
        .filter((choice) => choice.code !== takasaki.code)
        .every((choice) => !choice.areaCodes.includes('027')),
    ).toBe(true)
  })
})
