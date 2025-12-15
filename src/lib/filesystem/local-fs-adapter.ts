/**
 * @fileoverview Local File System Access Adapter
 * @module lib/filesystem/local-fs-adapter
 * 
 * Wraps the File System Access API to provide a clean interface
 * for requesting and managing access to local folders.
 *
 * Browser Support:
 * - Chrome 86+, Edge 86+ (full support)
 * - Firefox 115+ (requires polyfill)
 * - Safari 15.2+ (full support)
 *
 * @example
 * ```typescript
 * const adapter = new LocalFSAdapter();
 * if (!LocalFSAdapter.isSupported()) {
 *   throw new Error('File System Access API not supported');
 * }
 * await adapter.requestDirectoryAccess();
 * const content = await adapter.readFile('example.txt');
 * await adapter.writeFile('new-file.txt', 'Hello World');
 * const files = await adapter.listDirectory();
 * ```
 *
 * Integration Points:
 * - Used by Sync Manager for bidirectional file sync (Epic 3, Story 3.3)
 * - Used by Git Adapter for isomorphic-git operations (Epic 7, Story 7.1)
 * - Used by Persistence Layer for handle storage (Epic 5, Story 5.4)
 */

// Re-export types and errors for backward compatibility
export { FileSystemError, PermissionDeniedError } from './fs-errors';
export type { DirectoryEntry, FileReadResult, FileReadBinaryResult } from './fs-types';

import { FileSystemError, PermissionDeniedError } from './fs-errors';
import type { DirectoryEntry, FileReadResult, FileReadBinaryResult } from './fs-types';
import { validatePath, parsePathSegments } from './path-utils';

/**
 * Local File System Access Adapter
 *
 * Provides a clean wrapper around the File System Access API with:
 * - Proper error handling
 * - Type safety
 * - User-friendly error messages
 * - Consistent async interface
 * - Security validation (path traversal protection)
 * - Browser compatibility checks
 * 
 * @class LocalFSAdapter
 * 
 * @example
 * ```typescript
 * const adapter = new LocalFSAdapter();
 * await adapter.requestDirectoryAccess();
 * 
 * // Read file
 * const content = await adapter.readFile('src/index.ts');
 * 
 * // Write file
 * await adapter.writeFile('output.txt', 'Hello World');
 * 
 * // List directory
 * const entries = await adapter.listDirectory('src');
 * ```
 */
export class LocalFSAdapter {
  /** Current directory handle from File System Access API */
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  /**
   * Check if File System Access API is supported in the current browser.
   *
   * @returns true if API is available, false otherwise
   * 
   * @example
   * ```typescript
   * if (!LocalFSAdapter.isSupported()) {
   *   alert('Please use Chrome 86+, Edge 86+, or Safari 15.2+');
   * }
   * ```
   */
  static isSupported(): boolean {
    return 'showDirectoryPicker' in window;
  }

