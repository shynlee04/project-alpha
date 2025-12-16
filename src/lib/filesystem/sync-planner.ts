/**
 * @fileoverview Sync Planner Module
 * @module lib/filesystem/sync-planner
 * 
 * Separates the "what to sync" logic from the "how to sync" execution.
 * Generates a pure SyncPlan without reading file contents or performing I/O side effects
 * beyond directory listing.
 */

import type { LocalFSAdapter } from './local-fs-adapter';
import type { SyncPlan, SyncItem } from './sync-types';
import { isExcluded } from './sync-utils';
import { walkDirectory } from './directory-walker';

/**
 * Options for generating a sync plan
 */
export interface PlanSyncOptions {
    /** Pattern strings to exclude from the plan */
    excludePatterns?: string[];
}

/**
 * Generate a plan for syncing a directory
 * 
 * Traverses the source directory using a memory-efficient async iterator,
 * applies exclusion rules, and produces a list of items to sync.
 * 
 * @param adapter - File system adapter (only listDirectory needed)
 * @param rootPath - Root path to start planning from (default: '')
 * @param options - Configuration options
 * @returns Promise resolving to a SyncPlan
 */
export async function planSync(
    adapter: Pick<LocalFSAdapter, 'listDirectory'>,
    rootPath: string = '',
    options: PlanSyncOptions = {}
): Promise<SyncPlan> {
    const items: SyncItem[] = [];
    const excludePatterns = options.excludePatterns || [];

    let totalFiles = 0;
    let totalDirectories = 0;

    // optimization: prevent recursion into excluded directories
    const skipDirectory = (entry: { path: string; name: string }) => {
        return isExcluded(entry.path, entry.name, excludePatterns);
    };

    try {
        for await (const entry of walkDirectory(adapter, rootPath, {
            recursive: true,
            skipDirectory
        })) {
            // Check if the current entry itself is excluded
            // (walkDirectory yields the entry before checking recursion/skipping)
            if (isExcluded(entry.path, entry.name, excludePatterns)) {
                continue;
            }

            const item: SyncItem = {
                path: entry.path,
                type: entry.type,
                operation: 'add'
            };

            items.push(item);

            if (entry.type === 'file') {
                totalFiles++;
            } else {
                totalDirectories++;
            }
        }
    } catch (error) {
        // Wrap error to provide context, or let caller handle?
        // Caller (SyncManager) usually handles it.
        throw error;
    }

    return {
        sourceRoot: rootPath,
        items,
        stats: {
            totalFiles,
            totalDirectories
        }
    };
}
