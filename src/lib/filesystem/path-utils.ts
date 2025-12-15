/**
 * @fileoverview Path Validation and Parsing Utilities
 * @module lib/filesystem/path-utils
 * 
 * Utilities for validating and parsing file system paths.
 * Provides security checks for path traversal attacks and
 * cross-platform path normalization.
 * 
 * @example
 * ```typescript
 * import { validatePath, parsePathSegments } from './path-utils';
 * 
 * // Validate before any file operation
 * validatePath('src/components/Button.tsx', 'readFile');
 * 
 * // Parse path into segments
 * const segments = parsePathSegments('src/components/Button.tsx');
 * // ['src', 'components', 'Button.tsx']
 * ```
 */

import { FileSystemError } from './fs-errors';

/**
 * Validates a file/directory path to prevent security issues.
 * 
 * Checks for:
 * - Empty or non-string paths
 * - Path traversal attacks (../)
 * - Absolute paths (must use relative paths only)
 * 
 * @param path - The path to validate
 * @param operation - The operation being performed (for error messages)
 * @throws {FileSystemError} INVALID_PATH if path is empty or invalid type
 * @throws {FileSystemError} PATH_TRAVERSAL if path contains '..'
 * @throws {FileSystemError} ABSOLUTE_PATH if path is absolute
 * 
 * @example
 * ```typescript
 * // Valid paths
 * validatePath('readme.txt', 'readFile'); // OK
 * validatePath('src/components/Button.tsx', 'readFile'); // OK
 * 
 * // Invalid paths
 * validatePath('../secrets.txt', 'readFile'); // Throws PATH_TRAVERSAL
 * validatePath('/etc/passwd', 'readFile'); // Throws ABSOLUTE_PATH
 * validatePath('', 'readFile'); // Throws INVALID_PATH
 * ```
 */
export function validatePath(path: string, operation: string): void {
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
 * Parses a path into segments, handling both forward and backward slashes.
 * 
 * Normalizes path separators and splits the path into individual
 * directory/file name segments. Empty segments are filtered out.
 * 
 * @param path - The path to parse
 * @returns Array of path segments (directory/file names)
 * 
 * @example
 * ```typescript
 * parsePathSegments('src/components/Button.tsx');
 * // Returns: ['src', 'components', 'Button.tsx']
 * 
 * parsePathSegments('src\\components\\Button.tsx'); // Windows-style
 * // Returns: ['src', 'components', 'Button.tsx']
 * 
 * parsePathSegments('folder//file.txt'); // Double slashes
 * // Returns: ['folder', 'file.txt']
 * ```
 */
export function parsePathSegments(path: string): string[] {
    // Normalize path separators and split
    return path.replace(/\\/g, '/').split('/').filter(segment => segment.length > 0);
}
