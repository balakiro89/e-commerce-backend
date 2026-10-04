/**
 * Upload Worker secrets from .dev.vars (excludes wrangler `vars` and Hyperdrive local keys).
 * Usage: node scripts/sync-worker-secrets.mjs
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const devVarsPath = join(root, '.dev.vars')

/** Keys defined in wrangler.jsonc `vars` or local-only — not Worker secrets. */
const SKIP_KEYS = new Set([
  'R2_PUBLIC_URL',
  'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE',
])

if (!existsSync(devVarsPath)) {
  console.error('Missing .dev.vars — copy .dev.vars.example and fill secrets first.')
  process.exit(1)
}

const secrets = {}
for (const line of readFileSync(devVarsPath, 'utf8').split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq <= 0) continue
  const key = trimmed.slice(0, eq).trim()
  const value = trimmed.slice(eq + 1).trim()
  if (SKIP_KEYS.has(key) || !value) continue
  secrets[key] = value
}

if (!secrets.DATABASE_URL || !secrets.JWT_SECRET) {
  console.error('`.dev.vars` must include DATABASE_URL and JWT_SECRET.')
  process.exit(1)
}

const tmpPath = join(tmpdir(), `wrangler-secrets-${Date.now()}.json`)
writeFileSync(tmpPath, JSON.stringify(secrets, null, 2), 'utf8')

try {
  const result = spawnSync('npx', ['wrangler', 'secret', 'bulk', tmpPath], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })
  process.exit(result.status ?? 1)
} finally {
  try {
    unlinkSync(tmpPath)
  } catch {
    /* ignore */
  }
}
