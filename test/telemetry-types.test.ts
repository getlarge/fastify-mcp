import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { MCPPluginOptions } from '../src/types.ts'
import type { Tracer } from '@opentelemetry/api'

describe('MCPPluginOptions telemetry', () => {
  it('accepts optional telemetry config', () => {
    const opts: MCPPluginOptions = {
      telemetry: { tracer: {} as Tracer }
    }
    assert.ok(opts.telemetry)
  })

  it('is optional', () => {
    const opts: MCPPluginOptions = {}
    assert.equal(opts.telemetry, undefined)
  })
})
