import fs from 'node:fs'
import path from 'node:path'

const assignmentPattern = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/

export function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const values = {}
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

  for (const line of lines) {
    const match = line.match(assignmentPattern)
    if (!match) {
      continue
    }

    values[match[1]] = parseEnvValue(match[2])
  }

  return values
}

export function updateEnvFile(filePath, updates) {
  const dir = path.dirname(filePath)
  if (dir && dir !== '.') {
    fs.mkdirSync(dir, { recursive: true })
  }

  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, 'utf8')
    : ''
  const hasFinalNewline = existing === '' || existing.endsWith('\n')
  const lines = existing === '' ? [] : existing.split(/\r?\n/)
  if (hasFinalNewline && lines.at(-1) === '') {
    lines.pop()
  }

  const pending = new Map(Object.entries(updates))

  const nextLines = lines.map((line) => {
    const match = line.match(assignmentPattern)
    if (!match || !pending.has(match[1])) {
      return line
    }

    const value = pending.get(match[1])
    pending.delete(match[1])
    return `${match[1]}=${formatEnvValue(value)}`
  })

  for (const [key, value] of pending) {
    nextLines.push(`${key}=${formatEnvValue(value)}`)
  }

  fs.writeFileSync(filePath, `${nextLines.join('\n')}\n`, { mode: 0o600 })
  fs.chmodSync(filePath, 0o600)
}

function parseEnvValue(rawValue) {
  const value = rawValue.trim()

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    if (value.startsWith('"')) {
      try {
        return JSON.parse(value)
      } catch {
        return value.slice(1, -1)
      }
    }

    return value.slice(1, -1)
  }

  const hashIndex = value.indexOf('#')
  return hashIndex === -1 ? value : value.slice(0, hashIndex).trimEnd()
}

function formatEnvValue(value) {
  const text = String(value)
  if (/^[A-Za-z0-9_@%+=:,./~-]*$/.test(text)) {
    return text
  }

  return JSON.stringify(text)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , command, filePath, ...args] = process.argv

  if (command === 'get') {
    const [key] = args
    process.stdout.write(readEnvFile(filePath)[key] ?? '')
  } else {
    process.stderr.write(
      'Usage: node scripts/lib/env-file.mjs get <env-file> <key>\n'
    )
    process.exit(1)
  }
}
