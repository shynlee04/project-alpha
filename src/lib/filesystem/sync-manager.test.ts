import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncManager } from './sync-manager';
import { LocalFSAdapter } from './local-fs-adapter';
import * as webcontainer from '../webcontainer';

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

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup Mock Adapter
        mockAdapter = new LocalFSAdapter();
        syncManager = new SyncManager(mockAdapter);

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

            expect(webcontainer.mount).toHaveBeenCalledWith({
                folder: {
                    directory: {
                        'file.txt': { file: { contents: 'data' } }
                    }
                }
            });
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
