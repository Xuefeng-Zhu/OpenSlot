#!/usr/bin/env node
import {
  appUrlFromEnv,
  commandExists,
  envPathFromArgs,
  parseJsonCommand,
  promptText,
  providerRedirectUri,
  readOpenSlotEnv,
  writeOpenSlotEnv,
} from './lib/oauth-script-utils.mjs'

const MICROSOFT_GRAPH_APP_ID = '00000003-0000-0000-c000-000000000000'
const USER_READ_SCOPE_ID = 'e1fe6dd8-ba31-4d61-89e7-88639da4683d'
const CALENDARS_READ_WRITE_SCOPE_ID = '1ec239c2-d7c9-4623-a91a-a9775856bb36'

async function main() {
  if (!commandExists('az')) {
    throw new Error(
      'Azure CLI was not found. Install it, run `az login`, then rerun this script.'
    )
  }

  const envFile = envPathFromArgs(process.argv.slice(2))
  const env = readOpenSlotEnv(envFile)
  const appUrl = appUrlFromEnv(env)
  const redirectUri =
    process.env.MICROSOFT_CALENDAR_REDIRECT_URI ||
    providerRedirectUri(appUrl, 'microsoft')
  const displayName = await promptText('Microsoft app display name', 'OpenSlot')
  const tenant = await promptText('MICROSOFT_CALENDAR_TENANT', 'common')
  const years = await promptText('Client secret lifetime in years', '2')

  const requiredResourceAccesses = JSON.stringify([
    {
      resourceAppId: MICROSOFT_GRAPH_APP_ID,
      resourceAccess: [
        {
          id: USER_READ_SCOPE_ID,
          type: 'Scope',
        },
        {
          id: CALENDARS_READ_WRITE_SCOPE_ID,
          type: 'Scope',
        },
      ],
    },
  ])

  console.log('Creating Microsoft Entra app registration...')
  const app = parseJsonCommand('az', [
    'ad',
    'app',
    'create',
    '--display-name',
    displayName,
    '--sign-in-audience',
    'AzureADandPersonalMicrosoftAccount',
    '--web-redirect-uris',
    redirectUri,
    '--required-resource-accesses',
    requiredResourceAccesses,
    '--only-show-errors',
    '--output',
    'json',
  ])

  if (!app.appId) {
    throw new Error('Azure CLI did not return an application client ID.')
  }

  console.log('Creating Microsoft client secret...')
  const credential = parseJsonCommand('az', [
    'ad',
    'app',
    'credential',
    'reset',
    '--id',
    app.appId,
    '--append',
    '--display-name',
    'OpenSlot calendar OAuth',
    '--years',
    years,
    '--only-show-errors',
    '--output',
    'json',
  ])

  if (!credential.password) {
    throw new Error('Azure CLI did not return a client secret password.')
  }

  writeOpenSlotEnv(envFile, {
    MICROSOFT_CALENDAR_CLIENT_ID: app.appId,
    MICROSOFT_CALENDAR_CLIENT_SECRET: credential.password,
    MICROSOFT_CALENDAR_TENANT: tenant,
  })

  console.log(`Microsoft redirect URI: ${redirectUri}`)
  console.log('Microsoft Calendar OAuth env is configured.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
