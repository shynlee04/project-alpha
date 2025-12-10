/**
 * File System Module - Barrel Export
 * @module lib/filesystem
 * 
 * This module provides file system operations for the IDE:
 * - LocalFSAdapter: File System Access API wrapper for local file operations
 * - SyncManager: Bidirectional sync between Local FS and WebContainers
 * 
 * @example
 * ```ts
 * import {
 *   LocalFSAdapter,
 *   SyncManager,
 *   createSyncManager,
 *   SyncError,
 * } from '@/lib/filesystem';
 * 
 * const adapter = new LocalFSAdapter();
 * await adapter.requestDirectoryAccess();
 * 
 * const syncManager = createSyncManager(adapter, {
 *   onProgress: (p) => console.log(`Syncing: ${p.currentFile}`),
 * });
 * 
 * await syncManager.syncToWebContainer();
 * ```
 */

// LocalFSAdapter exports
export {
    LocalFSAdapter,
    FileSystemError,
    PermissionDeniedError,
    type DirectoryEntry,
    type FileReadResult,
    type FileReadBinaryResult,
} from './local-fs-adapter';

// SyncManager exports
export {
    SyncManager,
    createSyncManager,
    SyncError,
    type SyncConfig,
    type SyncProgress,
    type SyncResult,
    type SyncStatus,
} from './sync-manager';

// Sync types and constants
export {
    DEFAULT_SYNC_CONFIG,
    BINARY_EXTENSIONS,
    type SyncErrorCode,
} from './sync-types';
