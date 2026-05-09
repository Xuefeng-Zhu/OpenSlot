import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

import { readEnvFile, updateEnvFile } from './env-file.mjs'

const currentFile = fileURLToPath(import.meta.url)

export const repoRoot = path.resolve(path.dirname(currentFile), '..', '..')

export function envPathFromArgs(args) {
  const envIndex = args.indexOf('--env-file')
  if (envIndex !== -1) {
    const filePath = args[envIndex + 1]
    if (!filePath) {
      throw new Error('--env-file requires a path')
    }
    return path.resolve(repoRoot, filePath)
  }

  return path.join(repoRoot, process.env.ENV_FILE ?? '.env.local')
}

export function readOpenSlotEnv(envFile) {
  if (!fs.existsSync(envFile)) {
    const exampleFile = path.join(repoRoot, '.env.example')
    if (fs.existsSync(exampleFile)) {
      fs.copyFileSync(exampleFile, envFile)
      fs.chmodSync(envFile, 0o600)
      console.log(`Created ${relativePath(envFile)} from .env.example.`)
    }
  }

  return readEnvFile(envFile)
}

export function writeOpenSlotEnv(envFile, updates) {
  updateEnvFile(envFile, updates)
  console.log(`Updated ${relativePath(envFile)}: ${Object.keys(updates).join(', ')}`)
}

export function appUrlFromEnv(env) {
  return trimTrailingSlash(
    process.env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  )
}

export function providerRedirectUri(appUrl, provider) {
  return `${trimTrailingSlash(appUrl)}/api/calendar/oauth/${provider}/callback`
}

export function originFromUrl(value) {
  return new URL(value).origin
}

export function commandExists(command) {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    stdio: 'ignore',
  })

  return result.status === 0
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })

  if (result.status !== 0) {
    const detail = options.capture ? result.stderr.trim() : ''
    throw new Error(
      `${command} ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`
    )
  }

  return result.stdout
}

export function parseJsonCommand(command, args) {
  const stdout = runCommand(command, args, { capture: true })
  try {
    return JSON.parse(stdout)
  } catch (error) {
    throw new Error(
      `${command} returned non-JSON output: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function promptText(question, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : ''
  const answer = await questionVisible(`${question}${suffix}: `)
  return answer.trim() || defaultValue || ''
}

export async function promptSecret(question) {
  return questionHidden(`${question}: `)
}

export function relativePath(filePath) {
  return path.relative(repoRoot, filePath) || '.'
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function questionVisible(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

function questionHidden(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })

  const originalWrite = rl._writeToOutput
  rl._writeToOutput = function writeMuted(output) {
    if (rl.stdoutMuted) {
      if (output.includes('\n') || output.includes('\r')) {
        rl.output.write(output)
      }
      return
    }

    originalWrite.call(rl, output)
  }

  return new Promise((resolve) => {
    rl.stdoutMuted = true
    rl.question(query, (answer) => {
      rl.stdoutMuted = false
      rl.close()
      process.stdout.write('\n')
      resolve(answer.trim())
    })
  })
}
