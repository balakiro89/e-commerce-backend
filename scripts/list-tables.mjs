import { readFileSync } from 'node:fs'
import postgres from 'postgres'
import { loadDevVars } from './load-dev-vars.mjs'

loadDevVars()
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL missing')
  process.exit(1)
}
const host = url.match(/@([^/]+)/)?.[1] ?? '?'
const sql = postgres(url, { max: 1 })
const rows = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`
console.log('Host:', host)
console.log('Tables:', rows.length)
for (const row of rows) console.log(' -', row.table_name)
await sql.end()
