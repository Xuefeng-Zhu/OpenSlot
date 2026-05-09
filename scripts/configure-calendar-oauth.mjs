#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { repoRoot } from './lib/oauth-script-utils.mjs'

const args = process.argv.slice(2)
const runGoogle = args.includes('--google') || !args.includes('--microsoft')
const runMicrosoft = args.includes('--microsoft') || !args.includes('--google')
const passThroughArgs = args.filter(
  (arg) => arg !== '--google' && arg !== '--microsoft'
)

for (const script of [
  runGoogle ? 'configure-google-calendar-oauth.mjs' : null,
  runMicrosoft ? 'configure-microsoft-calendar-oauth.mjs' : null,
].filter(Boolean)) {
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, 'scripts', script), ...passThroughArgs],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    }
  )

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
