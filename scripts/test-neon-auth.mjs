import { loadDevVars } from './load-dev-vars.mjs'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, or } from 'drizzle-orm'
import * as schema from '../src/db/schema/index.ts'
import { users } from '../src/db/schema/users.ts'
import { verifyPassword } from '../src/utils/password.ts'
import { signAccessToken } from '../src/utils/token.ts'

loadDevVars()

const sql = neon(process.env.DATABASE_URL)
const db = drizzle(sql, { schema })
const identifier = 'seller@bkenterprises.com'
const user = await db.query.users.findFirst({
  where: or(eq(users.email, identifier), eq(users.mobile, identifier)),
})
if (!user) {
  console.error('No user')
  process.exit(1)
}
const valid = await verifyPassword('Seller@12345', user.passwordHash)
console.log('password ok:', valid)
const token = await signAccessToken(
  { sub: user.id, role: user.role },
  process.env.JWT_SECRET,
  15,
)
console.log('token length:', token.length)
