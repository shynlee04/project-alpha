import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planSync } from '../sync-planner';
import type { LocalFSAdapter } from '../local-fs-adapter';

describe('planSync', () => {
    const mockListDirectory = vi.fn();
    const mockAdapter = {
        listDirectory: mockListDirectory
    } as unknown as LocalFSAdapter;

    beforeEach(() => {
        mockListDirectory.mockReset();
    });

    /**
     * Helper to mock file system structure
     */
    function mockFileSystem(structure: Record<string, Array<{ name: string; type: 'file' | 'directory' }>>) {
        mockListDirectory.mockImplementation(async (path: string) => {
            return structure[path] || [];
        });
    }

    it('should generate a plan for a flat directory', async () => {
        mockFileSystem({
            '': [
                { name: 'file1.txt', type: 'file' },
                { name: 'file2.js', type: 'file' }
            ]
        });

        const plan = await planSync(mockAdapter, '', { excludePatterns: [] });

        expect(plan.sourceRoot).toBe('');
        expect(plan.stats.totalFiles).toBe(2);
        expect(plan.stats.totalDirectories).toBe(0);
        expect(plan.items).toHaveLength(2);
        expect(plan.items).toContainEqual({
            path: 'file1.txt',
            type: 'file',
            operation: 'add'
        });
    });

    it('should generate a recursive plan', async () => {
        mockFileSystem({
            '': [
                { name: 'root.txt', type: 'file' },
                { name: 'src', type: 'directory' }
            ],
            'src': [
                { name: 'main.ts', type: 'file' }
            ]
        });

        const plan = await planSync(mockAdapter, '', { excludePatterns: [] });

        expect(plan.stats.totalFiles).toBe(2);
        expect(plan.stats.totalDirectories).toBe(1);
        expect(plan.items).toEqual(expect.arrayContaining([
            { path: 'root.txt', type: 'file', operation: 'add' },
            { path: 'src', type: 'directory', operation: 'add' },
            { path: 'src/main.ts', type: 'file', operation: 'add' }
        ]));
    });

    it('should exclude files and directories based on patterns', async () => {
        mockFileSystem({
            '': [
                { name: 'keep.txt', type: 'file' },
                { name: 'ignore.log', type: 'file' },
                { name: 'node_modules', type: 'directory' },
                { name: 'src', type: 'directory' }
            ],
            'node_modules': [
                { name: 'pkg.json', type: 'file' } // Should not be visited
            ],
            'src': [
                { name: 'code.ts', type: 'file' },
                { name: 'test.log', type: 'file' }
            ]
        });

        const plan = await planSync(mockAdapter, '', {
            excludePatterns: ['*.log', 'node_modules']
        });

        // node_modules should be excluded entirely (not visited)
        // src/test.log should be excluded (visited but filtered)
        // src/code.ts should be included

        expect(plan.items).toEqual(expect.arrayContaining([
            { path: 'keep.txt', type: 'file', operation: 'add' },
            { path: 'src', type: 'directory', operation: 'add' },
            { path: 'src/code.ts', type: 'file', operation: 'add' }
        ]));

        expect(plan.items.find(i => i.path === 'ignore.log')).toBeUndefined();
        expect(plan.items.find(i => i.path.includes('node_modules'))).toBeUndefined();
        expect(plan.items.find(i => i.path === 'src/test.log')).toBeUndefined();

        // Ensure node_modules was strictly NOT visited to save I/O
        expect(mockListDirectory).not.toHaveBeenCalledWith('node_modules');
        expect(mockListDirectory).toHaveBeenCalledWith('src');
    });

    it('should handle empty directories', async () => {
        mockFileSystem({
            '': []
        });

        const plan = await planSync(mockAdapter, '', {});
        expect(plan.items).toHaveLength(0);
        expect(plan.stats.totalFiles).toBe(0);
    });
});
