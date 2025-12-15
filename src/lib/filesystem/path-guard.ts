import { FileSystemError } from './fs-errors';

export function isTraversalAttempt(path: string): boolean {
    if (!path || typeof path !== 'string') {
        return false;
    }

    const normalized = path.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(s => s.length > 0);

    for (let i = 0; i < segments.length; i++) {
        if (segments[i] === '..') {
            return true;
        }
    }

    return false;
}

export function validatePath(path: string, operation: string): void {
    if (!path || typeof path !== 'string') {
        throw new FileSystemError(
            `Path must be a non-empty string for ${operation}`,
            'INVALID_PATH'
        );
    }

    const trimmed = path.trim();
    if (trimmed.length === 0) {
        throw new FileSystemError(
            `Path cannot be empty for ${operation}`,
            'INVALID_PATH'
        );
    }

    const normalized = path.replace(/\\/g, '/');

    if (normalized.startsWith('/')) {
        throw new FileSystemError(
            `Invalid path for ${operation}. Use relative paths, not absolute paths.`,
            'ABSOLUTE_PATH'
        );
    }

    if (normalized.length > 1 && normalized[1] === ':') {
        throw new FileSystemError(
            `Invalid path for ${operation}. Use relative paths, not absolute paths.`,
            'ABSOLUTE_PATH'
        );
    }

    if (isTraversalAttempt(normalized)) {
        throw new FileSystemError(
            `Invalid path for ${operation}. Path traversal (../) is not allowed.`,
            'PATH_TRAVERSAL'
        );
    }
}
