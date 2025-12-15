/**
 * File System Module - Barrel Export
 * @module lib/filesystem
 * 
 * This module provides file system operations for the IDE:
 * - LocalFSAdapter: File System Access API wrapper for local file operations
 * - SyncManager: Bidirectional sync between Local FS and WebContainers
 * - Path utilities: Path validation and parsing
 * - Error classes: Structured error handling
 * 
 * @example
 * ```ts
 * import {
 *   LocalFSAdapter,
 *   SyncManager,
 *   createSyncManager,
 *   SyncError,
 *   validatePath,
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

// Error classes (standalone exports for direct import)
export { FileSystemError, PermissionDeniedError } from './fs-errors';

// Type definitions (standalone exports for direct import)
export type { DirectoryEntry, FileReadResult, FileReadBinaryResult } from './fs-types';

// Path utilities
export { validatePath, parsePathSegments } from './path-utils';

// LocalFSAdapter exports (also re-exports types and errors for convenience)
export { LocalFSAdapter, localFS } from './local-fs-adapter';

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
