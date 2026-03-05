import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { HandlerDependencies } from '../src/handlers.ts'

describe('HandlerDependencies', () => {
  it('has optional tracer field', () => {
    const deps = {} as HandlerDependencies
    assert.equal(deps.tracer, undefined)
    assert.ok(true) // compilation passing is the real assertion
  })
})
