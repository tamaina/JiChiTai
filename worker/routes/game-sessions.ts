import { Hono } from 'hono'
import * as v from 'valibot'
import {
  municipalities,
  municipalityShapeUrl,
} from '../../src/shared/data/municipalities'
import {
  createGameSessionSchema,
  replenishQuestionsSchema,
} from '../../src/shared/schemas/game'

export const gameSessionsRoute = new Hono()

function shuffled<T>(items: readonly T[], seedText: string): T[] {
  const result = [...items]
  let state = [...seedText].reduce(
    (value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619),
    2166136261,
  )
  const random = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = random() % (index + 1)
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

function filteredMunicipalities(
  citiesOnly: boolean,
  prefectureCode: string | null,
) {
  return municipalities.filter(
    (record) =>
      (!citiesOnly || record.name.endsWith('市')) &&
      (!prefectureCode || record.prefectureCode === prefectureCode),
  )
}

function questionBatch(
  sessionId: string,
  gameType: string,
  citiesOnly: boolean,
  prefectureCode: string | null,
  cursor: number,
) {
  const batch = shuffled(
    filteredMunicipalities(citiesOnly, prefectureCode),
    sessionId,
  ).slice(cursor, cursor + 10)
  return batch.map((record) => ({
    questionId: `${sessionId}-${record.code}`,
    municipalityCode: record.code,
    prefectureCode: record.prefectureCode,
    ...(gameType === 'municipality-from-shape'
      ? {}
      : { municipalityDisplayName: record.name }),
    shapeUrl: municipalityShapeUrl(record.code),
  }))
}

gameSessionsRoute.post('/', async (context) => {
  let body: unknown
  try {
    body = await context.req.json()
  } catch {
    return context.json(
      {
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON.',
        },
      },
      400,
    )
  }

  const parsed = v.safeParse(createGameSessionSchema, body)
  if (!parsed.success) {
    return context.json(
      {
        error: {
          code: 'INVALID_GAME_CONFIG',
          message: 'The game configuration is invalid.',
        },
      },
      400,
    )
  }

  const sessionId = crypto.randomUUID()
  const questions = questionBatch(
    sessionId,
    parsed.output.gameType,
    parsed.output.citiesOnly,
    parsed.output.prefectureCode,
    0,
  )
  const municipalityCount = filteredMunicipalities(
    parsed.output.citiesOnly,
    parsed.output.prefectureCode,
  ).length

  return context.json({
    sessionId,
    datasetVersion: '2026-06.v1',
    durationMs: 120_000,
    totalQuestions: municipalityCount,
    questions,
    nextCursor: questions.length < municipalityCount ? questions.length : null,
  })
})

gameSessionsRoute.post('/:sessionId/questions', async (context) => {
  const parsed = v.safeParse(
    replenishQuestionsSchema,
    await context.req.json().catch(() => null),
  )
  if (!parsed.success)
    return context.json(
      {
        error: {
          code: 'INVALID_CURSOR',
          message: 'The question cursor is invalid.',
        },
      },
      400,
    )
  const questions = questionBatch(
    context.req.param('sessionId'),
    parsed.output.gameType,
    parsed.output.citiesOnly,
    parsed.output.prefectureCode,
    parsed.output.cursor,
  )
  const next = parsed.output.cursor + questions.length
  const municipalityCount = filteredMunicipalities(
    parsed.output.citiesOnly,
    parsed.output.prefectureCode,
  ).length
  return context.json({
    questions,
    nextCursor: next < municipalityCount ? next : null,
  })
})
