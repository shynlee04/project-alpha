/**
 * Workspace Context Types
 * @module lib/workspace/workspace-types
 */

import type { ProjectMetadata } from './project-store';
import type { LocalFSAdapter, SyncManager, SyncProgress } from '../filesystem';
import type { FsaPermissionState } from '../filesystem/permission-lifecycle';
import type { WorkspaceEventEmitter } from '../events';

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
    autoSync: boolean;
    /** Whether folder is currently being opened */
    isOpeningFolder: boolean;
    /** Current exclusion patterns (default + custom) */
    exclusionPatterns: string[];
}

export interface WorkspaceActions {
    /** Open folder via picker, save to ProjectStore */
    openFolder(): Promise<void>;
    /** Always show picker, replace current handle */
    switchFolder(): Promise<void>;
    /** Trigger manual sync from LocalFS to WebContainer */
    syncNow(): Promise<void>;
    setAutoSync(enabled: boolean): Promise<void>;
    /** Update exclusion patterns and persist to ProjectStore */
    setExclusionPatterns(patterns: string[]): Promise<void>;
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

export interface WorkspaceProviderProps {
    /** Children to render */
    children: React.ReactNode;
    /** Initial project from route loader */
    initialProject?: ProjectMetadata | null;
    /** Project ID from route params */
    projectId: string;
}
