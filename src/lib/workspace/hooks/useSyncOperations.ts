/**
 * @module lib/workspace/hooks/useSyncOperations
 */

import { useCallback } from 'react';
import { LocalFSAdapter, SyncManager, type SyncResult } from '../../filesystem';
import type { useWorkspaceState } from './useWorkspaceState';

type WorkspaceStateReturn = ReturnType<typeof useWorkspaceState>;

export function useSyncOperations(
    setters: WorkspaceStateReturn['setters'],
    refs: WorkspaceStateReturn['refs']
) {
    const {
        setSyncStatus,
        setSyncError,
        setSyncProgress,
        setLastSyncTime
    } = setters;

    const {
        localAdapterRef,
        syncManagerRef,
        eventBusRef
    } = refs;

    const performSync = useCallback(
        async (
            handle: FileSystemDirectoryHandle,
            options?: { fullSync?: boolean, autoSync?: boolean }
        ): Promise<boolean> => {
            const fullSync = options?.fullSync ?? true;

            try {
                let adapter = localAdapterRef.current;
                let syncManager = syncManagerRef.current;

                if (!adapter || !syncManager) {
                    adapter = new LocalFSAdapter();
                    adapter.setDirectoryHandle(handle);

                    syncManager = new SyncManager(
                        adapter,
                        {
                            onProgress: (progress) => {
                                setSyncProgress(progress);
                            },
                            onError: (error) => {
                                console.warn('[Workspace] Sync error:', error.message, error.filePath);
                            },
                            onComplete: (result: SyncResult) => {
                                console.log('[Workspace] Sync complete:', result);
                                if (result.failedFiles.length > 0) {
                                    setSyncError(`Synced with ${result.failedFiles.length} failed files`);
                                }
                            },
                        },
                        eventBusRef.current
                    );

                    localAdapterRef.current = adapter;
                    syncManagerRef.current = syncManager;
                } else {
                    adapter.setDirectoryHandle(handle);
                }

                if (!fullSync) {
                    return true;
                }

                setSyncStatus('syncing');
                setSyncError(null);

                await syncManager.syncToWebContainer();

                setLastSyncTime(new Date());
                setSyncStatus('idle');
                setSyncProgress(null);
                return true;
            } catch (error) {
                console.error('[Workspace] Sync failed:', error);
                setSyncError(error instanceof Error ? error.message : 'Sync failed');
                setSyncStatus('error');
                setSyncProgress(null);
                return false;
            }
        },
        [setSyncStatus, setSyncError, setSyncProgress, setLastSyncTime, localAdapterRef, syncManagerRef, eventBusRef]
    );

    const syncNow = useCallback(async (
        directoryHandle: FileSystemDirectoryHandle | null,
        syncStatus: string
    ): Promise<void> => {
        if (!directoryHandle) {
            console.warn('[Workspace] No directory handle, cannot sync');
            return;
        }

        if (syncStatus === 'syncing') {
            console.warn('[Workspace] Sync already in progress');
            return;
        }

        await performSync(directoryHandle);
    }, [performSync]);

    return { performSync, syncNow };
}
