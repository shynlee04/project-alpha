/**
 * @fileoverview Local File System Access Adapter
 * @description Wraps the File System Access API to provide a clean interface
 * for requesting and managing access to local folders.
 *
 * Browser Support:
 * - Chrome 86+, Edge 86+ (full support)
 * - Firefox 115+ (requires polyfill)
 * - Safari 15.2+ (full support)
 *
 * Usage:
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

// File System Access API types are available in TypeScript DOM lib (ES2022+)
// No import needed - they're part of the global types

/**
 * Error class for File System Access operations
 */
export class FileSystemError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}

/**
 * Error class for user-facing permission errors
 */
export class PermissionDeniedError extends FileSystemError {
  constructor(message = 'Permission was denied. Please try again.') {
    super(message, 'PERMISSION_DENIED');
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Entry in a directory listing
 */
export interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
  handle: FileSystemHandle;
}

/**
 * Result of a file read operation
 */
export interface FileReadResult {
  content: string;
  encoding: 'utf-8';
}

/**
 * Result of a binary file read operation
 */
export interface FileReadBinaryResult {
  data: ArrayBuffer;
  mimeType?: string;
}

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
 */
export class LocalFSAdapter {
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  /**
   * Check if File System Access API is supported in the current browser
   *
   * @returns true if API is available, false otherwise
   */
  static isSupported(): boolean {
    return 'showDirectoryPicker' in window;
  }

  /**
   * Validate a file/directory path to prevent security issues
   *
   * @param path - The path to validate
   * @param operation - The operation being performed (for error messages)
   * @throws {FileSystemError} if path is invalid
   * @private
   */
  private validatePath(path: string, operation: string): void {
    if (!path || typeof path !== 'string') {
      throw new FileSystemError(
        `Path must be a non-empty string for ${operation}`,
        'INVALID_PATH'
      );
    }

    // Check for empty string after trimming
    const trimmed = path.trim();
    if (trimmed.length === 0) {
      throw new FileSystemError(
        `Path cannot be empty for ${operation}`,
        'INVALID_PATH'
      );
    }

    // Normalize path separators for analysis
    const normalized = path.replace(/\\/g, '/');

    // Check for absolute paths BEFORE splitting
    // Unix absolute path starts with '/'
    if (normalized.startsWith('/')) {
      throw new FileSystemError(
        `Invalid path for ${operation}. Use relative paths, not absolute paths.`,
        'ABSOLUTE_PATH'
      );
    }

    // Windows absolute path like 'C:\' or 'C:/'
    if (normalized.length > 1 && normalized[1] === ':') {
      throw new FileSystemError(
        `Invalid path for ${operation}. Use relative paths, not absolute paths.`,
        'ABSOLUTE_PATH'
      );
    }

    // Split into segments to check for path traversal
    const segments = normalized.split('/').filter(s => s.length > 0);

    // Check for path traversal: '..' can only appear as a standalone segment,
    // not as part of a filename (e.g., 'file..txt' is OK, but '../file' or './..' is not)
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // Check for path traversal patterns
      if (segment === '..') {
        // '..' at the start or after another separator is path traversal
        throw new FileSystemError(
          `Invalid path for ${operation}. Path traversal (../) is not allowed.`,
          'PATH_TRAVERSAL'
        );
      }
    }
  }

