/**
 * WorkspaceContext - Centralized state management for IDE workspace.
 *
 * Story 3-8: Implement Workspace Context
 *
 * This context provides:
 * - Workspace state (project, handle, sync status, permissions)
 * - Workspace actions (openFolder, switchFolder, syncNow, closeProject)
 * - useWorkspace() hook for component access
 */

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    type ReactNode,
} from 'react';
import { useNavigate } from '@tanstack/react-router';
import { type ProjectMetadata, saveProject, generateProjectId } from './project-store';
import {
    LocalFSAdapter,
    SyncManager,
    type SyncProgress,
    type SyncResult,
} from '../filesystem';
import {
    getPermissionState,
    ensureReadWritePermission,
    saveDirectoryHandleReference,
    type FsaPermissionState,
} from '../filesystem/permission-lifecycle';
import { createWorkspaceEventBus, type WorkspaceEventEmitter } from '../events';

// ============================================================================
// Types
// ============================================================================

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface WorkspaceState {
    /** Current project ID from route */
    projectId: string | null;
    /** Project metadata from IndexedDB */
    projectMetadata: ProjectMetadata | null;
    /** FSA directory handle for local folder */
    directoryHandle: FileSystemDirectoryHandle | null;
    /** Current permission state for the handle */
    permissionState: FsaPermissionState;
    /** Current sync status */
    syncStatus: SyncStatus;
    /** Progress during sync operation */
    syncProgress: SyncProgress | null;
    /** Timestamp of last successful sync */
    lastSyncTime: Date | null;
    /** Error message from last sync attempt */
    syncError: string | null;
    /** Whether folder is currently being opened */
    isOpeningFolder: boolean;
}

export interface WorkspaceActions {
    /** Open folder via picker, save to ProjectStore */
    openFolder(): Promise<void>;
    /** Always show picker, replace current handle */
    switchFolder(): Promise<void>;
    /** Trigger manual sync from LocalFS to WebContainer */
    syncNow(): Promise<void>;
    /** Clear state and navigate to dashboard */
    closeProject(): void;
}

export type WorkspaceContextValue = WorkspaceState & WorkspaceActions & {
    /** RefSpec to LocalFSAdapter for file operations */
    localAdapterRef: React.RefObject<LocalFSAdapter | null>;
    /** Ref to SyncManager for sync operations */
    syncManagerRef: React.RefObject<SyncManager | null>;
    /** Workspace-wide event bus for decoupled observability */
    eventBus: WorkspaceEventEmitter;
};

// ============================================================================
// Context
// ============================================================================

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access workspace state and actions.
 * Must be used within WorkspaceProvider.
 */
export function useWorkspace(): WorkspaceContextValue {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}

// ============================================================================
// Provider Props
// ============================================================================

export interface WorkspaceProviderProps {
    /** Children to render */
    children: ReactNode;
    /** Initial project from route loader */
    initialProject?: ProjectMetadata | null;
    /** Project ID from route params */
    projectId: string;
}

// ============================================================================
// Provider Component
// ============================================================================

