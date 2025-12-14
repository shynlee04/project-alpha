import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { createWorkspaceEventBus } from '../workspace-events'
import { useWorkspaceEvent } from '../use-workspace-event'

describe('useWorkspaceEvent', () => {
  it('should subscribe to an event and receive emissions', () => {
    const bus = createWorkspaceEventBus()
    const handler = vi.fn()

    renderHook(() => useWorkspaceEvent(bus, 'sync:started', handler))

    bus.emit('sync:started', { fileCount: 3, direction: 'to-wc' })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ fileCount: 3, direction: 'to-wc' })
  })

  it('should unsubscribe on unmount', () => {
    const bus = createWorkspaceEventBus()
    const handler = vi.fn()

    const { unmount } = renderHook(() => useWorkspaceEvent(bus, 'project:opened', handler))

    bus.emit('project:opened', { projectId: 'p1', name: 'My Project' })
    expect(handler).toHaveBeenCalledTimes(1)

    unmount()

    bus.emit('project:opened', { projectId: 'p2', name: 'Other Project' })
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