  /**
   * Request directory access from the user.
   *
   * Opens a browser directory picker dialog for the user to select a directory.
   * The user must grant permission before file operations can be performed.
   * This method should be called before any read/write operations.
   *
   * @returns Promise resolving to a FileSystemDirectoryHandle for the selected directory
   * @throws {FileSystemError} API_NOT_SUPPORTED if browser doesn't support File System Access API
   * @throws {PermissionDeniedError} if user denies directory access or cancels picker
   * @throws {FileSystemError} DIRECTORY_ACCESS_FAILED for unexpected errors
   *
   * @example
   * ```typescript
   * const adapter = new LocalFSAdapter();
   * try {
   *   const handle = await adapter.requestDirectoryAccess();
   *   console.log('Directory granted:', handle.name);
   * } catch (error) {
   *   if (error instanceof PermissionDeniedError) {
   *     console.log('User denied access');
   *   }
   * }
   * ```
   */
  async requestDirectoryAccess(): Promise<FileSystemDirectoryHandle> {
    if (!LocalFSAdapter.isSupported()) {
      throw new FileSystemError(
        'File System Access API is not supported in this browser. Please use Chrome 86+, Edge 86+, or Safari 15.2+.',
        'API_NOT_SUPPORTED'
      );
    }

    try {
      const handle = await window.showDirectoryPicker();
      this.directoryHandle = handle;
      return handle;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new PermissionDeniedError('Directory selection was cancelled. Please try again.');
      }

      if (error.name === 'NotAllowedError') {
        throw new PermissionDeniedError('Permission was denied. Please try again.');
      }

      throw new FileSystemError(
        `Failed to access directory: ${error.message}`,
        'DIRECTORY_ACCESS_FAILED',
        error
      );
    }
  }

  /**
   * Get the currently granted directory handle.
   *
   * @returns The directory handle or null if not granted
   */
  getDirectoryHandle(): FileSystemDirectoryHandle | null {
    return this.directoryHandle;
  }

  /**
   * Set the directory handle directly (for restoring from storage).
   *
   * @param handle - FileSystemDirectoryHandle to set
   */
  setDirectoryHandle(handle: FileSystemDirectoryHandle): void {
    this.directoryHandle = handle;
  }

  /**
   * Read a file from the directory.
   *
   * @param path - Relative path to the file (e.g., 'readme.txt', 'src/components/Button.tsx')
   * @param options - Options for reading the file
   * @param options.encoding - 'utf-8' for text files (default), 'binary' for binary files
   * @returns Promise resolving to file content
   * @throws {FileSystemError} FILE_NOT_FOUND if file doesn't exist
   * @throws {FileSystemError} FILE_READ_FAILED if file can't be read
   * @throws {FileSystemError} NO_DIRECTORY_ACCESS if requestDirectoryAccess() not called
   *
   * @example
   * ```typescript
   * // Read text file (default)
   * const text = await adapter.readFile('readme.txt');
   * console.log(text.content);
   *
   * // Read binary file
   * const image = await adapter.readFile('photo.png', { encoding: 'binary' });
   * console.log(image.data); // ArrayBuffer
   * ```
   */
  async readFile(path: string, options?: { encoding?: 'utf-8' }): Promise<FileReadResult>;
  async readFile(path: string, options: { encoding: 'binary' }): Promise<FileReadBinaryResult>;
  async readFile(
    path: string,
    options: { encoding?: 'utf-8' | 'binary' } = { encoding: 'utf-8' }
  ): Promise<FileReadResult | FileReadBinaryResult> {
    validatePath(path, 'readFile');

    if (!this.directoryHandle) {
      throw new FileSystemError(
        'No directory access granted. Call requestDirectoryAccess() first.',
        'NO_DIRECTORY_ACCESS'
      );
    }

    try {
      const fileHandle = await this.getFileHandle(path);
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

      throw new FileSystemError(
        `Failed to read file "${path}": ${error.message}`,
        'FILE_READ_FAILED',
        error
      );
    }
  }

  /**
   * Write a file to the directory.
   *
   * @param path - Relative path to the file (e.g., 'output.txt', 'src/index.ts')
   * @param content - File content as string (will be encoded as UTF-8)
   * @returns Promise resolving when file is written
   * @throws {FileSystemError} FILE_WRITE_FAILED if file can't be written
   * @throws {FileSystemError} NO_DIRECTORY_ACCESS if requestDirectoryAccess() not called
   *
   * @example
   * ```typescript
   * // Write simple file
   * await adapter.writeFile('readme.txt', 'Hello World');
   *
   * // Write nested file (creates directories if needed)
   * await adapter.writeFile('src/components/Button.tsx', 'export default Button;');
   * ```
   */
  async writeFile(path: string, content: string): Promise<void> {
    validatePath(path, 'writeFile');

    if (!this.directoryHandle) {
      throw new FileSystemError(
        'No directory access granted. Call requestDirectoryAccess() first.',
        'NO_DIRECTORY_ACCESS'
      );
    }

    try {
      const fileHandle = await this.getFileHandle(path, true);
      const writable = await fileHandle.createWritable();

      try {
        await writable.write(content);
      } finally {
        await writable.close();
      }
    } catch (error: any) {
      throw new FileSystemError(
        `Failed to write file "${path}": ${error.message}`,
        'FILE_WRITE_FAILED',
        error
      );
    }
  }

  /**
   * Create a new file in the directory.
   *
   * @param path - Relative path to the file within the directory
   * @param content - Initial file content
   * @returns Promise that resolves when file is created
   * @throws {FileSystemError} if file can't be created
   */
  async createFile(path: string, content = ''): Promise<void> {
    await this.writeFile(path, content);
  }

  /**
   * Delete a file from the directory.
   *
   * Permanently deletes a file from the granted directory.
   * This operation cannot be undone.
   *
   * @param path - Relative path to the file within the granted directory
   * @returns Promise resolving when file is deleted
   * @throws {FileSystemError} FILE_NOT_FOUND if file doesn't exist
   * @throws {FileSystemError} FILE_DELETE_FAILED if file can't be deleted
   * @throws {FileSystemError} NO_DIRECTORY_ACCESS if requestDirectoryAccess() not called
   *
   * @example
   * ```typescript
   * await adapter.deleteFile('temp.txt');
   * await adapter.deleteFile('src/old-component.tsx');
   * ```
   */
  async deleteFile(path: string): Promise<void> {
    validatePath(path, 'deleteFile');

    if (!this.directoryHandle) {
      throw new FileSystemError(
        'No directory access granted. Call requestDirectoryAccess() first.',
        'NO_DIRECTORY_ACCESS'
      );
    }

    try {
      await this.directoryHandle.removeEntry(path);
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        throw new FileSystemError(`File not found: ${path}`, 'FILE_NOT_FOUND', error);
      }

      throw new FileSystemError(
        `Failed to delete file "${path}": ${error.message}`,
        'FILE_DELETE_FAILED',
        error
      );
    }
  }

  /**
   * List contents of a directory.
   *
   * Returns an array of DirectoryEntry objects for all files and subdirectories.
   * Entries are sorted alphabetically by name for consistent results.
   *
   * @param path - Relative path to the directory (defaults to root of granted directory)
   * @returns Promise resolving to array of DirectoryEntry objects (sorted alphabetically)
   * @throws {FileSystemError} DIR_NOT_FOUND if directory doesn't exist
   * @throws {FileSystemError} DIR_LIST_FAILED if directory can't be read
   * @throws {FileSystemError} NO_DIRECTORY_ACCESS if requestDirectoryAccess() not called
   *
   * @example
   * ```typescript
   * // List root directory
   * const entries = await adapter.listDirectory();
   * entries.forEach(entry => {
   *   console.log(`${entry.type}: ${entry.name}`);
   * });
   *
   * // List subdirectory
   * const srcFiles = await adapter.listDirectory('src');
   * ```
   */
  async listDirectory(path: string = ''): Promise<DirectoryEntry[]> {
    if (path) {
      validatePath(path, 'listDirectory');
    }

    if (!this.directoryHandle) {
      throw new FileSystemError(
        'No directory access granted. Call requestDirectoryAccess() first.',
        'NO_DIRECTORY_ACCESS'
      );
    }

    try {
      const dirHandle = path
        ? await this._getDirectoryHandle(path)
        : this.directoryHandle;

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

      throw new FileSystemError(
        `Failed to list directory "${path}": ${error.message}`,
        'DIR_LIST_FAILED',
        error
      );
    }
  }

  /**
   * Create a new directory.
   *
   * Creates a new directory or nested directory structure.
   * Intermediate directories are created automatically if they don't exist.
   *
   * @param path - Relative path to the directory (e.g., 'logs', 'src/components')
   * @returns Promise resolving when directory is created
   * @throws {FileSystemError} DIR_CREATE_FAILED if directory can't be created
   * @throws {FileSystemError} NO_DIRECTORY_ACCESS if requestDirectoryAccess() not called
   *
   * @example
   * ```typescript
   * await adapter.createDirectory('output');
   * await adapter.createDirectory('src/components/Button');
   * ```
   */
  async createDirectory(path: string): Promise<void> {
    try {
      await this._createDirectory(path);
    } catch (error: any) {
      throw new FileSystemError(
        `Failed to create directory "${path}": ${error.message}`,
        'DIR_CREATE_FAILED',
        error
      );
    }
  }

  /**
   * Delete a directory.
   *
   * Permanently deletes a directory and all its contents recursively.
   * This operation cannot be undone. Use with caution.
   *
   * @param path - Relative path to the directory within the granted directory
   * @returns Promise resolving when directory is deleted
   * @throws {FileSystemError} DIR_NOT_FOUND if directory doesn't exist
   * @throws {FileSystemError} DIR_DELETE_FAILED if directory can't be deleted
   * @throws {FileSystemError} NO_DIRECTORY_ACCESS if requestDirectoryAccess() not called
   *
   * @example
   * ```typescript
   * await adapter.deleteDirectory('temp');
   * await adapter.deleteDirectory('old-project');
   * ```
   */
  async deleteDirectory(path: string): Promise<void> {
    if (!this.directoryHandle) {
      throw new FileSystemError(
        'No directory access granted. Call requestDirectoryAccess() first.',
        'NO_DIRECTORY_ACCESS'
      );
    }

    try {
      await this.directoryHandle.removeEntry(path, { recursive: true });
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        throw new FileSystemError(`Directory not found: ${path}`, 'DIR_NOT_FOUND', error);
      }

      throw new FileSystemError(
        `Failed to delete directory "${path}": ${error.message}`,
        'DIR_DELETE_FAILED',
        error
      );
    }
  }

  /**
   * Rename a file or directory.
   *
   * Moves a file or directory from oldPath to newPath.
   * Can be used to move files between directories or rename them.
   * Works with both files and directories (recursively for directories).
   *
   * @param oldPath - Current relative path to the file or directory
   * @param newPath - New relative path destination
   * @returns Promise resolving when renamed/moved
   * @throws {FileSystemError} PATH_NOT_FOUND if source path doesn't exist
   * @throws {FileSystemError} RENAME_FAILED if rename operation fails
   * @throws {FileSystemError} NO_DIRECTORY_ACCESS if requestDirectoryAccess() not called
   *
   * @example
   * ```typescript
   * // Rename a file
   * await adapter.rename('old-name.txt', 'new-name.txt');
   *
   * // Move a file to a subdirectory
   * await adapter.rename('document.txt', 'documents/document.txt');
   *
   * // Rename a directory
   * await adapter.rename('src', 'source');
   * ```
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    validatePath(oldPath, 'rename (old path)');
    validatePath(newPath, 'rename (new path)');

    if (!this.directoryHandle) {
      throw new FileSystemError(
        'No directory access granted. Call requestDirectoryAccess() first.',
        'NO_DIRECTORY_ACCESS'
      );
    }

    try {
      let content: string | null = null;
      let isDirectory = false;

      try {
        const fileHandle = await this.directoryHandle.getFileHandle(oldPath);
        const file = await fileHandle.getFile();
        content = await file.text();
      } catch (fileError) {
        try {
          await this.directoryHandle.getDirectoryHandle(oldPath);
          isDirectory = true;
        } catch (dirError) {
          throw new FileSystemError(`Path not found: ${oldPath}`, 'PATH_NOT_FOUND');
        }
      }

      if (isDirectory) {
        await this._createDirectory(newPath);

        const entries = await this.listDirectory(oldPath);
        for (const entry of entries) {
          const oldChildPath = `${oldPath}/${entry.name}`;
          const newChildPath = `${newPath}/${entry.name}`;
          if (entry.type === 'directory') {
            await this.rename(oldChildPath, newChildPath);
          } else {
            const fileContent = await this.readFile(oldChildPath);
            await this.writeFile(newChildPath, fileContent.content);
          }
        }
      } else {
        if (content !== null) {
          await this.writeFile(newPath, content);
        }
      }

      if (isDirectory) {
        await this.deleteDirectory(oldPath);
      } else {
        await this.deleteFile(oldPath);
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

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Walk through directory segments to get the final directory handle.
   *
   * @param segments - Array of path segments
   * @param create - Whether to create directories if they don't exist
   * @returns Promise that resolves to the final directory handle
   * @private
   */
  private async walkDirectorySegments(segments: string[], create = false): Promise<FileSystemDirectoryHandle> {
    if (!this.directoryHandle) {
      throw new FileSystemError(
        'No directory access granted.',
        'NO_DIRECTORY_ACCESS'
      );
    }

    let currentHandle = this.directoryHandle;

    for (const segment of segments) {
      currentHandle = await currentHandle.getDirectoryHandle(segment, { create });
    }

    return currentHandle;
  }

  /**
   * Get a file handle, optionally creating it, with support for multi-segment paths.
   *
   * @param path - Relative path to the file (supports 'dir/subdir/file.txt')
   * @param create - Whether to create the file if it doesn't exist
   * @returns Promise that resolves to FileSystemFileHandle
   * @private
   */
  private async getFileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
    const segments = parsePathSegments(path);

    if (segments.length === 0) {
      throw new FileSystemError('Invalid file path', 'INVALID_PATH');
    }

    // If only one segment, use direct FSA call (optimization)
    if (segments.length === 1) {
      if (!this.directoryHandle) {
        throw new FileSystemError(
          'No directory access granted.',
          'NO_DIRECTORY_ACCESS'
        );
      }
      return this.directoryHandle.getFileHandle(segments[0], { create });
    }

    // Multi-segment: walk to parent directory, then get file handle
    const fileName = segments[segments.length - 1];
    const dirSegments = segments.slice(0, -1);
    const parentDir = await this.walkDirectorySegments(dirSegments, create);

    return parentDir.getFileHandle(fileName, { create });
  }

  /**
   * Get a directory handle with support for multi-segment paths.
   *
   * @param path - Relative path to the directory (supports 'dir/subdir')
   * @returns Promise that resolves to FileSystemDirectoryHandle
   * @private
   */
  private async _getDirectoryHandle(path: string): Promise<FileSystemDirectoryHandle> {
    const segments = parsePathSegments(path);

    if (segments.length === 0) {
      throw new FileSystemError('Invalid directory path', 'INVALID_PATH');
    }

    // If only one segment, use direct FSA call (optimization)
    if (segments.length === 1) {
      if (!this.directoryHandle) {
        throw new FileSystemError(
          'No directory access granted.',
          'NO_DIRECTORY_ACCESS'
        );
      }
      return this.directoryHandle.getDirectoryHandle(segments[0]);
    }

    // Multi-segment: walk to the directory
    return this.walkDirectorySegments(segments, false);
  }

  /**
   * Create a directory with support for multi-segment paths.
   *
   * @param path - Relative path to the directory (supports 'dir/subdir')
   * @returns Promise that resolves when directory is created
   * @private
   */
  private async _createDirectory(path: string): Promise<void> {
    validatePath(path, 'createDirectory');

    const segments = parsePathSegments(path);

    if (segments.length === 0) {
      throw new FileSystemError('Invalid directory path', 'INVALID_PATH');
    }

    // If only one segment, use direct FSA call (optimization)
    if (segments.length === 1) {
      if (!this.directoryHandle) {
        throw new FileSystemError(
          'No directory access granted.',
          'NO_DIRECTORY_ACCESS'
        );
      }
      await this.directoryHandle.getDirectoryHandle(segments[0], { create: true });
      return;
    }

    // Multi-segment: walk and create directories along the way
    await this.walkDirectorySegments(segments, true);
  }
}

/** 
 * Singleton instance for convenience.
 * 
 * Use this when you only need one adapter instance in your application.
 * For multiple directories, create separate LocalFSAdapter instances.
 * 
 * @example
 * ```typescript
 * import { localFS } from './local-fs-adapter';
 * 
 * await localFS.requestDirectoryAccess();
 * const content = await localFS.readFile('config.json');
 * ```
 */
export const localFS = new LocalFSAdapter();
