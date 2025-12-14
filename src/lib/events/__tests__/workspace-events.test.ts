import { describe, it, expect } from 'vitest'

import { createWorkspaceEventBus } from '../workspace-events'

describe('workspace-events', () => {
  it('should create a workspace event bus', () => {
    const bus = createWorkspaceEventBus()
    expect(bus).toBeDefined()
    expect(typeof bus.on).toBe('function')
    expect(typeof bus.emit).toBe('function')
  })

  it('should type and emit events (runtime check)', () => {
    const bus = createWorkspaceEventBus()

    let receivedPath: string | null = null

    bus.on('file:created', (payload) => {
      receivedPath = payload.path
    })

    bus.emit('file:created', { path: 'src/index.ts', source: 'editor' })

    expect(receivedPath).toBe('src/index.ts')
  })
})
