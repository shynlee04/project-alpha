/**
 * @module lib/workspace/hooks/useWorkspaceState
 */

import { useState, useRef } from 'react';
import type { ProjectMetadata } from '../project-store';
import type { LocalFSAdapter, SyncManager, SyncProgress } from '../../filesystem';
import type { FsaPermissionState } from '../../filesystem/permission-lifecycle';
import { createWorkspaceEventBus, type WorkspaceEventEmitter } from '../../events';
import type { SyncStatus } from '../workspace-types';

export function useWorkspaceState(initialProject: ProjectMetadata | null = null) {
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
    const [autoSync, setAutoSyncState] = useState<boolean>(initialProject?.autoSync ?? true);
    const [isOpeningFolder, setIsOpeningFolder] = useState(false);

    // Refs for adapters
    const localAdapterRef = useRef<LocalFSAdapter | null>(null);
    const syncManagerRef = useRef<SyncManager | null>(null);
    const eventBusRef = useRef<WorkspaceEventEmitter>(createWorkspaceEventBus());
    const failedFilesRef = useRef<Set<string>>(new Set());

    return {
        state: {
            projectMetadata,
            directoryHandle,
            permissionState,
            syncStatus,
            syncProgress,
            lastSyncTime,
            syncError,
            autoSync,
            isOpeningFolder,
        },
        setters: {
            setProjectMetadata,
            setDirectoryHandle,
            setPermissionState,
            setSyncStatus,
            setSyncProgress,
            setLastSyncTime,
            setSyncError,
            setAutoSyncState,
            setIsOpeningFolder,
        },
        refs: {
            localAdapterRef,
            syncManagerRef,
            eventBusRef,
            failedFilesRef,
        },
    };
}
