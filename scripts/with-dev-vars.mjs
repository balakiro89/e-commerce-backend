import { spawnSync } from 'node:child_process'
import { loadDevVars } from './load-dev-vars.mjs'

loadDevVars()

const [command, ...args] = process.argv.slice(2)
if (!command) {
  console.error('Usage: node scripts/with-dev-vars.mjs <command> [args...]')
  process.exit(1)
}

const result = spawnSync(command, args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

process.exit(result.status ?? 1)
