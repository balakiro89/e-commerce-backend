import { loadDevVars } from './load-dev-vars.mjs'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../src/db/schema/index.ts'

loadDevVars()
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 })
const db = drizzle(sql, { schema })

try {
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, 'seller@bkenterprises.com'),
  })
  console.log('user found:', user?.email ?? 'none')
} catch (e) {
  console.error('query failed:', e)
}
await sql.end()
