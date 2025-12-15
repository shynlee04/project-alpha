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

import { createContext, useContext, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { WorkspaceContextValue, WorkspaceProviderProps } from './workspace-types';
import { useWorkspaceState } from './hooks/useWorkspaceState';
import { useSyncOperations } from './hooks/useSyncOperations';
import { useEventBusEffects } from './hooks/useEventBusEffects';
import { useInitialSync } from './hooks/useInitialSync';
import { useWorkspaceActions } from './hooks/useWorkspaceActions';

// Re-export types for consumers
export type { WorkspaceContextValue, WorkspaceProviderProps, WorkspaceState, SyncStatus, WorkspaceActions } from './workspace-types';

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
// Provider Component
// ============================================================================

export function WorkspaceProvider({
    children,
    initialProject = null,
    projectId,
}: WorkspaceProviderProps) {
    const navigate = useNavigate();

    // 1. Initialize State and Refs
    const { state, setters, refs } = useWorkspaceState(initialProject);

    // 2. Initialize Sync Operations (performSync, syncNow)
    const syncOperations = useSyncOperations(setters, refs);

    // 3. Initialize Actions (openFolder, switchFolder, etc.)
    const actions = useWorkspaceActions(
        navigate,
        state,
        setters,
        refs,
        syncOperations,
        projectId
    );

    // 4. Register Effects
    useEventBusEffects(projectId, refs.eventBusRef, refs.failedFilesRef);
    useInitialSync(state, setters, refs, syncOperations);

    const wrappedSyncNow = useCallback(() => {
        return syncOperations.syncNow(state.directoryHandle, state.syncStatus);
    }, [syncOperations.syncNow, state.directoryHandle, state.syncStatus]);

    // 5. Construct Context Value
    const value: WorkspaceContextValue = {
        projectId,
        // State
        ...state,
        // Actions
        ...actions,
        syncNow: wrappedSyncNow,
        // Refs
        localAdapterRef: refs.localAdapterRef,
        syncManagerRef: refs.syncManagerRef,
        eventBus: refs.eventBusRef.current,
    };

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
        </WorkspaceContext.Provider>
    );
}