export function WorkspaceProvider({
    children,
    initialProject = null,
    projectId,
}: WorkspaceProviderProps) {
    const navigate = useNavigate();

    // State
    const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata | null>(initialProject);
    const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(
        initialProject?.fsaHandle ?? null
    );
    const [permissionState, setPermissionState] = useState<FsaPermissionState>(
        initialProject?.fsaHandle ? 'prompt' : 'unknown'
    );
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [isOpeningFolder, setIsOpeningFolder] = useState(false);

    // Refs for adapters
    const localAdapterRef = useRef<LocalFSAdapter | null>(null);
    const syncManagerRef = useRef<SyncManager | null>(null);
    const eventBusRef = useRef<WorkspaceEventEmitter>(createWorkspaceEventBus());

    // -------------------------------------------------------------------------
    // Internal: Perform sync operation
    // -------------------------------------------------------------------------
    const performSync = useCallback(async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
        setSyncStatus('syncing');
        setSyncError(null);

        try {
            const adapter = new LocalFSAdapter();
            adapter.setDirectoryHandle(handle);

            const syncManager = new SyncManager(adapter, {
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
            });

            localAdapterRef.current = adapter;
            syncManagerRef.current = syncManager;

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
    }, []);

    // -------------------------------------------------------------------------
    // Action: openFolder - Show picker, save to ProjectStore
    // -------------------------------------------------------------------------
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
                await performSync(directoryHandle);
                return;
            }

            // Try to request permission
            const granted = await ensureReadWritePermission(directoryHandle);
            if (granted) {
                setPermissionState('granted');
                await performSync(directoryHandle);
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
            };
            await saveProject(project);
            setProjectMetadata(project);

            // Perform initial sync
            await performSync(handle);
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('[Workspace] Failed to open folder:', error);
            }
        } finally {
            setIsOpeningFolder(false);
        }
    }, [directoryHandle, performSync, projectId]);

    // -------------------------------------------------------------------------
    // Action: switchFolder - Always show picker, replace handle
    // -------------------------------------------------------------------------
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

            // Save to legacy permission-lifecycle store
            await saveDirectoryHandleReference(handle, newProjectId);

            // Save to ProjectStore
            const project: ProjectMetadata = {
                id: newProjectId,
                name: handle.name,
                folderPath: handle.name,
                fsaHandle: handle,
                lastOpened: new Date(),
            };
            await saveProject(project);
            setProjectMetadata(project);

            // Perform sync with new folder
            await performSync(handle);

            // Navigate to new project
            navigate({ to: '/workspace/$projectId', params: { projectId: newProjectId } });
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('[Workspace] Failed to switch folder:', error);
            }
        } finally {
            setIsOpeningFolder(false);
        }
    }, [navigate, performSync]);

    // -------------------------------------------------------------------------
    // Effect: Initial Sync on Mount / Handle Change
    // -------------------------------------------------------------------------
    React.useEffect(() => {
        if (directoryHandle && !syncManagerRef.current && syncStatus === 'idle') {
            // Check permission before syncing? 
            // The directoryHandle from DB comes with 'prompt' or 'granted' (if retained).
            // Browsers often require re-verification or transient activation.
            // If we blindly sync, it might fail permissions using LocalFSAdapter.
            // But strict mode might block it.
            // However, previous implementation tried to restore permission.

            const initSync = async () => {
                const updatedState = await getPermissionState(directoryHandle, 'readwrite');
                setPermissionState(updatedState);

                if (updatedState === 'granted') {
                    await performSync(directoryHandle);
                } else {
                    console.log('[Workspace] Permission needed for initial sync');
                    // We don't auto-prompt here as it requires user gesture usually.
                    // We just set status so UI shows "Re-authorize"
                }
            };
            initSync();
        }
    }, [directoryHandle, performSync, syncStatus]);

    // -------------------------------------------------------------------------
    // Action: syncNow - Trigger manual sync
    // -------------------------------------------------------------------------
    const syncNow = useCallback(async (): Promise<void> => {
        if (!directoryHandle) {
            console.warn('[Workspace] No directory handle, cannot sync');
            return;
        }

        if (syncStatus === 'syncing') {
            console.warn('[Workspace] Sync already in progress');
            return;
        }

        await performSync(directoryHandle);
    }, [directoryHandle, syncStatus, performSync]);

    // -------------------------------------------------------------------------
    // Action: closeProject - Navigate to dashboard
    // -------------------------------------------------------------------------
    const closeProject = useCallback((): void => {
        // Clear refs
        localAdapterRef.current = null;
        syncManagerRef.current = null;

        // Navigate to dashboard
        navigate({ to: '/' });
    }, [navigate]);

    // -------------------------------------------------------------------------
    // Context Value
    // -------------------------------------------------------------------------
    const value: WorkspaceContextValue = {
        // State
        projectId,
        projectMetadata,
        directoryHandle,
        permissionState,
        syncStatus,
        syncProgress,
        lastSyncTime,
        syncError,
        isOpeningFolder,
        // Actions
        openFolder,
        switchFolder,
        syncNow,
        closeProject,
        // Refs
        localAdapterRef,
        syncManagerRef,
        eventBus: eventBusRef.current,
    };

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
        </WorkspaceContext.Provider>
    );
}
