import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSyncPlan } from '../sync-executor';
import type { LocalFSAdapter } from '../local-fs-adapter';
import type { SyncConfig, SyncPlan } from '../sync-types';
import { createWorkspaceEventBus } from '../../events';
import * as WebContainerModule from '../../webcontainer';

// Mock WebContainer
vi.mock('../../webcontainer', () => ({
    isBooted: vi.fn(),
    getFileSystem: vi.fn(),
    mount: vi.fn()
}));

describe('SyncExecutor', () => {
    let mockAdapter: LocalFSAdapter;
    let mockConfig: SyncConfig;
    let mockEventBus: ReturnType<typeof createWorkspaceEventBus>;
    let mockFs: { writeFile: any; rm: any; mkdir: any };

    beforeEach(() => {
        // Reset mocks
        vi.resetAllMocks();

        // Setup mock adapter
        mockAdapter = {
            readFile: vi.fn(),
            // other methods not needed for execution
        } as any;

        // Setup mock config
        mockConfig = {
            excludePatterns: [],
            onProgress: vi.fn(),
            onError: vi.fn(),
            onComplete: vi.fn()
        };

        // Setup mock EventBus
        mockEventBus = createWorkspaceEventBus();
        vi.spyOn(mockEventBus, 'emit');

        // Setup mock WebContainer FS
        mockFs = {
            writeFile: vi.fn().mockResolvedValue(undefined),
            rm: vi.fn().mockResolvedValue(undefined),
            mkdir: vi.fn().mockResolvedValue(undefined),
            readdir: vi.fn(),
            readFile: vi.fn(),
            rename: vi.fn(),
            watch: vi.fn()
        } as any;

        vi.mocked(WebContainerModule.isBooted).mockReturnValue(true);
        vi.mocked(WebContainerModule.getFileSystem).mockReturnValue(mockFs);
    });

    it('should throw if WebContainer is not booted', async () => {
        vi.mocked(WebContainerModule.isBooted).mockReturnValue(false);

        const plan: SyncPlan = {
            sourceRoot: '',
            items: [],
            stats: { totalFiles: 0, totalDirectories: 0 }
        };

        await expect(executeSyncPlan(plan, mockAdapter, mockConfig, mockEventBus))
            .rejects.toThrow('WebContainer not booted');
    });

    it('should execute "add file" operation correctly', async () => {
        const plan: SyncPlan = {
            sourceRoot: '',
            items: [
                { path: 'src/index.ts', type: 'file', operation: 'add' }
            ],
            stats: { totalFiles: 1, totalDirectories: 0 }
        };

        vi.mocked(mockAdapter.readFile).mockResolvedValue('console.log("hello")' as any);

        const result = await executeSyncPlan(plan, mockAdapter, mockConfig, mockEventBus);

        expect(result.success).toBe(true);
        expect(result.syncedFiles).toBe(1);
        expect(mockAdapter.readFile).toHaveBeenCalledWith('src/index.ts');
        expect(mockFs.writeFile).toHaveBeenCalledWith('src/index.ts', 'console.log("hello")');

        // Verify events
        expect(mockEventBus.emit).toHaveBeenCalledWith('sync:started', expect.anything());
        expect(mockEventBus.emit).toHaveBeenCalledWith('sync:progress', expect.objectContaining({
            currentFile: 'src/index.ts'
        }));
        expect(mockEventBus.emit).toHaveBeenCalledWith('sync:completed', expect.objectContaining({
            success: true
        }));
    });

    it('should execute "delete file" operation correctly', async () => {
        const plan: SyncPlan = {
            sourceRoot: '',
            items: [
                { path: 'unused.ts', type: 'file', operation: 'delete' }
            ],
            stats: { totalFiles: 1, totalDirectories: 0 }
        };

        const result = await executeSyncPlan(plan, mockAdapter, mockConfig, mockEventBus);

        expect(result.success).toBe(true);
        expect(mockFs.rm).toHaveBeenCalledWith('unused.ts', { recursive: false });
    });

    it('should execute "add directory" operation correctly', async () => {
        const plan: SyncPlan = {
            sourceRoot: '',
            items: [
                { path: 'src/utils', type: 'directory', operation: 'add' }
            ],
            stats: { totalFiles: 0, totalDirectories: 1 }
        };

        const result = await executeSyncPlan(plan, mockAdapter, mockConfig, mockEventBus);

        expect(result.success).toBe(true);
        expect(mockFs.mkdir).toHaveBeenCalledWith('src/utils', { recursive: true });
    });

    it('should handle read failures gracefully (partial failure)', async () => {
        const plan: SyncPlan = {
            sourceRoot: '',
            items: [
                { path: 'bad.ts', type: 'file', operation: 'add' },
                { path: 'good.ts', type: 'file', operation: 'add' }
            ],
            stats: { totalFiles: 2, totalDirectories: 0 }
        };

        vi.mocked(mockAdapter.readFile).mockRejectedValueOnce(new Error('Read failed'));
        vi.mocked(mockAdapter.readFile).mockResolvedValueOnce('ok' as any);

        const result = await executeSyncPlan(plan, mockAdapter, mockConfig, mockEventBus);

        // Overall success is true because it completed the loop, but failedFiles is populated
        expect(result.success).toBe(true);
        expect(result.failedFiles).toContain('bad.ts');
        expect(result.syncedFiles).toBe(1); // Only good.ts synced

        expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
        expect(mockFs.writeFile).toHaveBeenCalledWith('good.ts', 'ok');

        expect(mockEventBus.emit).toHaveBeenCalledWith('sync:error', expect.anything());
    });
});
