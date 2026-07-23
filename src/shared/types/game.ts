export type GameType =
  | 'prefecture-from-municipality'
  | 'prefecture-from-emblem'
  | 'municipality-from-shape'
  | 'municipality-typing'
export type RuleMode = 'timed' | 'practice'
export type MunicipalityFilter = 'all' | 'population-top-1000' | 'cities-only'

export interface GameConfig {
  gameType: GameType
  ruleMode: RuleMode
  municipalityFilter: MunicipalityFilter
  prefectureCode: string | null
}

export interface QuestionPayload {
  questionId: string
  municipalityCode: string
  prefectureCode: string
  municipalityDisplayName?: string
  shapeUrl: string
  emblemUrl?: string
}

export interface GameSessionResponse {
  sessionId: string
  datasetVersion: string
  durationMs: number
  totalQuestions: number
  questions: QuestionPayload[]
  nextCursor: number | null
}

export interface QuestionBatchResponse {
  questions: QuestionPayload[]
  nextCursor: number | null
}

export type AnswerResult = 'correct' | 'incorrect' | 'revealed' | 'timeout'

export interface AnswerHistoryItem {
  questionId: string
  municipalityCode: string
  prefectureCode: string
  shapeUrl: string
  municipalityName: string
  prefectureName: string
  districtName: string
  placeReading: string
  primaryAreaCode: string | null
  areaCodes: string[]
  emblem: {
    imageUrl: string
    sourceUrl: string
    author: string
    licenseName: string
    licenseUrl: string | null
  } | null
  expectedCanonical: string
  enteredRaw: string | null
  enteredNormalized: string | null
  result: AnswerResult
  elapsedMs: number
  answeredAt: string
}
