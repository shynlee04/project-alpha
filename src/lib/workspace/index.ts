/**
 * Workspace module exports.
 *
 * This module provides workspace management functionality including:
 * Story 3-7: Project Metadata Persistence (IndexedDB storage)
 * Story 3-8: Workspace Context (centralized state)
 */

// Story 3-7: Project Store
export {
    saveProject,
    getProject,
    listProjects,
    listProjectsWithPermission,
    deleteProject,
    updateProjectLastOpened,
    checkProjectPermission,
    generateProjectId,
    clearAllProjects,
    getProjectCount,
    _resetDBForTesting,
    type ProjectMetadata,
    type ProjectWithPermission,
    type LayoutConfig,
} from './project-store';

// Story 3-8: Workspace Context
export {
    WorkspaceProvider,
    useWorkspace,
    type WorkspaceState,
    type WorkspaceActions,
    type WorkspaceContextValue,
    type WorkspaceProviderProps,
    type SyncStatus,
} from './WorkspaceContext';
