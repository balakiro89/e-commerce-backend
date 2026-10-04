import type { Context } from 'hono'
import { AppError, failure } from '../utils/response'

export function handleError(error: unknown, c: Context) {
  if (error instanceof AppError) {
    return failure(c, error.message, error.code, error.status)
  }
  console.error(error)
  return failure(c, 'Internal server error', 'INTERNAL_ERROR', 500)
}

/** @deprecated Prefer `handleError` via `app.onError` — sub-apps do not bubble to parent try/catch middleware. */
export async function errorMiddleware(c: Context, next: () => Promise<void>) {
  try {
    await next()
  } catch (err) {
    return handleError(err as Error, c)
  }
}
