/**
 * @fileoverview Local File System Access Adapter
 * @module lib/filesystem/local-fs-adapter
 * 
 * Wraps the File System Access API to provide a clean interface
 * for requesting and managing access to local folders.
 * 
 * Defines the main LocalFSAdapter class which delegates specialized operations
 * to helper modules while maintaining state and API compatibility.
 */

// Re-export types and errors for backward compatibility
export { FileSystemError, PermissionDeniedError } from './fs-errors';
export type { DirectoryEntry, FileReadResult, FileReadBinaryResult } from './fs-types';

import { FileSystemError, PermissionDeniedError } from './fs-errors';
import type { DirectoryEntry, FileReadResult, FileReadBinaryResult } from './fs-types';
import * as fileOps from './file-ops';
import * as dirOps from './dir-ops';

/**
 * Local File System Access Adapter
 *
 * Provides a clean wrapper around the File System Access API with:
 * - Proper error handling
 * - Type safety
 * - Security validation
 * - Browser compatibility checks
 */
export class LocalFSAdapter {
  /** Current directory handle from File System Access API */
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  /**
   * Check if File System Access API is supported.
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  /**
   * Request directory access from the user.
   */
  async requestDirectoryAccess(): Promise<FileSystemDirectoryHandle> {
    if (!LocalFSAdapter.isSupported()) {
      throw new FileSystemError(
        'File System Access API is not supported in this browser.',
        'API_NOT_SUPPORTED'
      );
    }

    try {
      const handle = await window.showDirectoryPicker();
      this.directoryHandle = handle;
      return handle;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new PermissionDeniedError('Directory selection was cancelled.');
      }
      if (error.name === 'NotAllowedError') {
        throw new PermissionDeniedError('Permission was denied.');
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
   */
  getDirectoryHandle(): FileSystemDirectoryHandle | null {
    return this.directoryHandle;
  }

  /**
   * Set the directory handle directly.
   */
  setDirectoryHandle(handle: FileSystemDirectoryHandle): void {
    this.directoryHandle = handle;
  }

  /**
   * Ensure directory access is granted.
   * @private
   */
  private ensureAccess(): FileSystemDirectoryHandle {
    if (!this.directoryHandle) {
      throw new FileSystemError(
        'No directory access granted. Call requestDirectoryAccess() first.',
        'NO_DIRECTORY_ACCESS'
      );
    }
    return this.directoryHandle;
  }

  // ============================================================================
  // File Operations (Delegated to file-ops)
  // ============================================================================

  /**
   * Read a file from the directory.
   */
  async readFile(path: string, options?: { encoding?: 'utf-8' }): Promise<FileReadResult>;
  async readFile(path: string, options: { encoding: 'binary' }): Promise<FileReadBinaryResult>;
  async readFile(
    path: string,
    options: { encoding?: 'utf-8' | 'binary' } = { encoding: 'utf-8' }
  ): Promise<FileReadResult | FileReadBinaryResult> {
    const root = this.ensureAccess();
    if (options.encoding === 'binary') {
      return fileOps.readFile(root, path, { encoding: 'binary' });
    }
    return fileOps.readFile(root, path, { encoding: 'utf-8' });
  }

  /**
   * Write a file to the directory.
   */
  async writeFile(path: string, content: string): Promise<void> {
    const root = this.ensureAccess();
    return fileOps.writeFile(root, path, content);
  }

  /**
   * Create a new file in the directory.
   */
  async createFile(path: string, content = ''): Promise<void> {
    await this.writeFile(path, content);
  }

  /**
   * Delete a file from the directory.
   */
  async deleteFile(path: string): Promise<void> {
    const root = this.ensureAccess();
    return fileOps.deleteFile(root, path);
  }

  // ============================================================================
  // Directory Operations (Delegated to dir-ops)
  // ============================================================================

  /**
   * List contents of a directory.
   */
  async listDirectory(path: string = ''): Promise<DirectoryEntry[]> {
    const root = this.ensureAccess();
    return dirOps.listDirectory(root, path);
  }

  /**
   * Create a new directory.
   */
  async createDirectory(path: string): Promise<void> {
    const root = this.ensureAccess();
    return dirOps.createDirectory(root, path);
  }

  /**
   * Delete a directory.
   */
  async deleteDirectory(path: string): Promise<void> {
    const root = this.ensureAccess();
    return dirOps.deleteDirectory(root, path);
  }

  /**
   * Rename a file or directory.
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    const root = this.ensureAccess();
    return dirOps.rename(root, oldPath, newPath);
  }
}

export const localFS = new LocalFSAdapter();
