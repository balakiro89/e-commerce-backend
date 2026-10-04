import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { Env } from '../types/env'
import { AppError } from '../utils/response'
import * as schema from './schema'

export function createDb(env: Env) {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL
  if (!connectionString) {
    throw new AppError(
      'Database connection is not configured on the Worker (set DATABASE_URL secret)',
      'INTERNAL_ERROR',
      503,
    )
  }

  // Hyperdrive (or explicit local TCP) uses postgres-js; Workers + Neon use HTTP (fetch).
  if (env.HYPERDRIVE?.connectionString) {
    const client = postgres(connectionString, { prepare: false, max: 5 })
    return drizzlePostgres(client, { schema })
  }

  const sql = neon(connectionString)
  return drizzleNeon(sql, { schema })
}

export type Db = ReturnType<typeof createDb>
