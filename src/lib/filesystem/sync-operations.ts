/**
 * @fileoverview Sync Operations
 * @module lib/filesystem/sync-operations
 * 
 * Core operations for building file system trees and counting files for sync.
 */

import type { FileSystemTree } from '@webcontainer/api';
import type { LocalFSAdapter, DirectoryEntry } from './local-fs-adapter';
import type { WorkspaceEventEmitter } from '../events';
import {
    SyncError,
    type SyncResult,
    type SyncConfig,
} from './sync-types';
import { isExcluded, readFileContent } from './sync-utils';

interface ProcessedRef {
    filesProcessed: number;
}

/**
 * Count total files to sync (excluding ignored patterns)
 * 
 * @param adapter - Local FS Adapter
 * @param path - Current path to count from
 * @param excludePatterns - Patterns to exclude
 * @param onError - Error callback
 * @returns Count of files
 */
export async function countFilesToSync(
    adapter: LocalFSAdapter,
    path: string,
    excludePatterns: string[],
    onError?: (error: SyncError) => void
): Promise<number> {
    let entries: DirectoryEntry[];
    try {
        entries = await adapter.listDirectory(path);
    } catch (error) {
        const syncError = new SyncError(
            `Failed to list directory: ${path || '/'}`,
            'FILE_READ_FAILED',
            path || '/',
            error
        );
        onError?.(syncError);
        throw syncError;
    }

    let count = 0;

    for (const entry of entries) {
        const entryPath = path ? `${path}/${entry.name}` : entry.name;

        if (isExcluded(entryPath, entry.name, excludePatterns)) {
            continue;
        }

        if (entry.type === 'directory') {
            count += await countFilesToSync(adapter, entryPath, excludePatterns, onError);
        } else {
            count += 1;
        }
    }

    return count;
}

/**
 * Build a FileSystemTree from the local directory
 * 
 * @param context - Context containing adapter, config, eventBus, etc.
 * @param path - Current path being traversed
 * @param result - SyncResult to update with progress
 * @param totalFileCount - Total expected files
 * @param processedRef - Reference counter for processed files
 * @returns FileSystemTree for WebContainers mount
 */
export async function buildFileSystemTree(
    context: {
        adapter: LocalFSAdapter;
        config: SyncConfig;
        eventBus?: WorkspaceEventEmitter;
    },
    path: string,
    result: SyncResult,
    totalFileCount: number,
    processedRef: ProcessedRef
): Promise<FileSystemTree> {
    const { adapter, config, eventBus } = context;
    const tree: FileSystemTree = {};

    let entries: DirectoryEntry[];
    try {
        entries = await adapter.listDirectory(path);
    } catch (error) {
        const syncError = new SyncError(
            `Failed to list directory: ${path || '/'}`,
            'FILE_READ_FAILED',
            path || '/',
            error
        );
        config.onError?.(syncError);
        throw syncError;
    }

    for (const entry of entries) {
        const entryPath = path ? `${path}/${entry.name}` : entry.name;

        // Check exclusion patterns
        if (isExcluded(entryPath, entry.name, config.excludePatterns)) {
            continue;
        }

        if (entry.type === 'directory') {
            // Recursively build subtree
            try {
                tree[entry.name] = {
                    directory: await buildFileSystemTree(
                        context,
                        entryPath,
                        result,
                        totalFileCount,
                        processedRef
                    ),
                };
            } catch (error) {
                // Directory read failed, but continue with other entries
                result.failedFiles.push(entryPath);
                console.warn(`[SyncManager] Failed to read directory: ${entryPath}`);
            }
        } else {
            // Read file content
            processedRef.filesProcessed += 1;
            try {
                const content = await readFileContent(adapter, entryPath, entry.name);
                tree[entry.name] = { file: { contents: content } };
                result.syncedFiles++;

                eventBus?.emit('sync:progress', {
                    current: processedRef.filesProcessed,
                    total: totalFileCount,
                    currentFile: entryPath,
                });
            } catch (error) {
                result.failedFiles.push(entryPath);
                const syncError = new SyncError(
                    `Failed to read file: ${entryPath}`,
                    'FILE_READ_FAILED',
                    entryPath,
                    error
                );
                config.onError?.(syncError);
                console.warn(`[SyncManager] Failed to read file: ${entryPath}`);

                eventBus?.emit('sync:error', {
                    error: syncError,
                    file: entryPath,
                });

                eventBus?.emit('sync:progress', {
                    current: processedRef.filesProcessed,
                    total: totalFileCount,
                    currentFile: entryPath,
                });
            }
        }

        result.totalFiles++;

        // Report progress
        config.onProgress?.({
            totalFiles: result.totalFiles,
            syncedFiles: result.syncedFiles,
            currentFile: entryPath,
            percentage:
                totalFileCount > 0
                    ? Math.min(
                        100,
                        Math.round((processedRef.filesProcessed / totalFileCount) * 100)
                    )
                    : 0,
        });
    }

    return tree;
}
