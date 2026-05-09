#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

import {
  appUrlFromEnv,
  commandExists,
  envPathFromArgs,
  originFromUrl,
  promptSecret,
  promptText,
  providerRedirectUri,
  readOpenSlotEnv,
  runCommand,
  writeOpenSlotEnv,
} from './lib/oauth-script-utils.mjs'

const GOOGLE_AUTH_CLIENTS_URL =
  'https://console.cloud.google.com/auth/clients/create'
const DEFAULT_PROJECT_ID = 'openslot-495708'

async function main() {
  const envFile = envPathFromArgs(process.argv.slice(2))
  const env = readOpenSlotEnv(envFile)
  const appUrl = appUrlFromEnv(env)
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
    providerRedirectUri(appUrl, 'google')
  const javascriptOrigin =
    process.env.GOOGLE_CALENDAR_JS_ORIGIN || originFromUrl(appUrl)

  let projectId =
    process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || ''

  if (!projectId && commandExists('gcloud')) {
    const result = spawnSync(
      'gcloud',
      ['config', 'get-value', 'project', '--quiet'],
      { encoding: 'utf8' }
    )
    projectId = result.stdout.trim()
  }

  projectId = await promptText(
    'Google Cloud project ID',
    projectId || DEFAULT_PROJECT_ID
  )

  if (!projectId) {
    throw new Error('Google Cloud project ID is required.')
  }

  if (commandExists('gcloud')) {
    console.log('Enabling Google Calendar API if needed...')
    runCommand('gcloud', [
      'services',
      'enable',
      'calendar-json.googleapis.com',
      '--project',
      projectId,
      '--quiet',
    ])
  } else {
    console.log('gcloud was not found; skipping Calendar API enablement.')
  }

  const clientUrl = `${GOOGLE_AUTH_CLIENTS_URL}?project=${encodeURIComponent(projectId)}`
  console.log('\nCreate a Google Auth Platform web client with:')
  console.log(`Application type: Web application`)
  console.log(`Name: OpenSlot local web`)
  console.log(`Authorized JavaScript origin: ${javascriptOrigin}`)
  console.log(`Authorized redirect URI: ${redirectUri}`)
  console.log('\nGoogle only shows the client secret once, immediately after creation.')

  if (process.platform === 'darwin') {
    spawnSync('open', [clientUrl], { stdio: 'ignore' })
  }

  console.log(`Open this URL if it did not open automatically:\n${clientUrl}\n`)

  const clientId = await promptText('Paste GOOGLE_CALENDAR_CLIENT_ID')
  const clientSecret = await promptSecret('Paste GOOGLE_CALENDAR_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Both Google client ID and client secret are required.')
  }

  writeOpenSlotEnv(envFile, {
    GOOGLE_CALENDAR_CLIENT_ID: clientId,
    GOOGLE_CALENDAR_CLIENT_SECRET: clientSecret,
  })

  console.log('Google Calendar OAuth env is configured.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
