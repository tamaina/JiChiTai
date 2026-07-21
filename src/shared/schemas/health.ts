import * as v from 'valibot'

export const healthResponseSchema = v.object({
  status: v.literal('ok'),
  service: v.literal('municipality-typing-game'),
  timestamp: v.pipe(v.string(), v.isoTimestamp()),
})

export type HealthResponse = v.InferOutput<typeof healthResponseSchema>
