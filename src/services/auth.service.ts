import { and, eq, gt, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { passwordResetTokens, users } from '../db/schema'
import type { Env } from '../types/env'
import { mapUser } from '../utils/mappers'
import { hashPassword, hashToken, verifyPassword } from '../utils/password'
import { AppError } from '../utils/response'
import { createResetToken, signAccessToken } from '../utils/token'

function accessTtlMinutes(env: Env): number {
  return Number(env.ACCESS_TOKEN_TTL_MINUTES ?? 15)
}

async function issueAccessToken(
  env: Env,
  userId: string,
  role: typeof users.$inferSelect.role,
): Promise<string> {
  return signAccessToken({ sub: userId, role }, env.JWT_SECRET, accessTtlMinutes(env))
}

export async function registerUser(
  db: Db,
  input: { username: string; email: string; mobile: string; password: string },
) {
  const email = input.email.toLowerCase()
  const existingEmail = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existingEmail) throw new AppError('Email is already registered', 'EMAIL_EXISTS', 409)

  const existingUsername = await db.query.users.findFirst({
    where: eq(users.username, input.username.trim()),
  })
  if (existingUsername) {
    throw new AppError('Username is already taken', 'USERNAME_EXISTS', 409)
  }

  const existingMobile = await db.query.users.findFirst({ where: eq(users.mobile, input.mobile) })
  if (existingMobile) {
    throw new AppError('Mobile number is already registered', 'MOBILE_EXISTS', 409)
  }

  const passwordHash = await hashPassword(input.password)
  const [created] = await db
    .insert(users)
    .values({
      username: input.username.trim(),
      email,
      mobile: input.mobile,
      passwordHash,
      role: 'customer',
    })
    .returning()

  return { user: mapUser(created) }
}

export async function loginUser(
  db: Db,
  env: Env,
  input: { email_or_mobile: string; password: string },
) {
  const trimmed = input.email_or_mobile.trim()
  const byEmail = await db.query.users.findFirst({
    where: eq(users.email, trimmed.toLowerCase()),
  })
  const user =
    byEmail ??
    (await db.query.users.findFirst({
      where: eq(users.mobile, trimmed),
    }))
  if (!user) throw new AppError('Invalid credentials', 'INVALID_CREDENTIALS', 401)

  const valid = await verifyPassword(input.password, user.passwordHash)
  if (!valid) throw new AppError('Invalid credentials', 'INVALID_CREDENTIALS', 401)

  const access_token = await issueAccessToken(env, user.id, user.role)
  return { user: mapUser(user), access_token }
}

export async function requestPasswordReset(db: Db, email: string) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) })
  if (!user) return { accepted: true as const, resetToken: null as string | null }

  const resetToken = createResetToken()
  const tokenHash = await hashToken(resetToken)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  })

  return { accepted: true as const, resetToken }
}

export async function resetPasswordWithToken(db: Db, token: string, password: string) {
  const tokenHash = await hashToken(token)
  const record = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.tokenHash, tokenHash),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, new Date()),
    ),
  })
  if (!record) throw new AppError('Invalid or expired reset token', 'INVALID_RESET_TOKEN', 400)

  const passwordHash = await hashPassword(password)
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, record.userId))
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, record.id))
}

export async function legacyResetPassword(db: Db, email: string, password: string) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) })
  if (!user) throw new AppError('Account not found', 'USER_NOT_FOUND', 404)
  const passwordHash = await hashPassword(password)
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id))
}

export async function checkEmailExists(db: Db, email: string) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) })
  return { exists: Boolean(user) }
}

export async function updateProfile(
  db: Db,
  userId: string,
  input: { username?: string; email?: string; mobile?: string },
) {
  if (input.email) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, input.email.toLowerCase()),
    })
    if (existing && existing.id !== userId) {
      throw new AppError('Email is already registered', 'EMAIL_EXISTS', 409)
    }
  }

  const [updated] = await db
    .update(users)
    .set({
      username: input.username,
      email: input.email?.toLowerCase(),
      mobile: input.mobile,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning()

  return mapUser(updated)
}
