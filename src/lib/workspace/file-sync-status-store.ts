import { Derived, Store } from '@tanstack/store'

export type FileSyncState = 'synced' | 'pending' | 'error'

export interface FileSyncStatus {
  state: FileSyncState
  updatedAt: number
  errorMessage?: string
  errorStack?: string
}

export interface FileSyncCounts {
  synced: number
  pending: number
  error: number
  total: number
}

export type FileSyncStatusMap = Map<string, FileSyncStatus>

export const fileSyncStatusStore = new Store<FileSyncStatusMap>(new Map())

export const fileSyncCountsStore = new Derived<FileSyncCounts>({
  deps: [fileSyncStatusStore],
  fn: ({ currDepVals }) => {
    const map = currDepVals[0] as FileSyncStatusMap
    let synced = 0
    let pending = 0
    let error = 0

    for (const status of map.values()) {
      if (status.state === 'synced') synced += 1
      else if (status.state === 'pending') pending += 1
      else error += 1
    }

    return { synced, pending, error, total: map.size }
  },
})

fileSyncCountsStore.mount()

export function setFileSyncPending(path: string): void {
  if (!path) return
  const now = Date.now()
  fileSyncStatusStore.setState((prev) => {
    const next = new Map(prev)
    next.set(path, { state: 'pending', updatedAt: now })
    return next
  })
}

export function setFileSyncSynced(path: string): void {
  if (!path) return
  const now = Date.now()
  fileSyncStatusStore.setState((prev) => {
    const next = new Map(prev)
    next.set(path, { state: 'synced', updatedAt: now })
    return next
  })
}

export function setFileSyncError(path: string, error: Error): void {
  if (!path) return
  const now = Date.now()
  fileSyncStatusStore.setState((prev) => {
    const next = new Map(prev)
    next.set(path, {
      state: 'error',
      updatedAt: now,
      errorMessage: error.message,
      errorStack: error.stack,
    })
    return next
  })
}

export function clearFileSyncStatus(path: string): void {
  if (!path) return
  fileSyncStatusStore.setState((prev) => {
    if (!prev.has(path)) return prev
    const next = new Map(prev)
    next.delete(path)
    return next
  })
}

export function clearAllFileSyncStatuses(): void {
  fileSyncStatusStore.setState(() => new Map())
}
