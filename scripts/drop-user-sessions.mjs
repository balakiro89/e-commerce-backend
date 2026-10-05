import { loadDevVars } from './load-dev-vars.mjs'
import postgres from 'postgres'

loadDevVars()
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 })

try {
  await sql`DROP TABLE IF EXISTS "user_sessions"`
  console.log('Dropped user_sessions (if it existed).')
} finally {
  await sql.end()
}