  /**
   * Request directory access from the user
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
   * const adapter = new LocalFSAdapter();
   * try {
   *   const handle = await adapter.requestDirectoryAccess();
   *   console.log('Directory granted:', handle.name);
   *   // Now you can perform file operations
   *   const content = await adapter.readFile('example.txt');
   * } catch (error) {
   *   if (error instanceof PermissionDeniedError) {
   *     console.log('User denied access');
   *   } else if (error.code === 'API_NOT_SUPPORTED') {
   *     console.log('Browser not supported');
   *   }
   * }
   *
   * @example
   * // Check support before requesting
   * if (LocalFSAdapter.isSupported()) {
   *   await adapter.requestDirectoryAccess();
   * } else {
   *   console.log('Use Chrome 86+, Edge 86+, or Safari 15.2+');
   * }
   */
  async requestDirectoryAccess(): Promise<FileSystemDirectoryHandle> {
    // Check if API is supported
    if (!LocalFSAdapter.isSupported()) {
      throw new FileSystemError(
        'File System Access API is not supported in this browser. Please use Chrome 86+, Edge 86+, or Safari 15.2+.',
        'API_NOT_SUPPORTED'
      );
    }

    try {
      // Request directory picker from user
      const handle = await window.showDirectoryPicker();

      this.directoryHandle = handle;
      return handle;
    } catch (error: any) {
      // Handle specific FSA errors
      if (error.name === 'AbortError') {
        throw new PermissionDeniedError('Directory selection was cancelled. Please try again.');
      }

      if (error.name === 'NotAllowedError') {
        throw new PermissionDeniedError('Permission was denied. Please try again.');
      }

      // Wrap other errors
      throw new FileSystemError(
        `Failed to access directory: ${error.message}`,
        'DIRECTORY_ACCESS_FAILED',
        error
      );
    }
  }

  /**
   * Get the currently granted directory handle
   *
   * @returns The directory handle or null if not granted
   */
  getDirectoryHandle(): FileSystemDirectoryHandle | null {
    return this.directoryHandle;
  }

  setDirectoryHandle(handle: FileSystemDirectoryHandle): void {
    this.directoryHandle = handle;
  }

