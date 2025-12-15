/**
 * @module lib/workspace/hooks/useWorkspaceActions
 */

import { useCallback } from 'react';
import type { NavigateFn } from '@tanstack/react-router';
import { LocalFSAdapter } from '../../filesystem';
import {
    type ProjectMetadata,
    saveProject,
    generateProjectId
} from '../project-store';
import {
    getPermissionState,
    ensureReadWritePermission,
    saveDirectoryHandleReference
} from '../../filesystem/permission-lifecycle';
import type { useWorkspaceState } from './useWorkspaceState';
import type { useSyncOperations } from './useSyncOperations';

type WorkspaceStateReturn = ReturnType<typeof useWorkspaceState>;
type SyncOperationsReturn = ReturnType<typeof useSyncOperations>;

export function useWorkspaceActions(
    navigate: NavigateFn,
    state: WorkspaceStateReturn['state'],
    setters: WorkspaceStateReturn['setters'],
    refs: WorkspaceStateReturn['refs'],
    syncOperations: SyncOperationsReturn,
    projectId: string
) {
    const {
        projectMetadata,
        directoryHandle,
        autoSync,
    } = state;

    const {
        setProjectMetadata,
        setDirectoryHandle,
        setPermissionState,
        setAutoSyncState,
        setIsOpeningFolder,
        setExclusionPatterns: setExclusionPatternsState,
    } = setters;

    const {
        localAdapterRef,
        syncManagerRef
    } = refs;

    const { performSync } = syncOperations;

    const openFolder = useCallback(async (): Promise<void> => {
        if (!LocalFSAdapter.isSupported()) {
            console.warn('[Workspace] File System Access API not supported');
            return;
        }

        // If we have an existing handle, try to restore permission first
        if (directoryHandle) {
            const state = await getPermissionState(directoryHandle, 'readwrite');
            if (state === 'granted') {
                // Already have permission, just sync
                await performSync(directoryHandle, { fullSync: autoSync });
                return;
            }

            // Try to request permission
            const granted = await ensureReadWritePermission(directoryHandle);
            if (granted) {
                setPermissionState('granted');
                await performSync(directoryHandle, { fullSync: autoSync });
                return;
            }
        }

        // Show directory picker
        setIsOpeningFolder(true);
        try {
            const handle = await window.showDirectoryPicker({
                mode: 'readwrite',
            });

            setDirectoryHandle(handle);
            setPermissionState('granted');

            // Save to legacy permission-lifecycle store
            await saveDirectoryHandleReference(handle, projectId);

            // Save to ProjectStore (Story 3-7)
            const project: ProjectMetadata = {
                id: projectId,
                name: handle.name,
                folderPath: handle.name,
                fsaHandle: handle,
                lastOpened: new Date(),
                autoSync,
            };
            await saveProject(project);
            setProjectMetadata(project);

            // Perform initial sync
            await performSync(handle, { fullSync: autoSync });
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('[Workspace] Failed to open folder:', error);
            }
        } finally {
            setIsOpeningFolder(false);
        }
    }, [directoryHandle, performSync, projectId, autoSync, setDirectoryHandle, setPermissionState, setProjectMetadata, setIsOpeningFolder, setAutoSyncState]); // Added missing deps

    const switchFolder = useCallback(async (): Promise<void> => {
        if (!LocalFSAdapter.isSupported()) {
            console.warn('[Workspace] File System Access API not supported');
            return;
        }

        setIsOpeningFolder(true);
        try {
            const handle = await window.showDirectoryPicker({
                mode: 'readwrite',
            });

            // Clear old adapter refs
            localAdapterRef.current = null;
            syncManagerRef.current = null;

            setDirectoryHandle(handle);
            setPermissionState('granted');

            // Generate new project ID for the new folder
            const newProjectId = generateProjectId();

            setAutoSyncState(true);

            // Save to legacy permission-lifecycle store
            await saveDirectoryHandleReference(handle, newProjectId);

            // Save to ProjectStore
            const project: ProjectMetadata = {
                id: newProjectId,
                name: handle.name,
                folderPath: handle.name,
                fsaHandle: handle,
                lastOpened: new Date(),
                autoSync: true,
            };
            await saveProject(project);
            setProjectMetadata(project);

            // Perform sync with new folder
            await performSync(handle, { fullSync: true });

            // Navigate to new project
            navigate({ to: '/workspace/$projectId', params: { projectId: newProjectId } });
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('[Workspace] Failed to switch folder:', error);
            }
        } finally {
            setIsOpeningFolder(false);
        }
    }, [navigate, performSync, setDirectoryHandle, setPermissionState, setAutoSyncState, setProjectMetadata, setIsOpeningFolder, localAdapterRef, syncManagerRef]);

    const setAutoSync = useCallback(
        async (enabled: boolean): Promise<void> => {
            setAutoSyncState(enabled);

            if (!projectMetadata) return;

            const updatedProject: ProjectMetadata = {
                ...projectMetadata,
                autoSync: enabled,
            };

            const saved = await saveProject(updatedProject);
            if (saved) {
                setProjectMetadata(updatedProject);
            }
        },
        [projectMetadata, setAutoSyncState, setProjectMetadata]
    );

    const setExclusionPatterns = useCallback(
        async (patterns: string[]): Promise<void> => {
            setExclusionPatternsState(patterns);

            // Update SyncManager if available
            if (syncManagerRef.current) {
                syncManagerRef.current.setExcludePatterns(patterns);
            }

            // Persist to ProjectStore
            if (!projectMetadata) return;

            const updatedProject: ProjectMetadata = {
                ...projectMetadata,
                exclusionPatterns: patterns,
            };

            const saved = await saveProject(updatedProject);
            if (saved) {
                setProjectMetadata(updatedProject);
            }
        },
        [projectMetadata, syncManagerRef, setExclusionPatternsState, setProjectMetadata]
    );

    const closeProject = useCallback((): void => {
        // Clear refs
        localAdapterRef.current = null;
        syncManagerRef.current = null;

        // Navigate to dashboard
        navigate({ to: '/' });
    }, [navigate, localAdapterRef, syncManagerRef]);

    return {
        openFolder,
        switchFolder,
        setAutoSync,
        setExclusionPatterns,
        closeProject
    };
}
