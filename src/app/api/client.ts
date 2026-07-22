import * as v from 'valibot'
import {
  healthResponseSchema,
  type HealthResponse,
} from '../../shared/schemas/health'
import type { ApiErrorBody } from '../../shared/types/api'
import {
  gameSessionResponseSchema,
  questionBatchResponseSchema,
} from '../../shared/schemas/game'
import type {
  GameConfig,
  GameSessionResponse,
  QuestionBatchResponse,
} from '../../shared/types/game'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(
    status: number,
    code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function replenishQuestions(
  sessionId: string,
  gameType: GameConfig['gameType'],
  municipalityFilter: GameConfig['municipalityFilter'],
  prefectureCode: string | null,
  cursor: number,
): Promise<QuestionBatchResponse> {
  const response = await fetch(`/api/game-sessions/${sessionId}/questions`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameType,
      municipalityFilter,
      prefectureCode,
      cursor,
    }),
  })
  const body = await readJson(response)
  if (!response.ok)
    throw new ApiError(
      response.status,
      'QUESTION_FETCH_FAILED',
      '次の問題を取得できませんでした。',
    )
  const parsed = v.safeParse(questionBatchResponseSchema, body)
  if (!parsed.success)
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      '問題データが正しくありません。',
    )
  return parsed.output
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch (cause) {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'APIから不正な応答を受け取りました。',
      {
        cause,
      },
    )
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== 'object' || !('error' in value)) return false
  const error = value.error
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  )
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  let response: Response
  try {
    response = await fetch('/api/health', {
      signal,
      headers: { Accept: 'application/json' },
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError')
      throw cause
    throw new ApiError(0, 'NETWORK_ERROR', 'APIへ接続できませんでした。', {
      cause,
    })
  }

  const body = await readJson(response)
  if (!response.ok) {
    if (isApiErrorBody(body))
      throw new ApiError(response.status, body.error.code, body.error.message)
    throw new ApiError(
      response.status,
      'HTTP_ERROR',
      `APIリクエストに失敗しました (${response.status})。`,
    )
  }

  const parsed = v.safeParse(healthResponseSchema, body)
  if (!parsed.success) {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'APIの応答形式が正しくありません。',
    )
  }
  return parsed.output
}

export async function createGameSession(
  config: GameConfig,
  signal?: AbortSignal,
): Promise<GameSessionResponse> {
  let response: Response
  try {
    response = await fetch('/api/game-sessions', {
      method: 'POST',
      signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError')
      throw cause
    throw new ApiError(0, 'NETWORK_ERROR', 'ゲームを開始できませんでした。', {
      cause,
    })
  }

  const body = await readJson(response)
  if (!response.ok) {
    if (isApiErrorBody(body))
      throw new ApiError(response.status, body.error.code, body.error.message)
    throw new ApiError(
      response.status,
      'HTTP_ERROR',
      `ゲームを開始できませんでした (${response.status})。`,
    )
  }
  const parsed = v.safeParse(gameSessionResponseSchema, body)
  if (!parsed.success)
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      '問題データが正しくありません。',
    )
  return parsed.output
}
