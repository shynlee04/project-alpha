/**
 * @fileoverview File System Error Classes
 * @module lib/filesystem/fs-errors
 * 
 * Custom error classes for File System Access API operations.
 * Provides structured error handling with error codes and causes.
 * 
 * @example
 * ```typescript
 * import { FileSystemError, PermissionDeniedError } from './fs-errors';
 * 
 * try {
 *   await someOperation();
 * } catch (error) {
 *   if (error instanceof PermissionDeniedError) {
 *     // Handle permission denied specifically
 *   } else if (error instanceof FileSystemError) {
 *     console.error(`FS Error [${error.code}]: ${error.message}`);
 *   }
 * }
 * ```
 */

/**
 * Base error class for File System Access operations.
 * 
 * Provides a structured error format with:
 * - Error message for display
 * - Error code for programmatic handling
 * - Original cause for debugging
 * 
 * @class FileSystemError
 * @extends Error
 * 
 * @example
 * ```typescript
 * throw new FileSystemError('File not found', 'FILE_NOT_FOUND');
 * ```
 */
export class FileSystemError extends Error {
    /**
     * Creates a new FileSystemError.
     * 
     * @param message - Human-readable error message
     * @param code - Error code for programmatic handling (e.g., 'FILE_NOT_FOUND', 'PATH_TRAVERSAL')
     * @param cause - Optional underlying error that caused this error
     */
    constructor(
        message: string,
        public readonly code: string,
        public readonly cause?: unknown
    ) {
        super(message);
        this.name = 'FileSystemError';
    }
}

/**
 * Error class for user-facing permission errors.
 * 
 * Used when the user denies access or cancels the file picker dialog.
 * This error should be shown to the user with a friendly message.
 * 
 * @class PermissionDeniedError
 * @extends FileSystemError
 * 
 * @example
 * ```typescript
 * throw new PermissionDeniedError('Please grant access to continue.');
 * ```
 */
export class PermissionDeniedError extends FileSystemError {
    /**
     * Creates a new PermissionDeniedError.
     * 
     * @param message - Optional custom message (defaults to generic prompt message)
     */
    constructor(message = 'Permission was denied. Please try again.') {
        super(message, 'PERMISSION_DENIED');
        this.name = 'PermissionDeniedError';
    }
}
