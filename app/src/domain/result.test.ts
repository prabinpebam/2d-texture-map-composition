import { describe, expect, it } from 'vitest'
import { failure, success } from './result'

describe('typed results', () => {
  it('keeps success and failure values discriminated', () => {
    expect(success('ready')).toEqual({ ok: true, value: 'ready' })
    expect(failure({ code: 'TEST', message: 'failed' })).toEqual({
      ok: false,
      error: { code: 'TEST', message: 'failed' },
    })
  })
})
