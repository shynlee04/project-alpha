/**
 * @fileoverview File System Handle Utilities
 * @module lib/filesystem/handle-utils
 */

import { FileSystemError } from './fs-errors';
import { parsePathSegments } from './path-utils';
import { walkDirectorySegments } from './directory-walker';

/**
 * Get a file handle from a root directory handle and a path.
 * 
 * @param root - The root directory handle
 * @param path - Relative path to the file
 * @param create - Whether to create the file if it does not exist
 * @returns Promise resolving to the FileSystemFileHandle
 */
export async function getFileHandleFromPath(
    root: FileSystemDirectoryHandle,
    path: string,
    create = false
): Promise<FileSystemFileHandle> {
    const segments = parsePathSegments(path);

    if (segments.length === 0) {
        throw new FileSystemError('Invalid file path', 'INVALID_PATH');
    }

    // Optimization: Direct access if only one segment
    if (segments.length === 1) {
        return root.getFileHandle(segments[0], { create });
    }

    // Multi-segment: walk to parent directory
    const fileName = segments[segments.length - 1];
    const dirSegments = segments.slice(0, -1);
    const parentDir = await walkDirectorySegments(root, dirSegments, create);

    return parentDir.getFileHandle(fileName, { create });
}

/**
 * Get a directory handle from a root directory handle and a path.
 * 
 * @param root - The root directory handle
 * @param path - Relative path to the directory
 * @param create - Whether to create the directory if it does not exist
 * @returns Promise resolving to the FileSystemDirectoryHandle
 */
export async function getDirectoryHandleFromPath(
    root: FileSystemDirectoryHandle,
    path: string,
    create = false
): Promise<FileSystemDirectoryHandle> {
    const segments = parsePathSegments(path);

    if (segments.length === 0) {
        throw new FileSystemError('Invalid directory path', 'INVALID_PATH');
    }

    // Optimization: Direct access if only one segment
    if (segments.length === 1) {
        return create
            ? root.getDirectoryHandle(segments[0], { create })
            : root.getDirectoryHandle(segments[0]);
    }

    // Multi-segment: walk to the directory
    return walkDirectorySegments(root, segments, create);
}
