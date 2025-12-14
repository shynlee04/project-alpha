import { useEffect } from 'react'

import type { WorkspaceEventEmitter, WorkspaceEvents } from './workspace-events'

export function useWorkspaceEvent<K extends keyof WorkspaceEvents>(
  eventBus: WorkspaceEventEmitter,
  event: K,
  handler: (...args: WorkspaceEvents[K]) => void,
): void {
  useEffect(() => {
    eventBus.on(event, handler)

    return () => {
      eventBus.off(event, handler)
    }
  }, [eventBus, event, handler])
}
