/**
 * @fileoverview File System Type Definitions
 * @module lib/filesystem/fs-types
 * 
 * Type definitions for File System Access API operations.
 * These types provide type safety for directory/file operations.
 * 
 * @example
 * ```typescript
 * import type { DirectoryEntry, FileReadResult } from './fs-types';
 * 
 * async function listFiles(): Promise<DirectoryEntry[]> {
 *   // Return directory entries
 * }
 * ```
 */

/**
 * Entry in a directory listing.
 * 
 * Represents a file or subdirectory within a directory.
 * Used by listDirectory to return the contents of a folder.
 * 
 * @interface DirectoryEntry
 * 
 * @example
 * ```typescript
 * const entries: DirectoryEntry[] = await adapter.listDirectory();
 * entries.forEach(entry => {
 *   if (entry.type === 'file') {
 *     console.log(`File: ${entry.name}`);
 *   } else {
 *     console.log(`Directory: ${entry.name}`);
 *   }
 * });
 * ```
 */
export interface DirectoryEntry {
    /** Name of the file or directory (basename, not full path) */
    name: string;
    /** Type of entry: 'file' for files, 'directory' for folders */
    type: 'file' | 'directory';
    /** Native File System Access API handle for the entry */
    handle: FileSystemHandle;
}

/**
 * Result of a text file read operation.
 * 
 * Contains the file content as a UTF-8 string.
 * This is the default result type for readFile operations.
 * 
 * @interface FileReadResult
 * 
 * @example
 * ```typescript
 * const result = await adapter.readFile('config.json');
 * const config = JSON.parse(result.content);
 * ```
 */
export interface FileReadResult {
    /** File content as UTF-8 string */
    content: string;
    /** Encoding used (always 'utf-8' for text files) */
    encoding: 'utf-8';
}

/**
 * Result of a binary file read operation.
 * 
 * Contains the raw binary data as an ArrayBuffer.
 * Used for images, PDFs, and other non-text files.
 * 
 * @interface FileReadBinaryResult
 * 
 * @example
 * ```typescript
 * const result = await adapter.readFile('image.png', { encoding: 'binary' });
 * const blob = new Blob([result.data], { type: result.mimeType });
 * ```
 */
export interface FileReadBinaryResult {
    /** Raw binary data as ArrayBuffer */
    data: ArrayBuffer;
    /** MIME type of the file if available (e.g., 'image/png') */
    mimeType?: string;
}
