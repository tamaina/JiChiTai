import { toHiragana, toRomaji } from 'wanakana'
import {
  municipalities,
  prefectures,
  type MunicipalityRecord,
} from '../data/municipalities'
import type { GameType } from '../types/game'

export function normalizeRomanInput(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[‐-‒–—―ー・.\s_-]/g, '')
}

export function romanToComparableKana(value: string): string {
  return toHiragana(normalizeRomanInput(value), { IMEMode: true })
    .replace(/n$/, 'ん')
    .replace(/ん{2,}/g, 'ん')
}

export function kanaToImeKeystrokes(value: string): string {
  return toRomaji(value).replace(/n'/g, 'nn').replace(/n$/, 'nn')
}

export function canonicalAnswer(
  record: MunicipalityRecord,
  gameType: GameType,
): string {
  if (isPrefectureAnswerGame(gameType))
    return kanaToImeKeystrokes(record.prefecture.kana)
  return kanaToImeKeystrokes(`${record.prefecture.kana}${record.kana}`)
}

export function acceptedAnswers(
  record: MunicipalityRecord,
  gameType: GameType,
): string[] {
  if (isPrefectureAnswerGame(gameType)) return [record.prefecture.kana]
  return [`${record.prefecture.kana}${record.kana}`]
}

export function isCorrectAnswer(
  record: MunicipalityRecord,
  gameType: GameType,
  value: string,
): boolean {
  return acceptedAnswers(record, gameType).includes(
    romanToComparableKana(value),
  )
}

export function isValidPlaceAnswer(gameType: GameType, value: string): boolean {
  const kana = romanToComparableKana(value)
  if (isPrefectureAnswerGame(gameType)) {
    return prefectures.some((prefecture) => prefecture.kana === kana)
  }
  return municipalities.some((record) =>
    acceptedAnswers(record, gameType).includes(kana),
  )
}

export function isPrefectureAnswerGame(gameType: GameType): boolean {
  return gameType === 'prefecture-from-municipality'
}
