import { Hono } from 'hono'
import { healthRoute } from './routes/health'
import { gameSessionsRoute } from './routes/game-sessions'

export function createApp() {
  const app = new Hono<{ Bindings: CloudflareBindings }>()

  app.route('/api/health', healthRoute)
  app.route('/api/game-sessions', gameSessionsRoute)

  app.notFound((context) =>
    context.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'The requested API endpoint was not found.',
        },
      },
      404,
    ),
  )

  app.onError((error, context) => {
    console.error(error)
    return context.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred.',
        },
      },
      500,
    )
  })

  return app
}

export default createApp()
