/**
 * @fileoverview Tests for Exclusion Configuration Module
 * Story 10-5: Create Sync Exclusion Configuration
 */

import { describe, it, expect } from 'vitest';
import {
    DEFAULT_EXCLUSION_PATTERNS,
    EXTENDED_DEFAULT_PATTERNS,
    isPathExcluded,
    mergeExclusionPatterns,
    validateExclusionPattern,
    parsePatternInput,
    formatPatternsForDisplay,
} from '../exclusion-config';

describe('Exclusion Config', () => {
    describe('DEFAULT_EXCLUSION_PATTERNS', () => {
        it('should include common exclusions', () => {
            expect(DEFAULT_EXCLUSION_PATTERNS).toContain('.git');
            expect(DEFAULT_EXCLUSION_PATTERNS).toContain('node_modules');
            expect(DEFAULT_EXCLUSION_PATTERNS).toContain('.DS_Store');
            expect(DEFAULT_EXCLUSION_PATTERNS).toContain('Thumbs.db');
        });
    });

    describe('EXTENDED_DEFAULT_PATTERNS', () => {
        it('should include all default patterns', () => {
            for (const pattern of DEFAULT_EXCLUSION_PATTERNS) {
                expect(EXTENDED_DEFAULT_PATTERNS).toContain(pattern);
            }
        });

        it('should include swap and env patterns', () => {
            expect(EXTENDED_DEFAULT_PATTERNS).toContain('*.swp');
            expect(EXTENDED_DEFAULT_PATTERNS).toContain('*.swo');
            expect(EXTENDED_DEFAULT_PATTERNS).toContain('.env.local');
        });
    });

    describe('isPathExcluded', () => {
        it('should match exact directory names', () => {
            expect(isPathExcluded('node_modules', ['node_modules'])).toBe(true);
            expect(isPathExcluded('.git', ['.git'])).toBe(true);
            expect(isPathExcluded('src', ['.git'])).toBe(false);
        });

        it('should match paths inside excluded directories', () => {
            expect(isPathExcluded('node_modules/lodash/package.json', ['node_modules'])).toBe(true);
            expect(isPathExcluded('.git/config', ['.git'])).toBe(true);
        });

        it('should match simple glob patterns', () => {
            expect(isPathExcluded('debug.log', ['*.log'])).toBe(true);
            expect(isPathExcluded('error.log', ['*.log'])).toBe(true);
            expect(isPathExcluded('debug.txt', ['*.log'])).toBe(false);
        });

        it('should match swap file patterns', () => {
            expect(isPathExcluded('.index.tsx.swp', ['*.swp'])).toBe(true);
            expect(isPathExcluded('backup.swp', ['*.swp'])).toBe(true);
        });

        it('should match env file patterns', () => {
            expect(isPathExcluded('.env.local', ['.env.local'])).toBe(true);
            expect(isPathExcluded('.env.production.local', ['.env.*.local'])).toBe(true);
        });

        it('should return false for empty pattern list', () => {
            expect(isPathExcluded('anything.txt', [])).toBe(false);
        });

        it('should match case-insensitively', () => {
            expect(isPathExcluded('FILE.LOG', ['*.log'])).toBe(true);
        });
    });

    describe('mergeExclusionPatterns', () => {
        it('should merge custom patterns with defaults', () => {
            const custom = ['*.bak', 'temp/'];
            const merged = mergeExclusionPatterns(custom, false);

            expect(merged).toContain('.git');
            expect(merged).toContain('node_modules');
            expect(merged).toContain('*.bak');
            expect(merged).toContain('temp/');
        });

        it('should deduplicate patterns', () => {
            const custom = ['.git', '.DS_Store']; // Already in defaults
            const merged = mergeExclusionPatterns(custom, false);

            const gitCount = merged.filter(p => p === '.git').length;
            expect(gitCount).toBe(1);
        });

        it('should include extended patterns when specified', () => {
            const merged = mergeExclusionPatterns([], true);
            expect(merged).toContain('*.swp');
        });

        it('should work with empty custom patterns', () => {
            const merged = mergeExclusionPatterns();
            expect(merged.length).toBeGreaterThan(0);
        });
    });

    describe('validateExclusionPattern', () => {
        it('should accept valid patterns', () => {
            expect(validateExclusionPattern('.git').isValid).toBe(true);
            expect(validateExclusionPattern('*.log').isValid).toBe(true);
            expect(validateExclusionPattern('dist/**').isValid).toBe(true);
        });

        it('should reject empty patterns', () => {
            expect(validateExclusionPattern('').isValid).toBe(false);
            expect(validateExclusionPattern('   ').isValid).toBe(false);
        });

        it('should reject patterns that are too long', () => {
            const longPattern = 'a'.repeat(300);
            expect(validateExclusionPattern(longPattern).isValid).toBe(false);
        });

        it('should reject patterns with invalid characters', () => {
            expect(validateExclusionPattern('file<name>.txt').isValid).toBe(false);
            expect(validateExclusionPattern('path|file').isValid).toBe(false);
        });
    });

    describe('parsePatternInput', () => {
        it('should parse comma-separated patterns', () => {
            const result = parsePatternInput('.git, node_modules, *.log');
            expect(result).toEqual(['.git', 'node_modules', '*.log']);
        });

        it('should parse newline-separated patterns', () => {
            const result = parsePatternInput('.git\nnode_modules\n*.log');
            expect(result).toEqual(['.git', 'node_modules', '*.log']);
        });

        it('should filter empty lines', () => {
            const result = parsePatternInput('.git\n\nnode_modules\n');
            expect(result).toEqual(['.git', 'node_modules']);
        });

        it('should trim whitespace', () => {
            const result = parsePatternInput('  .git  , node_modules  ');
            expect(result).toEqual(['.git', 'node_modules']);
        });
    });

    describe('formatPatternsForDisplay', () => {
        it('should join patterns with newlines', () => {
            const result = formatPatternsForDisplay(['.git', 'node_modules']);
            expect(result).toBe('.git\nnode_modules');
        });

        it('should handle empty array', () => {
            expect(formatPatternsForDisplay([])).toBe('');
        });
    });
});
