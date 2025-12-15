import { describe, expect, it } from 'vitest';

import { FileSystemError } from '../fs-errors';
import { isTraversalAttempt, validatePath } from '../path-guard';

function getFileSystemError(fn: () => void): FileSystemError {
    try {
        fn();
    } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        return error as FileSystemError;
    }

    throw new Error('Expected function to throw');
}

describe('PathGuard', () => {
    describe('isTraversalAttempt', () => {
        it('should return true for paths that contain a .. segment', () => {
            expect(isTraversalAttempt('../secrets.txt')).toBe(true);
            expect(isTraversalAttempt('src/../secrets.txt')).toBe(true);
            expect(isTraversalAttempt('./..')).toBe(true);
            expect(isTraversalAttempt('..\\secrets.txt')).toBe(true);
        });

        it('should return false for paths that do not contain a .. segment', () => {
            expect(isTraversalAttempt('readme.txt')).toBe(false);
            expect(isTraversalAttempt('src/components/Button.tsx')).toBe(false);
            expect(isTraversalAttempt('file..txt')).toBe(false);
        });
    });

    describe('validatePath', () => {
        it('should throw INVALID_PATH for non-string or empty paths', () => {
            const error1 = getFileSystemError(() => validatePath(undefined as unknown as string, 'readFile'));
            expect(error1.code).toBe('INVALID_PATH');
            expect(error1.message).toBe('Path must be a non-empty string for readFile');

            const error2 = getFileSystemError(() => validatePath('', 'readFile'));
            expect(error2.code).toBe('INVALID_PATH');
            expect(error2.message).toBe('Path must be a non-empty string for readFile');

            const error3 = getFileSystemError(() => validatePath('   ', 'readFile'));
            expect(error3.code).toBe('INVALID_PATH');
            expect(error3.message).toBe('Path cannot be empty for readFile');
        });

        it('should throw ABSOLUTE_PATH for absolute POSIX or Windows paths', () => {
            const error1 = getFileSystemError(() => validatePath('/etc/passwd', 'readFile'));
            expect(error1.code).toBe('ABSOLUTE_PATH');
            expect(error1.message).toBe(
                'Invalid path for readFile. Use relative paths, not absolute paths.'
            );

            const error2 = getFileSystemError(() => validatePath('C:\\temp\\file.txt', 'readFile'));
            expect(error2.code).toBe('ABSOLUTE_PATH');
            expect(error2.message).toBe(
                'Invalid path for readFile. Use relative paths, not absolute paths.'
            );
        });

        it('should throw PATH_TRAVERSAL when .. is present as a standalone segment', () => {
            const error = getFileSystemError(() => validatePath('src/../secrets.txt', 'readFile'));
            expect(error.code).toBe('PATH_TRAVERSAL');
            expect(error.message).toBe(
                'Invalid path for readFile. Path traversal (../) is not allowed.'
            );
        });

        it('should allow safe relative paths', () => {
            expect(() => validatePath('readme.txt', 'readFile')).not.toThrow();
            expect(() => validatePath('src/components/Button.tsx', 'readFile')).not.toThrow();
            expect(() => validatePath('src\\components\\Button.tsx', 'readFile')).not.toThrow();
            expect(() => validatePath('file..txt', 'readFile')).not.toThrow();
        });
    });
});
