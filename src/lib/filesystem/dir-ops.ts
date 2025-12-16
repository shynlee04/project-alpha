/**
 * @fileoverview File System Directory Operations
 * @module lib/filesystem/dir-ops
 */

import { FileSystemError } from './fs-errors';
import { validatePath } from './path-utils';
import { getDirectoryHandleFromPath } from './handle-utils';
import type { DirectoryEntry } from './fs-types';
import { readFile, writeFile, deleteFile } from './file-ops'; // For rename

/**
 * List contents of a directory.
 */
export async function listDirectory(
    root: FileSystemDirectoryHandle,
    path: string = ''
): Promise<DirectoryEntry[]> {
    if (path) {
        validatePath(path, 'listDirectory');
    }

    try {
        const dirHandle = path
            ? await getDirectoryHandleFromPath(root, path)
            : root;

        const entries: DirectoryEntry[] = [];

        for await (const [name, handle] of (dirHandle as any).entries()) {
            const type = handle.kind as 'file' | 'directory';
            entries.push({
                name,
                type,
                handle,
            });
        }

        // Sort alphabetically by name
        entries.sort((a, b) => a.name.localeCompare(b.name));

        return entries;
    } catch (error: any) {
        if (error.name === 'NotFoundError') {
            throw new FileSystemError(`Directory not found: ${path || '/'}`, 'DIR_NOT_FOUND', error);
        }

        if (error instanceof FileSystemError) throw error;

        throw new FileSystemError(
            `Failed to list directory "${path}": ${error.message}`,
            'DIR_LIST_FAILED',
            error
        );
    }
}

/**
 * Create a new directory.
 */
export async function createDirectory(
    root: FileSystemDirectoryHandle,
    path: string
): Promise<void> {
    validatePath(path, 'createDirectory');

    try {
        await getDirectoryHandleFromPath(root, path, true);
    } catch (error: any) {
        if (error instanceof FileSystemError) throw error;

        throw new FileSystemError(
            `Failed to create directory "${path}": ${error.message}`,
            'DIR_CREATE_FAILED',
            error
        );
    }
}

/**
 * Delete a directory.
 */
export async function deleteDirectory(
    root: FileSystemDirectoryHandle,
    path: string
): Promise<void> {
    validatePath(path, 'deleteDirectory');

    try {
        // Similar to deleteFile, we need parent handle and name
        const parts = path.split('/').filter(p => p.length > 0);
        const dirName = parts.pop();
        if (!dirName) throw new FileSystemError('Invalid path', 'INVALID_PATH');

        let parentDir = root;
        if (parts.length > 0) {
            const { getDirectoryHandleFromPath: getDir } = await import('./handle-utils');
            parentDir = await getDir(root, parts.join('/'));
        }

        await parentDir.removeEntry(dirName, { recursive: true });

    } catch (error: any) {
        if (error.name === 'NotFoundError') {
            throw new FileSystemError(`Directory not found: ${path}`, 'DIR_NOT_FOUND', error);
        }

        if (error instanceof FileSystemError) throw error;

        throw new FileSystemError(
            `Failed to delete directory "${path}": ${error.message}`,
            'DIR_DELETE_FAILED',
            error
        );
    }
}

/**
 * Rename a file or directory.
 */
export async function rename(
    root: FileSystemDirectoryHandle,
    oldPath: string,
    newPath: string
): Promise<void> {
    validatePath(oldPath, 'rename (old path)');
    validatePath(newPath, 'rename (new path)');

    try {
        let content: string | null = null;
        let isDirectory = false;

        // Check if it's a file or directory
        try {
            const { getFileHandleFromPath } = await import('./handle-utils');
            const fileHandle = await getFileHandleFromPath(root, oldPath);
            const file = await fileHandle.getFile();
            content = await file.text();
        } catch (fileError) {
            try {
                const { getDirectoryHandleFromPath } = await import('./handle-utils');
                await getDirectoryHandleFromPath(root, oldPath);
                isDirectory = true;
            } catch (dirError) {
                throw new FileSystemError(`Path not found: ${oldPath}`, 'PATH_NOT_FOUND');
            }
        }

        if (isDirectory) {
            await createDirectory(root, newPath);

            const entries = await listDirectory(root, oldPath);
            for (const entry of entries) {
                const oldChildPath = `${oldPath}/${entry.name}`;
                const newChildPath = `${newPath}/${entry.name}`;
                if (entry.type === 'directory') {
                    await rename(root, oldChildPath, newChildPath);
                } else {
                    // Optimization: binary copy? Current impl uses text
                    // Re-using existing logic from adapter which uses readFile/writeFile text
                    const fileContent = await readFile(root, oldChildPath);
                    await writeFile(root, newChildPath, fileContent.content);
                }
            }

            await deleteDirectory(root, oldPath);
        } else {
            if (content !== null) {
                await writeFile(root, newPath, content);
                await deleteFile(root, oldPath);
            }
        }

    } catch (error: any) {
        if (error.code && error.message && error.name === 'FileSystemError') {
            throw error;
        }

        throw new FileSystemError(
            `Failed to rename "${oldPath}" to "${newPath}": ${error.message}`,
            'RENAME_FAILED',
            error
        );
    }
}
