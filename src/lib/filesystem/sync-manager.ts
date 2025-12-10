/**
 * Sync Manager - Bidirectional file sync between Local FS and WebContainers
 * @module lib/filesystem/sync-manager
 * 
 * This module provides synchronization between the local file system (via File System Access API)
 * and WebContainers' in-memory file system.
 * 
 * **Sync Strategy:**
 * - Local FS is the source of truth
 * - WebContainers mirrors the local file system
 * - Initial sync: Local FS → WebContainers (via mount)
 * - File save: Dual write to both systems
 * 
 * **Exclusions:**
 * - .git directory (not needed in WebContainers, will be regenerated)
 * - node_modules (regenerated via npm install)
 * - System files (.DS_Store, Thumbs.db)
 * 
 * @example
 * ```ts
 * import { SyncManager } from '@/lib/filesystem/sync-manager';
 * import { LocalFSAdapter } from '@/lib/filesystem/local-fs-adapter';
 * 
 * const adapter = new LocalFSAdapter();
 * await adapter.requestDirectoryAccess();
 * 
 * const syncManager = new SyncManager(adapter, {
 *   onProgress: (p) => console.log(`Syncing: ${p.currentFile}`),
 *   onComplete: (r) => console.log(`Synced ${r.syncedFiles} files in ${r.duration}ms`),
 * });
 * 
 * await syncManager.syncToWebContainer();
 * ```
 */

import { LocalFSAdapter, type DirectoryEntry } from './local-fs-adapter';
import { boot, mount, getFileSystem, isBooted } from '../webcontainer';
import type { FileSystemTree } from '@webcontainer/api';
import {
    type SyncConfig,
    type SyncProgress,
    type SyncResult,
    type SyncStatus,
    SyncError,
    DEFAULT_SYNC_CONFIG,
    BINARY_EXTENSIONS,
} from './sync-types';

// Re-export types for convenience
export { SyncError } from './sync-types';
export type { SyncConfig, SyncProgress, SyncResult, SyncStatus } from './sync-types';

/**
 * SyncManager - Keeps Local FS and WebContainers in sync
 * 
 * @example
 * ```ts
 * const syncManager = new SyncManager(localFSAdapter, {
 *   excludePatterns: ['.git', 'node_modules', 'dist'],
 *   onProgress: (p) => setProgress(p.percentage),
 *   onError: (e) => toast.error(e.message),
 *   onComplete: (r) => console.log('Sync complete!'),
 * });
 * 
 * // Initial sync
 * await syncManager.syncToWebContainer();
 * 
 * // Dual write on save
 * await syncManager.writeFile('src/index.ts', 'console.log("hello")');
 * ```
 */
export class SyncManager {
    private localAdapter: LocalFSAdapter;
    private config: SyncConfig;
    private _status: SyncStatus = 'idle';

    constructor(localAdapter: LocalFSAdapter, config: Partial<SyncConfig> = {}) {
        this.localAdapter = localAdapter;
        this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    }

    /**
     * Get the current sync status
     */
    get status(): SyncStatus {
        return this._status;
    }

