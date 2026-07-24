import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  type Card,
  type CardInput,
  type Grade,
} from 'ts-fsrs'
import type { MunicipalityRecord } from '../data/municipalities'

export const reviewModes = [
  {
    id: 'prefecture-from-municipality',
    name: '自治体名 → 都道府県',
    description: '市区町村名から都道府県を思い出す',
  },
  {
    id: 'municipality-from-shape',
    name: '輪郭 → 自治体',
    description: '自治体の形から名前を思い出す',
  },
  {
    id: 'prefecture-from-emblem',
    name: '市区町村章 → 自治体',
    description: '章から自治体名と都道府県を思い出す',
  },
  {
    id: 'area-code-from-municipality',
    name: '自治体名 → 市外局番',
    description: '自治体から代表の市外局番を思い出す',
  },
  {
    id: 'municipality-from-area-code',
    name: '市外局番 → 自治体',
    description: '市外局番を使う自治体のひとつを思い出す',
  },
] as const

export type ReviewMode = (typeof reviewModes)[number]['id']

export interface SerializedFsrsCard {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: State
  last_review?: string
}

export interface ReviewHistoryEntry {
  rating: Grade
  reviewedAt: string
  scheduledDays: number
  state: State
}

export interface StoredReviewCard {
  id: string
  mode: ReviewMode
  municipalityCode: string
  card: SerializedFsrsCard
  history: ReviewHistoryEntry[]
  updatedAt: string
}

export const ratingOptions = [
  { rating: Rating.Again, label: '忘れた' },
  { rating: Rating.Hard, label: '難しい' },
  { rating: Rating.Good, label: '普通' },
  { rating: Rating.Easy, label: '簡単' },
] as const

const scheduler = fsrs()

export const reviewCardId = (mode: ReviewMode, municipalityCode: string) =>
  `${mode}:${municipalityCode}`

export function isEligibleForReview(
  record: MunicipalityRecord,
  mode: ReviewMode,
) {
  if (mode === 'prefecture-from-emblem') return record.emblem !== null
  if (
    mode === 'area-code-from-municipality' ||
    mode === 'municipality-from-area-code'
  )
    return record.primaryAreaCode !== null
  return true
}

export function eligibleReviewMunicipalities(
  records: MunicipalityRecord[],
  mode: ReviewMode,
) {
  const eligible = records.filter((record) => isEligibleForReview(record, mode))
  if (mode !== 'municipality-from-area-code') return eligible

  const seenAreaCodes = new Set<string>()
  return eligible.filter((record) => {
    const areaCode = record.primaryAreaCode
    if (!areaCode || seenAreaCodes.has(areaCode)) return false
    seenAreaCodes.add(areaCode)
    return true
  })
}

export function serializeCard(card: Card): SerializedFsrsCard {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString(),
  }
}

export function deserializeCard(card: SerializedFsrsCard): CardInput {
  return {
    ...card,
    due: card.due,
    last_review: card.last_review,
  }
}

export function emptySerializedCard(now = new Date()) {
  return serializeCard(createEmptyCard(now))
}

export function scheduleReview(
  previous: StoredReviewCard | undefined,
  mode: ReviewMode,
  municipalityCode: string,
  rating: Grade,
  now = new Date(),
): StoredReviewCard {
  const current = previous
    ? deserializeCard(previous.card)
    : createEmptyCard(now)
  const result = scheduler.next(current, now, rating)
  const reviewedAt = now.toISOString()
  return {
    id: reviewCardId(mode, municipalityCode),
    mode,
    municipalityCode,
    card: serializeCard(result.card),
    history: [
      ...(previous?.history ?? []),
      {
        rating,
        reviewedAt,
        scheduledDays: result.log.scheduled_days,
        state: result.log.state,
      },
    ],
    updatedAt: reviewedAt,
  }
}

export function schedulingPreview(
  previous: StoredReviewCard | undefined,
  now = new Date(),
) {
  const current = previous
    ? deserializeCard(previous.card)
    : createEmptyCard(now)
  return scheduler.repeat(current, now)
}

export function selectReviewMunicipalities(
  records: MunicipalityRecord[],
  storedCards: StoredReviewCard[],
  mode: ReviewMode,
  now = new Date(),
  limit: number | null = 20,
  random = Math.random,
) {
  const storedById = new Map(storedCards.map((card) => [card.id, card]))
  const eligible = eligibleReviewMunicipalities(records, mode)
  const due = shuffled(
    eligible.filter((record) => {
      const stored = storedById.get(reviewCardId(mode, record.code))
      return stored && new Date(stored.card.due) <= now
    }),
    random,
  )
  const unseen = shuffled(
    eligible.filter(
      (record) => !storedById.has(reviewCardId(mode, record.code)),
    ),
    random,
  )
  const selected = [...due, ...unseen]
  return limit === null ? selected : selected.slice(0, limit)
}

export function shuffled<T>(items: T[], random = Math.random) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export function reviewModeStats(
  records: MunicipalityRecord[],
  storedCards: StoredReviewCard[],
  mode: ReviewMode,
  now = new Date(),
) {
  const eligibleCodes = new Set(
    eligibleReviewMunicipalities(records, mode).map((record) => record.code),
  )
  const relevant = storedCards.filter(
    (card) => card.mode === mode && eligibleCodes.has(card.municipalityCode),
  )
  return {
    total: eligibleCodes.size,
    learned: relevant.length,
    due: relevant.filter((card) => new Date(card.card.due) <= now).length,
  }
}

export function isReviewMode(value: unknown): value is ReviewMode {
  return reviewModes.some((mode) => mode.id === value)
}