  /**
   * Read a file from the directory
   *
   * @param path - Relative path to the file within the granted directory (e.g., 'readme.txt', 'src/components/Button.tsx')
   * @param options - Options for reading the file
   * @param options.encoding - 'utf-8' for text files (default), 'binary' for binary files
   * @returns Promise resolving to file content
   * @throws {FileSystemError} FILE_NOT_FOUND if file doesn't exist
   * @throws {FileSystemError} FILE_READ_FAILED if file can't be read
   * @throws {FileSystemError} PATH_TRAVERSAL if path contains '..'
   * @throws {FileSystemError} ABSOLUTE_PATH if path is absolute (starts with '/' or 'C:\')
   * @throws {FileSystemError} NO_DIRECTORY_ACCESS if requestDirectoryAccess() not called
   *
   * @example
   * // Read text file (default)
   * const text = await adapter.readFile('readme.txt');
   * console.log(text.content); // string
   *
   * @example
   * // Read binary file
   * const image = await adapter.readFile('photo.png', { encoding: 'binary' });
   * console.log(image.data); // ArrayBuffer
   * console.log(image.mimeType); // "image/png"
   *
   * @example
   * // Read nested file
   * const config = await adapter.readFile('src/config/app.json');
   */
  async readFile(path: string, options?: { encoding?: 'utf-8' }): Promise<FileReadResult>;
  async readFile(path: string, options: { encoding: 'binary' }): Promise<FileReadBinaryResult>;
  async readFile(
    path: string,
    options: { encoding?: 'utf-8' | 'binary' } = { encoding: 'utf-8' }
  ): Promise<FileReadResult | FileReadBinaryResult> {
    this.validatePath(path, 'readFile');

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

      // Default to UTF-8 text
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
   * Write a file to the directory
   *
   * @param path - Relative path to the file within the granted directory (e.g., 'output.txt', 'src/components/Button.tsx')
   * @param content - File content as string (will be encoded as UTF-8)
   * @returns Promise resolving when file is written
   * @throws {FileSystemError} FILE_WRITE_FAILED if file can't be written
   * @throws {FileSystemError} PATH_TRAVERSAL if path contains '..'
   * @throws {FileSystemError} ABSOLUTE_PATH if path is absolute (starts with '/' or 'C:\')
   * @throws {FileSystemError} NO_DIRECTORY_ACCESS if requestDirectoryAccess() not called
   *
   * @example
   * // Write simple file
   * await adapter.writeFile('readme.txt', 'Hello World');
   *
   * @example
   * // Write nested file (creates directories if needed)
   * await adapter.writeFile('src/components/Button.tsx', 'export default Button;');
   *
   * @example
   * // Write JSON data
   * const data = JSON.stringify({ name: 'MyApp', version: '1.0.0' });
   * await adapter.writeFile('package.json', data);
   */
  async writeFile(path: string, content: string): Promise<void> {
    this.validatePath(path, 'writeFile');

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
   * Create a new file in the directory
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
   * Delete a file from the directory
   *
   * Permanently deletes a file from the granted directory.
   * This operation cannot be undone.
   *
   * @param path - Relative path to the file within the granted directory
   * @returns Promise resolving when file is deleted
   * @throws {FileSystemError} FILE_NOT_FOUND if file doesn't exist
   * @throws {FileSystemError} FILE_DELETE_FAILED if file can't be deleted
   * @throws {FileSystemError} PATH_TRAVERSAL if path contains '..'
   * @throws {FileSystemError} ABSOLUTE_PATH if path is absolute
   * @throws {FileSystemError} NO_DIRECTORY_ACCESS if requestDirectoryAccess() not called
   *
   * @example
   * // Delete a file
   * await adapter.deleteFile('temp.txt');
   *
   * @example
   * // Delete nested file
   * await adapter.deleteFile('src/old-component.tsx');
   */
  async deleteFile(path: string): Promise<void> {
    this.validatePath(path, 'deleteFile');

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
   * List contents of a directory
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
   * // List root directory
   * const entries = await adapter.listDirectory();
   * entries.forEach(entry => {
   *   console.log(`${entry.type}: ${entry.name}`);
   * });
   *
   * @example
   * // List subdirectory
   * const srcFiles = await adapter.listDirectory('src');
   * srcFiles.forEach(file => {
   *   if (file.type === 'file') {
   *     console.log('File:', file.name);
   *   }
   * });
   *
   * @example
   * // Filter files by type
   * const allEntries = await adapter.listDirectory();
   * const files = allEntries.filter(e => e.type === 'file');
   * const directories = allEntries.filter(e => e.type === 'directory');
   */
  async listDirectory(path: string = ''): Promise<DirectoryEntry[]> {
    if (path) {
      this.validatePath(path, 'listDirectory');
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
   * Create a new directory
   *
   * Creates a new directory or nested directory structure.
   * Intermediate directories are created automatically if they don't exist.
   *
   * @param path - Relative path to the directory within the granted directory (e.g., 'logs', 'src/components')
   * @returns Promise resolving when directory is created
   * @throws {FileSystemError} DIR_CREATE_FAILED if directory can't be created
   * @throws {FileSystemError} PATH_TRAVERSAL if path contains '..'
   * @throws {FileSystemError} ABSOLUTE_PATH if path is absolute
   * @throws {FileSystemError} NO_DIRECTORY_ACCESS if requestDirectoryAccess() not called
   *
   * @example
   * // Create a simple directory
   * await adapter.createDirectory('output');
   *
   * @example
   * // Create nested directory structure
   * await adapter.createDirectory('src/components/Button');
   *
   * @example
   * // Create multiple levels at once
   * await adapter.createDirectory('data/exports/2024');
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
   * Delete a directory
   *
   * Permanently deletes a directory and all its contents recursively.
   * This operation cannot be undone. Use with caution.
   *
   * @param path - Relative path to the directory within the granted directory
   * @returns Promise resolving when directory is deleted
   * @throws {FileSystemError} DIR_NOT_FOUND if directory doesn't exist
   * @throws {FileSystemError} DIR_DELETE_FAILED if directory can't be deleted
   * @throws {FileSystemError} PATH_TRAVERSAL if path contains '..'
   * @throws {FileSystemError} ABSOLUTE_PATH if path is absolute
   * @throws {FileSystemError} NO_DIRECTORY_ACCESS if requestDirectoryAccess() not called
   *
   * @example
   * // Delete an empty directory
   * await adapter.deleteDirectory('temp');
   *
   * @example
   * // Delete directory with all contents
   * await adapter.deleteDirectory('old-project');
   *
   * @example
   * // Delete nested directory
   * await adapter.deleteDirectory('src/obsolete-component');
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
   * Rename a file or directory
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
   * @throws {FileSystemError} PATH_TRAVERSAL if either path contains '..'
   * @throws {FileSystemError} ABSOLUTE_PATH if either path is absolute
   * @throws {FileSystemError} NO_DIRECTORY_ACCESS if requestDirectoryAccess() not called
   *
   * @example
   * // Rename a file
   * await adapter.rename('old-name.txt', 'new-name.txt');
   *
   * @example
   * // Move a file to a subdirectory
   * await adapter.rename('document.txt', 'documents/document.txt');
   *
   * @example
   * // Rename a directory
   * await adapter.rename('src', 'source');
   *
   * @example
   * // Move directory with contents
   * await adapter.rename('components', 'ui/components');
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    this.validatePath(oldPath, 'rename (old path)');
    this.validatePath(newPath, 'rename (new path)');

    if (!this.directoryHandle) {
      throw new FileSystemError(
        'No directory access granted. Call requestDirectoryAccess() first.',
        'NO_DIRECTORY_ACCESS'
      );
    }

    try {
      // Read the content from old location
      let content: string | null = null;
      let isDirectory = false;

      try {
        // Try to get as file first
        const fileHandle = await this.directoryHandle.getFileHandle(oldPath);
        const file = await fileHandle.getFile();
        content = await file.text();
      } catch (fileError) {
        // If not a file, try as directory
        try {
          await this.directoryHandle.getDirectoryHandle(oldPath);
          isDirectory = true;
        } catch (dirError) {
          throw new FileSystemError(`Path not found: ${oldPath}`, 'PATH_NOT_FOUND');
        }
      }

      // Create at new location
      if (isDirectory) {
        await this._createDirectory(newPath);

        // List and move contents recursively
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

      // Delete old location
      if (isDirectory) {
        await this.deleteDirectory(oldPath);
      } else {
        await this.deleteFile(oldPath);
      }
    } catch (error: any) {
      // Re-throw FileSystemError if it's already one
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

  /**
   * Parse a path into segments, handling both forward and backward slashes
   *
   * @param path - The path to parse
   * @returns Array of path segments
   * @private
   */
  private parsePathSegments(path: string): string[] {
    // Normalize path separators and split
    return path.replace(/\\/g, '/').split('/').filter(segment => segment.length > 0);
  }

  /**
   * Walk through directory segments to get the final directory handle
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
   * Get a file handle, optionally creating it, with support for multi-segment paths
   *
   * @param path - Relative path to the file (supports 'dir/subdir/file.txt')
   * @param create - Whether to create the file if it doesn't exist
   * @returns Promise that resolves to FileSystemFileHandle
   * @private
   */
  private async getFileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
    const segments = this.parsePathSegments(path);

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
   * Get a directory handle with support for multi-segment paths
   *
   * @param path - Relative path to the directory (supports 'dir/subdir')
   * @returns Promise that resolves to FileSystemDirectoryHandle
   * @private
   */
  private async _getDirectoryHandle(path: string): Promise<FileSystemDirectoryHandle> {
    const segments = this.parsePathSegments(path);

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
   * Create a directory with support for multi-segment paths
   *
   * @param path - Relative path to the directory (supports 'dir/subdir')
   * @returns Promise that resolves when directory is created
   * @private
   */
  private async _createDirectory(path: string): Promise<void> {
    this.validatePath(path, 'createDirectory');

    const segments = this.parsePathSegments(path);

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

// Export a singleton instance for convenience
export const localFS = new LocalFSAdapter();
