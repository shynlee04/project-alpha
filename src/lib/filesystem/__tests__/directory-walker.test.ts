import { describe, expect, it, vi } from 'vitest';

import { FileSystemError } from '../fs-errors';
import { walkDirectory, walkDirectorySegments } from '../directory-walker';

describe('DirectoryWalker', () => {
    describe('walkDirectorySegments', () => {
        it('should throw NO_DIRECTORY_ACCESS when root is null', async () => {
            await expect(walkDirectorySegments(null, ['src'])).rejects.toBeInstanceOf(FileSystemError);
        });

        it('should walk nested segments using getDirectoryHandle', async () => {
            const leaf = { kind: 'directory', name: 'leaf' } as any;
            const mid = { kind: 'directory', name: 'mid', getDirectoryHandle: vi.fn().mockResolvedValue(leaf) } as any;
            const root = { kind: 'directory', name: 'root', getDirectoryHandle: vi.fn().mockResolvedValue(mid) } as any;

            const result = await walkDirectorySegments(root, ['a', 'b']);

            expect(root.getDirectoryHandle).toHaveBeenCalledWith('a', { create: false });
            expect(mid.getDirectoryHandle).toHaveBeenCalledWith('b', { create: false });
            expect(result).toBe(leaf);
        });
    });

    describe('walkDirectory', () => {
        it('should yield entries with sorted paths (directories then files by name)', async () => {
            const adapter = {
                listDirectory: vi.fn().mockResolvedValue([
                    { name: 'z.txt', type: 'file', handle: { kind: 'file', name: 'z.txt' } as any },
                    { name: 'b-dir', type: 'directory', handle: { kind: 'directory', name: 'b-dir' } as any },
                    { name: 'a.txt', type: 'file', handle: { kind: 'file', name: 'a.txt' } as any },
                ]),
            };

            const results: Array<{ path: string; type: string }> = [];
            for await (const entry of walkDirectory(adapter as any, '', { recursive: false })) {
                results.push({ path: entry.path, type: entry.type });
            }

            expect(results).toEqual([
                { path: 'a.txt', type: 'file' },
                { path: 'b-dir', type: 'directory' },
                { path: 'z.txt', type: 'file' },
            ]);
        });

        it('should recurse into subdirectories by default', async () => {
            const adapter = {
                listDirectory: vi.fn().mockImplementation(async (path: string) => {
                    if (path === '') {
                        return [
                            { name: 'child', type: 'directory', handle: { kind: 'directory', name: 'child' } as any },
                        ];
                    }
                    if (path === 'child') {
                        return [
                            { name: 'child.txt', type: 'file', handle: { kind: 'file', name: 'child.txt' } as any },
                        ];
                    }
                    return [];
                }),
            };

            const paths: string[] = [];
            for await (const entry of walkDirectory(adapter as any, '')) {
                paths.push(entry.path);
            }

            expect(paths).toEqual(['child', 'child/child.txt']);
        });

        it('should respect skipDirectory()', async () => {
            const adapter = {
                listDirectory: vi.fn().mockImplementation(async (path: string) => {
                    if (path === '') {
                        return [
                            { name: 'skipme', type: 'directory', handle: { kind: 'directory', name: 'skipme' } as any },
                        ];
                    }
                    if (path === 'skipme') {
                        return [
                            { name: 'inside.txt', type: 'file', handle: { kind: 'file', name: 'inside.txt' } as any },
                        ];
                    }
                    return [];
                }),
            };

            const paths: string[] = [];
            for await (const entry of walkDirectory(adapter as any, '', {
                skipDirectory: ({ name }: { name: string }) => name === 'skipme',
            })) {
                paths.push(entry.path);
            }

            expect(paths).toEqual(['skipme']);
        });
    });
});
