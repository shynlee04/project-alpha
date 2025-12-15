/**
 * @fileoverview Sync Manager Utilities
 * @module lib/filesystem/sync-utils
 * 
 * Utility functions for file synchronization operations.
 */

import { BINARY_EXTENSIONS } from './sync-types';
import type { LocalFSAdapter } from './local-fs-adapter';

/**
 * Check if a path should be excluded from sync
 * 
 * @param path - Full relative path
 * @param name - Just the file/directory name
 * @param excludePatterns - List of glob patterns to exclude
 * @returns true if should be excluded
 */
export function isExcluded(path: string, name: string, excludePatterns: string[]): boolean {
    return excludePatterns.some((pattern) => {
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
 * Check if a file should be read as binary
 * 
 * @param filename - The filename to check
 * @returns true if file is binary
 */
export function isBinaryFile(filename: string): boolean {
    const lowerName = filename.toLowerCase();
    return BINARY_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

/**
 * Read file content with appropriate encoding based on extension
 * 
 * @param adapter - LocalFSAdapter instance
 * @param path - Path to the file
 * @param filename - Just the filename (for extension check)
 * @returns File content as string or Uint8Array
 */
export async function readFileContent(
    adapter: LocalFSAdapter,
    path: string,
    filename: string
): Promise<string | Uint8Array> {
    if (isBinaryFile(filename)) {
        const result = await adapter.readFile(path, { encoding: 'binary' });
        return new Uint8Array(result.data);
    }

    const result = await adapter.readFile(path);
    return result.content;
}
