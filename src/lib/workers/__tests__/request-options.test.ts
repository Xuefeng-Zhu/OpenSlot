import { describe, expect, it } from 'vitest'
import {
  numberFromSearchParam,
  readWorkerJsonObject,
} from '../request-options'

describe('worker request option helpers', () => {
  it('reads object JSON bodies', async () => {
    const request = requestWithBody(JSON.stringify({ limit: 4 }))

    await expect(readWorkerJsonObject(request as any)).resolves.toEqual({
      limit: 4,
    })
  })

  it('treats malformed and non-object bodies as empty options', async () => {
    await expect(readWorkerJsonObject(requestWithBody('{') as any)).resolves.toEqual({})
    await expect(
      readWorkerJsonObject(requestWithBody(JSON.stringify(['limit'])) as any)
    ).resolves.toEqual({})
    await expect(
      readWorkerJsonObject(requestWithBody(JSON.stringify(4)) as any)
    ).resolves.toEqual({})
  })

  it('converts present search params to numbers', () => {
    expect(numberFromSearchParam(null)).toBeUndefined()
    expect(numberFromSearchParam('')).toBeUndefined()
    expect(numberFromSearchParam('7')).toBe(7)
  })
})

function requestWithBody(body: string) {
  return new Request('http://localhost/api/worker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}
