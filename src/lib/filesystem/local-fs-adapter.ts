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

      // Check for absolute path indicators
      if (i === 0 && (segment.startsWith('/') || (segment.length > 1 && segment[1] === ':'))) {
        throw new FileSystemError(
          `Invalid path for ${operation}. Use relative paths, not absolute paths.`,
          'ABSOLUTE_PATH'
        );
      }
    }
  }

  /**
   * Request directory access from the user
   *
   * @returns Promise that resolves to a FileSystemDirectoryHandle
   * @throws {FileSystemError} if API not supported
   * @throws {PermissionDeniedError} if user denies access
   * @throws {AbortError} if user cancels the picker
   * @throws {FileSystemError} for other errors
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

  /**
   * Read a file from the directory
   *
   * @param path - Relative path to the file within the directory
   * @param options - Options for reading the file
   * @param options.encoding - 'utf-8' for text files, 'binary' for binary files
   * @returns Promise that resolves to file content
   * @throws {FileSystemError} if file doesn't exist or can't be read
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
   * @param path - Relative path to the file within the directory
   * @param content - File content as string
   * @returns Promise that resolves when file is written
   * @throws {FileSystemError} if file can't be written
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
   * @param path - Relative path to the file within the directory
   * @returns Promise that resolves when file is deleted
   * @throws {FileSystemError} if file can't be deleted
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
   * @param path - Relative path to the directory (defaults to root)
   * @returns Promise that resolves to array of directory entries
   * @throws {FileSystemError} if directory doesn't exist or can't be read
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
   * @param path - Relative path to the directory within the directory
   * @returns Promise that resolves when directory is created
   * @throws {FileSystemError} if directory can't be created
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
   * @param path - Relative path to the directory within the directory
   * @returns Promise that resolves when directory is deleted
   * @throws {FileSystemError} if directory can't be deleted
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
   * @param oldPath - Current relative path
   * @param newPath - New relative path
   * @returns Promise that resolves when renamed
   * @throws {FileSystemError} if rename fails
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