    /**
     * Sync all files from Local FS to WebContainers
     * 
     * Recursively traverses the local directory, builds a FileSystemTree,
     * and mounts it to the WebContainer.
     * 
     * @returns Promise resolving to SyncResult with sync statistics
     * @throws {SyncError} If sync fails critically (WebContainer not booted, mount fails)
     * 
     * @example
     * ```ts
     * const result = await syncManager.syncToWebContainer();
     * console.log(`Synced ${result.syncedFiles}/${result.totalFiles} files`);
     * console.log(`Duration: ${result.duration}ms`);
     * if (result.failedFiles.length > 0) {
     *   console.warn('Failed files:', result.failedFiles);
     * }
     * ```
     */
    async syncToWebContainer(): Promise<SyncResult> {
        this._status = 'syncing';
        const startTime = performance.now();

        const result: SyncResult = {
            success: true,
            totalFiles: 0,
            syncedFiles: 0,
            failedFiles: [],
            duration: 0,
        };

        try {
            // Ensure WebContainer is booted
            if (!isBooted()) {
                console.log('[SyncManager] Booting WebContainer...');
                await boot();
            }

            console.log('[SyncManager] Starting sync: Local FS → WebContainers');

            // Build file tree from local FS
            const tree = await this.buildFileSystemTree('', result);

            // Count entries in tree for logging
            const entryCount = this.countTreeEntries(tree);
            console.log(`[SyncManager] Built file tree with ${entryCount} entries`);

            // Mount to WebContainer
            console.log('[SyncManager] Mounting files to WebContainer...');
            await mount(tree);

            result.duration = Math.round(performance.now() - startTime);
            console.log(
                `[SyncManager] Sync complete: ${result.syncedFiles}/${result.totalFiles} files in ${result.duration}ms`
            );

            // Warn if we exceeded performance target
            if (result.totalFiles >= 100 && result.duration > 3000) {
                console.warn(
                    `[SyncManager] Sync exceeded 3s target for ${result.totalFiles} files: ${result.duration}ms`
                );
            }

            this._status = 'idle';
            this.config.onComplete?.(result);
        } catch (error) {
            result.success = false;
            result.duration = Math.round(performance.now() - startTime);
            this._status = 'error';

            const syncError = new SyncError(
                `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error instanceof SyncError ? error.code : 'SYNC_FAILED',
                undefined,
                error
            );

            console.error('[SyncManager] Sync failed:', syncError);
            this.config.onError?.(syncError);
            this.config.onComplete?.(result);

            throw syncError;
        }

        return result;
    }

    /**
     * Write a file to both Local FS and WebContainers
     * 
     * Performs a dual write to keep both systems in sync.
     * Writes to Local FS first (source of truth), then WebContainers.
     * 
     * @param path - Relative path to the file
     * @param content - File content as string
     * @throws {SyncError} If write fails
     * 
     * @example
     * ```ts
     * await syncManager.writeFile('src/index.ts', 'export default {};');
     * ```
     */
    async writeFile(path: string, content: string): Promise<void> {
        const startTime = performance.now();

        try {
            // Write to local FS first (source of truth)
            await this.localAdapter.writeFile(path, content);

            // Write to WebContainers if booted
            if (isBooted()) {
                const fs = getFileSystem();

                // Ensure parent directories exist in WebContainers
                const segments = path.split('/');
                if (segments.length > 1) {
                    const parentPath = segments.slice(0, -1).join('/');
                    try {
                        await fs.mkdir(parentPath, { recursive: true });
                    } catch {
                        // Directory might already exist, ignore
                    }
                }

                await fs.writeFile(path, content);
            }

            const duration = Math.round(performance.now() - startTime);
            console.log(`[SyncManager] Dual write completed: ${path} in ${duration}ms`);

            // Warn if we exceeded performance target
            if (duration > 500) {
                console.warn(
                    `[SyncManager] Write exceeded 500ms target: ${path} took ${duration}ms`
                );
            }
        } catch (error) {
            const syncError = new SyncError(
                `Failed to write file: ${path}`,
                'FILE_WRITE_FAILED',
                path,
                error
            );
            this.config.onError?.(syncError);
            throw syncError;
        }
    }

    /**
     * Delete a file from both Local FS and WebContainers
     * 
     * @param path - Relative path to the file
     * @throws {SyncError} If delete fails
     */
    async deleteFile(path: string): Promise<void> {
        try {
            // Delete from local FS first
            await this.localAdapter.deleteFile(path);

            // Delete from WebContainers if booted
            if (isBooted()) {
                const fs = getFileSystem();
                try {
                    await fs.rm(path);
                } catch {
                    // File might not exist in WebContainers, ignore
                }
            }

            console.log(`[SyncManager] Dual delete completed: ${path}`);
        } catch (error) {
            const syncError = new SyncError(
                `Failed to delete file: ${path}`,
                'FILE_WRITE_FAILED',
                path,
                error
            );
            this.config.onError?.(syncError);
            throw syncError;
        }
    }

    /**
     * Create a directory in both Local FS and WebContainers
     * 
     * @param path - Relative path to the directory
     * @throws {SyncError} If create fails
     */
    async createDirectory(path: string): Promise<void> {
        try {
            // Create in local FS first
            await this.localAdapter.createDirectory(path);

            // Create in WebContainers if booted
            if (isBooted()) {
                const fs = getFileSystem();
                await fs.mkdir(path, { recursive: true });
            }

            console.log(`[SyncManager] Dual mkdir completed: ${path}`);
        } catch (error) {
            const syncError = new SyncError(
                `Failed to create directory: ${path}`,
                'FILE_WRITE_FAILED',
                path,
                error
            );
            this.config.onError?.(syncError);
            throw syncError;
        }
    }

    /**
     * Delete a directory from both Local FS and WebContainers
     * 
     * @param path - Relative path to the directory
     * @throws {SyncError} If delete fails
     */
    async deleteDirectory(path: string): Promise<void> {
        try {
            // Delete from local FS first
            await this.localAdapter.deleteDirectory(path);

            // Delete from WebContainers if booted
            if (isBooted()) {
                const fs = getFileSystem();
                try {
                    await fs.rm(path, { recursive: true });
                } catch {
                    // Directory might not exist in WebContainers, ignore
                }
            }

            console.log(`[SyncManager] Dual rmdir completed: ${path}`);
        } catch (error) {
            const syncError = new SyncError(
                `Failed to delete directory: ${path}`,
                'FILE_WRITE_FAILED',
                path,
                error
            );
            this.config.onError?.(syncError);
            throw syncError;
        }
    }

    /**
     * Update exclusion patterns
     * 
     * @param patterns - New array of exclusion patterns
     */
    setExcludePatterns(patterns: string[]): void {
        this.config.excludePatterns = patterns;
    }

    /**
     * Get current exclusion patterns
     */
    getExcludePatterns(): string[] {
        return [...this.config.excludePatterns];
    }

    /**
     * Build a FileSystemTree from the local directory
     * 
     * @param path - Current path being traversed
     * @param result - SyncResult to update with progress
     * @returns FileSystemTree for WebContainers mount
     * @private
     */
    private async buildFileSystemTree(
        path: string,
        result: SyncResult
    ): Promise<FileSystemTree> {
        const tree: FileSystemTree = {};

        let entries: DirectoryEntry[];
        try {
            entries = await this.localAdapter.listDirectory(path);
        } catch (error) {
            const syncError = new SyncError(
                `Failed to list directory: ${path || '/'}`,
                'FILE_READ_FAILED',
                path || '/',
                error
            );
            this.config.onError?.(syncError);
            throw syncError;
        }

        for (const entry of entries) {
            const entryPath = path ? `${path}/${entry.name}` : entry.name;

            // Check exclusion patterns
            if (this.isExcluded(entryPath, entry.name)) {
                console.log(`[SyncManager] Excluded: ${entryPath}`);
                continue;
            }

            if (entry.type === 'directory') {
                // Recursively build subtree
                try {
                    tree[entry.name] = {
                        directory: await this.buildFileSystemTree(entryPath, result),
                    };
                } catch (error) {
                    // Directory read failed, but continue with other entries
                    result.failedFiles.push(entryPath);
                    console.warn(`[SyncManager] Failed to read directory: ${entryPath}`);
                }
            } else {
                // Read file content
                try {
                    const content = await this.readFileContent(entryPath, entry.name);
                    tree[entry.name] = { file: { contents: content } };
                    result.syncedFiles++;
                } catch (error) {
                    result.failedFiles.push(entryPath);
                    const syncError = new SyncError(
                        `Failed to read file: ${entryPath}`,
                        'FILE_READ_FAILED',
                        entryPath,
                        error
                    );
                    this.config.onError?.(syncError);
                    console.warn(`[SyncManager] Failed to read file: ${entryPath}`);
                }
            }

            result.totalFiles++;

            // Report progress
            this.config.onProgress?.({
                totalFiles: result.totalFiles,
                syncedFiles: result.syncedFiles,
                currentFile: entryPath,
                percentage: 0, // Can't calculate accurately without knowing total upfront
            });
        }

        return tree;
    }

    /**
     * Check if a path should be excluded from sync
     * 
     * @param path - Full relative path
     * @param name - Just the file/directory name
     * @returns true if should be excluded
     * @private
     */
    private isExcluded(path: string, name: string): boolean {
        return this.config.excludePatterns.some((pattern) => {
            // Check if pattern contains glob wildcard
            if (pattern.includes('*')) {
                // Simple glob pattern matching
                const regexPattern = pattern
                    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
                    .replace(/\*/g, '.*'); // Replace * with .*
                const regex = new RegExp(`^${regexPattern}$`, 'i');
                return regex.test(name) || regex.test(path);
            }

            // Exact match on name or path
            return name === pattern || path === pattern || path.startsWith(`${pattern}/`);
        });
    }

    /**
     * Read file content with appropriate encoding
     * 
     * @param path - Path to the file
     * @param filename - Just the filename (for extension check)
     * @returns File content as string or Uint8Array
     * @private
     */
    private async readFileContent(
        path: string,
        filename: string
    ): Promise<string | Uint8Array> {
        if (this.isBinaryFile(filename)) {
            const result = await this.localAdapter.readFile(path, { encoding: 'binary' });
            return new Uint8Array(result.data);
        }

        const result = await this.localAdapter.readFile(path);
        return result.content;
    }

    /**
     * Check if a file should be read as binary
     * 
     * @param filename - The filename to check
     * @returns true if file is binary
     * @private
     */
    private isBinaryFile(filename: string): boolean {
        const lowerName = filename.toLowerCase();
        return BINARY_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    }

    /**
     * Count total entries in a FileSystemTree (for logging)
     * 
     * @param tree - The tree to count
     * @returns Total number of files and directories
     * @private
     */
    private countTreeEntries(tree: FileSystemTree): number {
        let count = 0;
        for (const key of Object.keys(tree)) {
            count++;
            const entry = tree[key];
            if ('directory' in entry) {
                count += this.countTreeEntries(entry.directory);
            }
        }
        return count;
    }
}

/**
 * Create a SyncManager instance with optional configuration
 * 
 * Convenience factory function for creating SyncManager instances.
 * 
 * @param adapter - LocalFSAdapter instance with directory access
 * @param config - Optional configuration
 * @returns SyncManager instance
 * 
 * @example
 * ```ts
 * const syncManager = createSyncManager(adapter, {
 *   excludePatterns: ['.git', 'node_modules', 'build'],
 *   onProgress: (p) => updateProgressBar(p.percentage),
 * });
 * ```
 */
export function createSyncManager(
    adapter: LocalFSAdapter,
    config?: Partial<SyncConfig>
): SyncManager {
    return new SyncManager(adapter, config);
}
