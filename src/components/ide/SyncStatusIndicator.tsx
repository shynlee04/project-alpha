/**
 * SyncStatusIndicator Component
 *
 * Story 3-6: Implement Sync Status UI
 *
 * Displays the current sync status with three states:
 * - idle: checkmark with relative last sync time
 * - syncing: animated spinner with progress
 * - error: warning icon, clickable to retry
 */

import React, { useState, useEffect } from 'react'
import { Check, Loader2, AlertTriangle } from 'lucide-react'
import type { SyncProgress } from '../../lib/filesystem'

// ============================================================================
// Types
// ============================================================================

export type SyncStatusType = 'idle' | 'syncing' | 'error'

export interface SyncStatusIndicatorProps {
  /** Current sync status */
  status: SyncStatusType
  /** Progress during sync operation */
  progress?: SyncProgress | null
  /** Timestamp of last successful sync */
  lastSyncTime?: Date | null
  /** Error message when status is 'error' */
  errorMessage?: string | null
  /** Callback to retry sync (called on error indicator click) */
  onRetry?: () => void
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format a date as relative time string (e.g., "2m ago", "Just now")
 */
function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const seconds = Math.floor((now - date.getTime()) / 1000)

  if (seconds < 0) return 'Just now' // Handle edge case of future dates
  if (seconds < 10) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  // For older times, show date
  return date.toLocaleDateString()
}

// ============================================================================
// Component
// ============================================================================

export function SyncStatusIndicator({
  status,
  progress,
  lastSyncTime,
  errorMessage,
  onRetry,
}: SyncStatusIndicatorProps): React.JSX.Element {
  // Force re-render every 60 seconds to update relative time
  const [, setTick] = useState(0)

  useEffect(() => {
    // Only need timer when idle with a lastSyncTime
    if (status !== 'idle' || !lastSyncTime) return

    const intervalId = setInterval(() => {
      setTick((t) => t + 1)
    }, 60000) // Update every minute

    return () => clearInterval(intervalId)
  }, [status, lastSyncTime])

  // Render based on status
  switch (status) {
    case 'syncing':
      return (
        <span className="flex items-center gap-1 text-xs text-cyan-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>
            Syncing
            {progress && progress.totalFiles > 0
              ? ` ${progress.syncedFiles}/${progress.totalFiles}`
              : '...'}
          </span>
        </span>
      )

    case 'error':
      return (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          title={errorMessage || 'Sync error - click to retry'}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>Sync error</span>
        </button>
      )

    case 'idle':
    default:
      // If never synced, don't show indicator
      if (!lastSyncTime) {
        return (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Check className="w-3 h-3" />
            <span>Not synced</span>
          </span>
        )
      }

      return (
        <span
          className="flex items-center gap-1 text-xs text-emerald-400"
          title={`Last synced: ${lastSyncTime.toLocaleString()}`}
        >
          <Check className="w-3 h-3" />
          <span>{formatRelativeTime(lastSyncTime)}</span>
        </span>
      )
  }
}

// ============================================================================
// Export utility for use elsewhere if needed
// ============================================================================

export { formatRelativeTime }
