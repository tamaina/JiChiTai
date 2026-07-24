import * as v from 'valibot'

export const gameTypeSchema = v.picklist([
  'prefecture-from-municipality',
  'municipality-from-emblem',
  'municipality-from-shape',
  'municipality-typing',
])
export const ruleModeSchema = v.picklist(['timed', 'practice'])
export const municipalityFilterSchema = v.picklist([
  'all',
  'population-top-1000',
  'cities-only',
])
const prefectureCodeSchema = v.pipe(
  v.string(),
  v.regex(/^(0[1-9]|[1-3][0-9]|4[0-7])$/),
)

const compatibleFilterSchema = v.check(
  (input: { gameType: string; prefectureCode?: string | null }) =>
    !input.prefectureCode || input.gameType !== 'prefecture-from-municipality',
)

export const createGameSessionSchema = v.pipe(
  v.object({
    gameType: gameTypeSchema,
    ruleMode: ruleModeSchema,
    municipalityFilter: v.optional(municipalityFilterSchema, 'all'),
    prefectureCode: v.optional(v.nullable(prefectureCodeSchema), null),
  }),
  compatibleFilterSchema,
)

export const questionSchema = v.object({
  questionId: v.string(),
  municipalityCode: v.string(),
  prefectureCode: v.string(),
  municipalityDisplayName: v.optional(v.string()),
  shapeUrl: v.string(),
  emblemUrl: v.optional(v.string()),
})

export const gameSessionResponseSchema = v.object({
  sessionId: v.string(),
  datasetVersion: v.string(),
  durationMs: v.number(),
  totalQuestions: v.number(),
  questions: v.array(questionSchema),
  nextCursor: v.nullable(v.number()),
})

export const questionBatchResponseSchema = v.object({
  questions: v.array(questionSchema),
  nextCursor: v.nullable(v.number()),
})

export const replenishQuestionsSchema = v.pipe(
  v.object({
    gameType: gameTypeSchema,
    cursor: v.number(),
    municipalityFilter: v.optional(municipalityFilterSchema, 'all'),
    prefectureCode: v.optional(v.nullable(prefectureCodeSchema), null),
  }),
  compatibleFilterSchema,
)
