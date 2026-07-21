import { Hono } from 'hono'

export const healthRoute = new Hono()

healthRoute.get('/', (context) =>
  context.json({
    status: 'ok' as const,
    service: 'municipality-typing-game' as const,
    timestamp: new Date().toISOString(),
  }),
)
