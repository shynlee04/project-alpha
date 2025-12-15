/**
 * Exclusion Configuration Module
 * @module lib/filesystem/exclusion-config
 *
 * Story 10-5: Create Sync Exclusion Configuration
 *
 * This module provides utilities for managing sync exclusion patterns,
 * including default patterns, pattern validation, and matching.
 */

import { DEFAULT_SYNC_CONFIG } from './sync-types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default exclusion patterns that are always applied.
 * These represent common patterns that should never be synced.
 */
export const DEFAULT_EXCLUSION_PATTERNS: readonly string[] = [
    '.git',
    'node_modules',
    '.DS_Store',
    'Thumbs.db',
] as const;

/**
 * Extended default patterns including editor swap files and env files.
 */
export const EXTENDED_DEFAULT_PATTERNS: readonly string[] = [
    ...DEFAULT_EXCLUSION_PATTERNS,
    '*.swp',
    '*.swo',
    '.env.local',
    '.env.*.local',
] as const;

// ============================================================================
// Pattern Matching
// ============================================================================

/**
 * Check if a path matches any of the exclusion patterns.
 *
 * Supports:
 * - Exact matches: 'node_modules', '.git'
 * - Simple glob patterns: '*.log', '*.swp'
 * - Path prefix patterns: 'dist/**'
 *
 * @param path - Full relative path to check
 * @param patterns - Array of exclusion patterns
 * @returns true if the path should be excluded
 */
export function isPathExcluded(path: string, patterns: string[]): boolean {
    const name = path.split('/').pop() || path;

    return patterns.some((pattern) => {
        // Check if pattern contains glob wildcard
        if (pattern.includes('*')) {
            // Simple glob pattern matching
            const regexPattern = pattern
                .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
                .replace(/\*\*/g, '{{GLOBSTAR}}') // Temporarily replace **
                .replace(/\*/g, '[^/]*') // * matches anything except /
                .replace(/{{GLOBSTAR}}/g, '.*'); // ** matches anything including /

            const regex = new RegExp(`^${regexPattern}$`, 'i');
            return regex.test(name) || regex.test(path);
        }

        // Exact match on name or path, or path starts with pattern/
        return name === pattern || path === pattern || path.startsWith(`${pattern}/`);
    });
}

/**
 * Merge custom patterns with default patterns, removing duplicates.
 *
 * @param customPatterns - User-defined custom patterns
 * @param includeExtended - Whether to include extended defaults (swap files, etc.)
 * @returns Merged array of unique patterns
 */
export function mergeExclusionPatterns(
    customPatterns: string[] = [],
    includeExtended = true
): string[] {
    const defaults = includeExtended
        ? [...EXTENDED_DEFAULT_PATTERNS]
        : [...DEFAULT_EXCLUSION_PATTERNS];

    const merged = new Set([...defaults, ...customPatterns]);
    return Array.from(merged);
}

/**
 * Validate an exclusion pattern.
 *
 * @param pattern - Pattern to validate
 * @returns Object with isValid and optional error message
 */
export function validateExclusionPattern(pattern: string): {
    isValid: boolean;
    error?: string;
} {
    if (!pattern || pattern.trim().length === 0) {
        return { isValid: false, error: 'Pattern cannot be empty' };
    }

    if (pattern.length > 256) {
        return { isValid: false, error: 'Pattern is too long (max 256 characters)' };
    }

    // Check for invalid characters
    const invalidChars = /[<>:"|?]/;
    if (invalidChars.test(pattern)) {
        return { isValid: false, error: 'Pattern contains invalid characters' };
    }

    return { isValid: true };
}

/**
 * Parse patterns from a string (one per line or comma-separated).
 *
 * @param input - Raw input string
 * @returns Array of trimmed, non-empty patterns
 */
export function parsePatternInput(input: string): string[] {
    return input
        .split(/[,\n]/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
}

/**
 * Format patterns for display (one per line).
 *
 * @param patterns - Array of patterns
 * @returns Formatted string
 */
export function formatPatternsForDisplay(patterns: string[]): string {
    return patterns.join('\n');
}

// ============================================================================
// Export default config for convenience
// ============================================================================

export { DEFAULT_SYNC_CONFIG };
