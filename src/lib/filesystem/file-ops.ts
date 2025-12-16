/**
 * @fileoverview File System File Operations
 * @module lib/filesystem/file-ops
 */

import { FileSystemError } from './fs-errors';
import { validatePath } from './path-utils';
import { getFileHandleFromPath } from './handle-utils';
import type { FileReadResult, FileReadBinaryResult } from './fs-types';

/**
 * Read a file from the directory.
 */
export async function readFile(
    root: FileSystemDirectoryHandle,
    path: string,
    options?: { encoding?: 'utf-8' }
): Promise<FileReadResult>;
export async function readFile(
    root: FileSystemDirectoryHandle,
    path: string,
    options: { encoding: 'binary' }
): Promise<FileReadBinaryResult>;
export async function readFile(
    root: FileSystemDirectoryHandle,
    path: string,
    options: { encoding?: 'utf-8' | 'binary' } = { encoding: 'utf-8' }
): Promise<FileReadResult | FileReadBinaryResult> {
    validatePath(path, 'readFile');

    try {
        const fileHandle = await getFileHandleFromPath(root, path);
        const file = await fileHandle.getFile();

        if (options.encoding === 'binary') {
            const data = await file.arrayBuffer();
            return {
                data,
                mimeType: file.type || undefined,
            };
        }

        const content = await file.text();
        return {
            content,
            encoding: 'utf-8',
        };
    } catch (error: any) {
        if (error.name === 'NotFoundError') {
            throw new FileSystemError(`File not found: ${path}`, 'FILE_NOT_FOUND', error);
        }

        // Pass through FileSystemErrors
        if (error instanceof FileSystemError) {
            throw error;
        }

        throw new FileSystemError(
            `Failed to read file "${path}": ${error.message}`,
            'FILE_READ_FAILED',
            error
        );
    }
}

/**
 * Write a file to the directory.
 */
export async function writeFile(
    root: FileSystemDirectoryHandle,
    path: string,
    content: string
): Promise<void> {
    validatePath(path, 'writeFile');

    try {
        const fileHandle = await getFileHandleFromPath(root, path, true);
        const writable = await fileHandle.createWritable();

        try {
            await writable.write(content);
        } finally {
            await writable.close();
        }
    } catch (error: any) {
        if (error instanceof FileSystemError) throw error;

        throw new FileSystemError(
            `Failed to write file "${path}": ${error.message}`,
            'FILE_WRITE_FAILED',
            error
        );
    }
}

/**
 * Delete a file from the directory.
 */
export async function deleteFile(
    root: FileSystemDirectoryHandle,
    path: string
): Promise<void> {
    validatePath(path, 'deleteFile');

    try {
        // Note: To delete a file, we need the parent directory handle and the name
        // We can recycle logic but the API requires removeEntry on the parent
        // or passing the handle if supported (but standard is parent.removeEntry)

        // Using handle-utils would get us the file handle, but we need the parent to remove it.
        // So we need to walk to parent.

        // We can verify existence first? 
        // Or just try to get parent and remove.

        // Duplicate logic from LocalFSAdapter: "this.directoryHandle.removeEntry(path)" 
        // BUT LocalFSAdapter usage of removeEntry(path) only works for direct children if passing string?
        // MDN says removeEntry(name).
        // If path is "dir/file.txt", we need to get handle for "dir" and call removeEntry("file.txt").

        // WAIT! LocalFSAdapter.deleteFile implementation:
        // await this.directoryHandle.removeEntry(path);
        //
        // Does removeEntry support paths?
        // According to specs, it takes a name, not a path.
        // However, some implementations might support paths, OR the existing code in LocalFSAdapter 
        // might be buggy for nested files if it relies on that.
        // 
        // Let's check LocalFSAdapter again.
        // It says: "Permanently deletes a file from the granted directory."
        // 
        // If the original implementation just called removeEntry(path) on the root, 
        // it likely only supported top-level files OR the browser implementation is lenient.
        // 
        // Standard approach:
        // 1. Parse path.
        // 2. Get parent directory handle.
        // 3. Call removeEntry on parent with filename.

        // Let's implement it correctly/robustly here.

        const parts = path.split('/').filter(p => p.length > 0);
        const fileName = parts.pop();
        if (!fileName) throw new FileSystemError('Invalid path', 'INVALID_PATH');

        let parentDir = root;
        if (parts.length > 0) {
            // Walk to parent
            const { getDirectoryHandleFromPath } = await import('./handle-utils');
            parentDir = await getDirectoryHandleFromPath(root, parts.join('/'));
        }

        await parentDir.removeEntry(fileName);

    } catch (error: any) {
        if (error.name === 'NotFoundError') {
            throw new FileSystemError(`File not found: ${path}`, 'FILE_NOT_FOUND', error);
        }

        if (error instanceof FileSystemError) throw error;

        throw new FileSystemError(
            `Failed to delete file "${path}": ${error.message}`,
            'FILE_DELETE_FAILED',
            error
        );
    }
}
