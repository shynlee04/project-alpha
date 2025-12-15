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

// Story 5-3: Conversation Store
export {
    getConversation,
    saveConversation,
    appendConversationMessage,
    appendToolResult,
    clearConversation,
    listRecentConversations,
    type ConversationMessage,
    type ConversationMessageRole,
    type ConversationState,
    type ToolResultRecord,
} from './conversation-store';

// Story 5-4: IDE State Store
export {
    getIdeState,
    saveIdeState,
    updateIdeState,
    clearIdeState,
    listRecentIdeStates,
    type IdeState,
    type IdeStatePatch,
    type TerminalTab,
} from './ide-state-store';

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

export {
    fileSyncStatusStore,
    fileSyncCountsStore,
    setFileSyncPending,
    setFileSyncSynced,
    setFileSyncError,
    clearFileSyncStatus,
    clearAllFileSyncStatuses,
    type FileSyncState,
    type FileSyncStatus,
    type FileSyncStatusMap,
} from './file-sync-status-store';
