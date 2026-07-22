import { describe, expect, it, vi } from 'vitest'
import { createApp } from './app'

describe('Worker API', () => {
  it('returns a JSON health response', async () => {
    const response = await createApp().request('/api/health')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toMatchObject({
      status: 'ok',
      service: 'municipality-typing-game',
    })
  })

  it('returns a JSON 404 for an unknown API path', async () => {
    const response = await createApp().request('/api/not-found')
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API endpoint was not found.',
      },
    })
  })

  it('creates a session containing unique questions', async () => {
    const response = await createApp().request('/api/game-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameType: 'municipality-from-shape',
        ruleMode: 'practice',
      }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      questions: Array<{
        municipalityCode: string
        municipalityDisplayName?: string
      }>
    }
    expect(body.questions).toHaveLength(10)
    expect(
      new Set(body.questions.map((item) => item.municipalityCode)).size,
    ).toBe(10)
    expect(
      body.questions.every(
        (item) => item.municipalityDisplayName === undefined,
      ),
    ).toBe(true)
  })

  it('rejects an invalid game configuration', async () => {
    const response = await createApp().request('/api/game-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType: 'unknown', ruleMode: 'timed' }),
    })
    expect(response.status).toBe(400)
  })

  it('includes the municipality name in typing mode', async () => {
    const response = await createApp().request('/api/game-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameType: 'municipality-typing',
        ruleMode: 'practice',
      }),
    })
    const body = (await response.json()) as {
      questions: Array<{ municipalityDisplayName?: string }>
    }
    expect(response.status).toBe(200)
    expect(
      body.questions.every((question) => question.municipalityDisplayName),
    ).toBe(true)
  })

  it('filters questions to cities', async () => {
    const response = await createApp().request('/api/game-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameType: 'prefecture-from-municipality',
        ruleMode: 'practice',
        municipalityFilter: 'cities-only',
      }),
    })
    const body = (await response.json()) as {
      questions: Array<{ municipalityDisplayName: string }>
    }
    expect(response.status).toBe(200)
    expect(
      body.questions.every((question) =>
        question.municipalityDisplayName.endsWith('市'),
      ),
    ).toBe(true)
  })

  it('filters questions to the population top 1000', async () => {
    const response = await createApp().request('/api/game-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameType: 'prefecture-from-municipality',
        ruleMode: 'practice',
        municipalityFilter: 'population-top-1000',
      }),
    })
    const body = (await response.json()) as { totalQuestions: number }
    expect(response.status).toBe(200)
    expect(body.totalQuestions).toBe(1000)
  })

  it('filters questions to a prefecture', async () => {
    const response = await createApp().request('/api/game-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameType: 'municipality-typing',
        ruleMode: 'practice',
        prefectureCode: '10',
      }),
    })
    const body = (await response.json()) as {
      questions: Array<{ prefectureCode: string }>
    }
    expect(response.status).toBe(200)
    expect(
      body.questions.every((question) => question.prefectureCode === '10'),
    ).toBe(true)
  })

  it('rejects prefecture-answer mode with a prefecture filter', async () => {
    const response = await createApp().request('/api/game-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameType: 'prefecture-from-municipality',
        ruleMode: 'practice',
        prefectureCode: '10',
      }),
    })
    expect(response.status).toBe(400)
  })

  it('replenishes without repeating the initial questions', async () => {
    const app = createApp()
    const firstResponse = await app.request('/api/game-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameType: 'prefecture-from-municipality',
        ruleMode: 'timed',
      }),
    })
    const first = (await firstResponse.json()) as {
      sessionId: string
      nextCursor: number
      questions: Array<{ municipalityCode: string; shapeUrl: string }>
    }
    const nextResponse = await app.request(
      `/api/game-sessions/${first.sessionId}/questions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameType: 'prefecture-from-municipality',
          cursor: first.nextCursor,
        }),
      },
    )
    expect(nextResponse.status).toBe(200)
    const next = (await nextResponse.json()) as {
      questions: Array<{ municipalityCode: string; shapeUrl: string }>
    }
    const codes = [...first.questions, ...next.questions].map(
      (question) => question.municipalityCode,
    )
    expect(new Set(codes).size).toBe(20)
    expect(next.questions[0].shapeUrl).toMatch(
      /^\/generated\/geometry\/\d{5}\.svg$/,
    )
  })

  it('converts exceptions to a JSON 500 response', async () => {
    const app = createApp()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    app.get('/api/test-error', () => {
      throw new Error('test')
    })
    const response = await app.request('/api/test-error')
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    })
    vi.restoreAllMocks()
  })
})
