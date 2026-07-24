import { Rating, State } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { municipalities } from '../src/shared/data/municipalities'
import {
  reviewCardId,
  reviewModeStats,
  scheduleReview,
  selectReviewMunicipalities,
} from '../src/shared/review/fsrs'
import {
  createReviewExport,
  parseReviewExport,
} from '../src/app/storage/review-storage'

const now = new Date('2026-07-24T12:00:00.000Z')

describe('FSRS review scheduling', () => {
  it('stores independent cards for each question mode', () => {
    const municipality = municipalities[0]
    const nameCard = scheduleReview(
      undefined,
      'prefecture-from-municipality',
      municipality.code,
      Rating.Good,
      now,
    )
    const shapeCard = scheduleReview(
      undefined,
      'municipality-from-shape',
      municipality.code,
      Rating.Hard,
      now,
    )

    expect(nameCard.id).toBe(
      reviewCardId('prefecture-from-municipality', municipality.code),
    )
    expect(shapeCard.id).not.toBe(nameCard.id)
    expect(nameCard.history).toHaveLength(1)
    expect(nameCard.card.reps).toBe(1)
  })

  it('prioritizes due cards before unseen cards and skips future cards', () => {
    const first = municipalities[0]
    const second = municipalities[1]
    const future = scheduleReview(
      undefined,
      'prefecture-from-municipality',
      first.code,
      Rating.Good,
      now,
    )
    const due = {
      ...scheduleReview(
        undefined,
        'prefecture-from-municipality',
        second.code,
        Rating.Again,
        now,
      ),
      card: {
        ...scheduleReview(
          undefined,
          'prefecture-from-municipality',
          second.code,
          Rating.Again,
          now,
        ).card,
        due: '2026-07-24T11:59:00.000Z',
      },
    }

    const selected = selectReviewMunicipalities(
      municipalities,
      [future, due],
      'prefecture-from-municipality',
      now,
      3,
      () => 0,
    )
    expect(selected[0].code).toBe(second.code)
    expect(selected.map((record) => record.code)).not.toContain(first.code)
  })

  it('shuffles unseen cards before limiting a normal session', () => {
    const selected = selectReviewMunicipalities(
      municipalities,
      [],
      'prefecture-from-municipality',
      now,
      20,
      () => 0,
    )
    expect(selected).toHaveLength(20)
    expect(selected.map((record) => record.code)).not.toEqual(
      municipalities.slice(0, 20).map((record) => record.code),
    )
  })

  it('returns every eligible card when the session has no limit', () => {
    const selected = selectReviewMunicipalities(
      municipalities,
      [],
      'prefecture-from-municipality',
      now,
      null,
      () => 0,
    )
    expect(selected).toHaveLength(1747)
    expect(new Set(selected.map((record) => record.code)).size).toBe(1747)
  })

  it('supports area-code-to-municipality cards independently', () => {
    const eligibleCount = new Set(
      municipalities
        .map((record) => record.primaryAreaCode)
        .filter((areaCode) => areaCode !== null),
    ).size
    const selected = selectReviewMunicipalities(
      municipalities,
      [],
      'municipality-from-area-code',
      now,
      null,
      () => 0,
    )
    const record = selected[0]
    const stored = scheduleReview(
      undefined,
      'municipality-from-area-code',
      record.code,
      Rating.Good,
      now,
    )

    expect(selected).toHaveLength(eligibleCount)
    expect(new Set(selected.map((record) => record.primaryAreaCode)).size).toBe(
      eligibleCount,
    )
    expect(record.primaryAreaCode).toBeTruthy()
    expect(stored.id).toBe(
      reviewCardId('municipality-from-area-code', record.code),
    )
  })

  it('counts only cards belonging to the selected mode', () => {
    const municipality = municipalities[0]
    const stored = scheduleReview(
      undefined,
      'municipality-from-shape',
      municipality.code,
      Rating.Easy,
      now,
    )
    const stats = reviewModeStats(
      municipalities,
      [stored],
      'prefecture-from-municipality',
      now,
    )
    expect(stats.learned).toBe(0)
    expect(stats.total).toBe(1747)
  })
})

describe('FSRS history export', () => {
  it('round-trips a versioned JSON export', () => {
    const card = scheduleReview(
      undefined,
      'municipality-from-shape',
      municipalities[0].code,
      Rating.Good,
      now,
    )
    const exported = createReviewExport([card], now)
    expect(parseReviewExport(JSON.parse(JSON.stringify(exported)))).toEqual(
      exported,
    )
  })

  it('rejects malformed or incompatible data', () => {
    expect(() => parseReviewExport({ version: 2, cards: [] })).toThrow(
      '対応していない学習履歴です。',
    )
    expect(() =>
      parseReviewExport({
        format: 'jichitai-fsrs-history',
        version: 1,
        exportedAt: now.toISOString(),
        cards: [
          {
            id: 'wrong',
            mode: 'municipality-from-shape',
            municipalityCode: municipalities[0].code,
            card: { state: State.New },
            history: [],
            updatedAt: now.toISOString(),
          },
        ],
      }),
    ).toThrow('対応していない学習履歴です。')
  })
})
