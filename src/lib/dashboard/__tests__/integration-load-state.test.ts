import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadDashboardIntegrationSummaries } from '../integration-load-state'

describe('loadDashboardIntegrationSummaries', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns loaded integration data with a successful state', async () => {
    await expect(
      loadDashboardIntegrationSummaries('calendar connections', async () => [
        'connection-1',
      ])
    ).resolves.toEqual({
      data: ['connection-1'],
      loadFailed: false,
    })
  })

  it('preserves load failure state instead of returning a plain empty list', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    await expect(
      loadDashboardIntegrationSummaries('webhook endpoints', async () => {
        throw new Error('database unavailable')
      })
    ).resolves.toEqual({
      data: [],
      loadFailed: true,
    })

    expect(consoleError).toHaveBeenCalledWith(
      'Error loading webhook endpoints:',
      expect.any(Error)
    )
  })
})
