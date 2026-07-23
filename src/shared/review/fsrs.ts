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
  if (mode === 'area-code-from-municipality')
    return record.primaryAreaCode !== null
  return true
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
  limit = 20,
) {
  const storedById = new Map(storedCards.map((card) => [card.id, card]))
  const eligible = records.filter((record) => isEligibleForReview(record, mode))
  const due = eligible
    .filter((record) => {
      const stored = storedById.get(reviewCardId(mode, record.code))
      return stored && new Date(stored.card.due) <= now
    })
    .sort((left, right) => {
      const leftDue = storedById.get(reviewCardId(mode, left.code))?.card.due
      const rightDue = storedById.get(reviewCardId(mode, right.code))?.card.due
      return (leftDue ?? '').localeCompare(rightDue ?? '')
    })
  const unseen = eligible.filter(
    (record) => !storedById.has(reviewCardId(mode, record.code)),
  )
  return [...due, ...unseen].slice(0, limit)
}

export function reviewModeStats(
  records: MunicipalityRecord[],
  storedCards: StoredReviewCard[],
  mode: ReviewMode,
  now = new Date(),
) {
  const eligibleCodes = new Set(
    records
      .filter((record) => isEligibleForReview(record, mode))
      .map((record) => record.code),
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
