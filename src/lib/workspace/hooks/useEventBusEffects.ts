/**
 * @module lib/workspace/hooks/useEventBusEffects
 */

import { useEffect } from 'react';
import {
    clearAllFileSyncStatuses,
    clearFileSyncStatus,
    setFileSyncError,
    setFileSyncPending,
    setFileSyncSynced,
} from '../../workspace/file-sync-status-store';
import type { useWorkspaceState } from './useWorkspaceState';

type WorkspaceStateReturn = ReturnType<typeof useWorkspaceState>;

export function useEventBusEffects(
    projectId: string | null,
    eventBusRef: WorkspaceStateReturn['refs']['eventBusRef'],
    failedFilesRef: WorkspaceStateReturn['refs']['failedFilesRef']
) {
    useEffect(() => {
        const eventBus = eventBusRef.current;

        const handleFileModified = (payload: { path: string }) => {
            setFileSyncPending(payload.path);
        };

        const handleFileDeleted = (payload: { path: string }) => {
            clearFileSyncStatus(payload.path);
        };

        const handleSyncStarted = () => {
            failedFilesRef.current = new Set();
        };

        const handleSyncProgress = (payload: { currentFile: string }) => {
            const path = payload.currentFile;
            if (!path) return;

            if (failedFilesRef.current.has(path)) {
                return;
            }

            setFileSyncSynced(path);
        };

        const handleSyncError = (payload: { error: Error; file?: string }) => {
            if (!payload.file) return;
            failedFilesRef.current.add(payload.file);
            setFileSyncError(payload.file, payload.error);
        };

        eventBus.on('file:modified', handleFileModified as any);
        eventBus.on('file:deleted', handleFileDeleted as any);
        eventBus.on('sync:started', handleSyncStarted as any);
        eventBus.on('sync:progress', handleSyncProgress as any);
        eventBus.on('sync:error', handleSyncError as any);

        return () => {
            eventBus.off('file:modified', handleFileModified as any);
            eventBus.off('file:deleted', handleFileDeleted as any);
            eventBus.off('sync:started', handleSyncStarted as any);
            eventBus.off('sync:progress', handleSyncProgress as any);
            eventBus.off('sync:error', handleSyncError as any);
        };
    }, [eventBusRef, failedFilesRef]);

    // Clear sync statuses and failed files on project change
    useEffect(() => {
        clearAllFileSyncStatuses();
        failedFilesRef.current = new Set();
    }, [projectId, failedFilesRef]);
}
