import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncManager } from './sync-manager';
import { LocalFSAdapter } from './local-fs-adapter';
import * as webcontainer from '../webcontainer';
import { createWorkspaceEventBus } from '../events';

// Mock WebContainer module
vi.mock('../webcontainer', () => ({
    boot: vi.fn(),
    mount: vi.fn(),
    getFileSystem: vi.fn(),
    isBooted: vi.fn(),
}));

// Mock LocalFSAdapter
vi.mock('./local-fs-adapter', () => {
    return {
        LocalFSAdapter: vi.fn().mockImplementation(() => ({
            listDirectory: vi.fn(),
            readFile: vi.fn(),
            writeFile: vi.fn(),
            deleteFile: vi.fn(),
            createDirectory: vi.fn(),
            deleteDirectory: vi.fn(),
        })),
    };
});

describe('SyncManager', () => {
    let syncManager: SyncManager;
    let mockAdapter: any;
    let mockFS: any;
    let eventBus: ReturnType<typeof createWorkspaceEventBus>;
    let emitSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup Mock Adapter
        mockAdapter = new LocalFSAdapter();
        eventBus = createWorkspaceEventBus();
        emitSpy = vi.spyOn(eventBus as any, 'emit');
        syncManager = new SyncManager(mockAdapter, {}, eventBus);

        // Setup WebContainer mocks
        vi.mocked(webcontainer.isBooted).mockReturnValue(true);
        mockFS = {
            writeFile: vi.fn(),
            mkdir: vi.fn(),
            rm: vi.fn(),
        };
        vi.mocked(webcontainer.getFileSystem).mockReturnValue(mockFS as any);
    });

    describe('syncToWebContainer', () => {
        it('should exclude .git and node_modules by default', async () => {
            // Mock directory structure
            mockAdapter.listDirectory.mockResolvedValue([
                { name: '.git', type: 'directory' },
                { name: 'node_modules', type: 'directory' },
                { name: 'src', type: 'directory' },
                { name: 'package.json', type: 'file' },
            ]);

            // Mock recursive calls for 'src'
            mockAdapter.listDirectory.mockImplementation((path: string) => {
                if (path === 'src') {
                    return Promise.resolve([{ name: 'index.ts', type: 'file' }]);
                }
                return Promise.resolve([
                    { name: '.git', type: 'directory' },
                    { name: 'node_modules', type: 'directory' },
                    { name: 'src', type: 'directory' },
                    { name: 'package.json', type: 'file' },
                ]);
            });

            mockAdapter.readFile.mockResolvedValue({ content: 'content' });

            await syncManager.syncToWebContainer();

            expect(emitSpy).toHaveBeenCalledWith('sync:started', {
                fileCount: expect.any(Number),
                direction: 'to-wc',
            });

            expect(emitSpy).toHaveBeenCalledWith('sync:completed', {
                success: true,
                timestamp: expect.any(Date),
                filesProcessed: expect.any(Number),
            });

            // Verify mount called with correct tree structure
            expect(webcontainer.mount).toHaveBeenCalledWith({
                'src': {
                    directory: {
                        'index.ts': { file: { contents: 'content' } },
                    },
                },
                'package.json': { file: { contents: 'content' } },
            });

            // Should NOT contain .git or node_modules
            const mountedTree = vi.mocked(webcontainer.mount).mock.calls[0][0];
            expect(mountedTree).not.toHaveProperty('.git');
            expect(mountedTree).not.toHaveProperty('node_modules');
        });

        it('should handle nested directory recursion', async () => {
            mockAdapter.listDirectory.mockImplementation(async (path: string) => {
                if (path === '') return [{ name: 'folder', type: 'directory' }];
                if (path === 'folder') return [{ name: 'file.txt', type: 'file' }];
                return [];
            });
            mockAdapter.readFile.mockResolvedValue({ content: 'data' });

            await syncManager.syncToWebContainer();

            expect(emitSpy).toHaveBeenCalledWith('sync:started', {
                fileCount: expect.any(Number),
                direction: 'to-wc',
            });

            expect(emitSpy).toHaveBeenCalledWith('sync:progress', {
                current: expect.any(Number),
                total: expect.any(Number),
                currentFile: 'folder/file.txt',
            });

            expect(emitSpy).toHaveBeenCalledWith('sync:completed', {
                success: true,
                timestamp: expect.any(Date),
                filesProcessed: expect.any(Number),
            });

            expect(webcontainer.mount).toHaveBeenCalledWith({
                folder: {
                    directory: {
                        'file.txt': { file: { contents: 'data' } }
                    }
                }
            });
        });

        it('should emit sync:error on file read failure (and still call onError callback)', async () => {
            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const onError = vi.fn();
            syncManager = new SyncManager(mockAdapter, { onError }, eventBus);

            mockAdapter.listDirectory.mockResolvedValue([{ name: 'bad.txt', type: 'file' }]);
            mockAdapter.readFile.mockRejectedValueOnce(new Error('boom'));

            await syncManager.syncToWebContainer();

            expect(onError).toHaveBeenCalledTimes(1);
            expect(emitSpy).toHaveBeenCalledWith('sync:error', {
                error: expect.any(Error),
                file: 'bad.txt',
            });

            consoleWarn.mockRestore();
        });
    });

    describe('writeFile', () => {
        it('should write to both local execution and WebContainer', async () => {
            await syncManager.writeFile('src/main.ts', 'console.log("hello")');

            // Check Local Write
            expect(mockAdapter.writeFile).toHaveBeenCalledWith('src/main.ts', 'console.log("hello")');

            // Check WebContainer Write
            expect(mockFS.writeFile).toHaveBeenCalledWith('src/main.ts', 'console.log("hello")');
        });

        it('should ensure parent directory exists in WebContainer', async () => {
            await syncManager.writeFile('src/utils/helper.ts', '...');

            // Should verify calling mkdir for parent
            expect(mockFS.mkdir).toHaveBeenCalledWith('src/utils', { recursive: true });
        });

        it('should emit sync events for single file write', async () => {
            await syncManager.writeFile('src/new.ts', 'data');

            expect(emitSpy).toHaveBeenCalledWith('sync:started', {
                fileCount: 1,
                direction: 'to-wc',
            });
            expect(emitSpy).toHaveBeenCalledWith('sync:completed', {
                success: true,
                timestamp: expect.any(Date),
                filesProcessed: 1,
            });
        });
    });

    describe('deleteFile', () => {
        it('should emit sync events for single file delete', async () => {
            await syncManager.deleteFile('src/old.ts');

            expect(emitSpy).toHaveBeenCalledWith('sync:started', {
                fileCount: 1,
                direction: 'to-wc',
            });
            expect(mockAdapter.deleteFile).toHaveBeenCalledWith('src/old.ts');
            expect(mockFS.rm).toHaveBeenCalledWith('src/old.ts');
            expect(emitSpy).toHaveBeenCalledWith('sync:completed', {
                success: true,
                timestamp: expect.any(Date),
                filesProcessed: 1,
            });
        });
    });

    describe('Concurrency', () => {
        it('should block concurrent sync calls', async () => {
            mockAdapter.listDirectory.mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 10)); // Slow down sync
                return [];
            });

            const sync1 = syncManager.syncToWebContainer();
            const sync2 = syncManager.syncToWebContainer();

            const [res1, res2] = await Promise.all([sync1, sync2]);

            // One should succeed, one should fail gracefully
            expect(res1.success).not.toBe(res2.success);

            // The failed one reflects "skipped" state (success: false, syncedFiles: 0)
            const failed = !res1.success ? res1 : res2;
            expect(failed.success).toBe(false);
            expect(failed.syncedFiles).toBe(0);
        });
    });

    describe('Exclusions', () => {
        it('should support custom glob patterns', async () => {
            syncManager.setExcludePatterns(['*.log']);

            mockAdapter.listDirectory.mockResolvedValue([
                { name: 'error.log', type: 'file' },
                { name: 'main.ts', type: 'file' }
            ]);
            mockAdapter.readFile.mockResolvedValue({ content: '' });

            await syncManager.syncToWebContainer();

            const tree = vi.mocked(webcontainer.mount).mock.calls[0][0];
            expect(tree).toHaveProperty('main.ts');
            expect(tree).not.toHaveProperty('error.log');
        });
    });
});
