// @vitest-environment jsdom
/**
 * Unit tests for WorkspaceContext
 *
 * Story 3-8: Implement Workspace Context
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useWorkspace, WorkspaceProvider, type WorkspaceProviderProps } from './WorkspaceContext';
import type { ProjectMetadata } from './project-store';

// Mock TanStack Router
const { mockNavigate } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => mockNavigate,
}));

// Mock project-store
vi.mock('./project-store', () => ({
    saveProject: vi.fn().mockResolvedValue(true),
    generateProjectId: vi.fn().mockReturnValue('new-project-123'),
}));

vi.mock('../filesystem', () => ({
    LocalFSAdapter: class LocalFSAdapter {
        static isSupported = vi.fn().mockReturnValue(true);

        setDirectoryHandle = vi.fn();
    },
    SyncManager: vi.fn().mockImplementation(function (this: any) {
        this.syncToWebContainer = vi.fn().mockResolvedValue({
            success: true,
            totalFiles: 0,
            syncedFiles: 0,
            failedFiles: [],
            duration: 0,
        });
    }),
}));

vi.mock('../filesystem/permission-lifecycle', () => ({
    getPermissionState: vi.fn().mockResolvedValue('granted'),
    ensureReadWritePermission: vi.fn().mockResolvedValue(true),
    saveDirectoryHandleReference: vi.fn().mockResolvedValue(undefined),
}));

// Create mock handle
function createMockHandle(name: string): FileSystemDirectoryHandle {
    const handle = { name, kind: 'directory' as const } as FileSystemDirectoryHandle;
    Object.defineProperty(handle, 'queryPermission', {
        value: vi.fn().mockResolvedValue('granted'),
        enumerable: false,
        configurable: true,
    });
    Object.defineProperty(handle, 'requestPermission', {
        value: vi.fn().mockResolvedValue('granted'),
        enumerable: false,
        configurable: true,
    });
    return handle;
}

// Wrapper component for testing
function createWrapper(props: Partial<WorkspaceProviderProps> = {}) {
    const defaultProps: WorkspaceProviderProps = {
        projectId: 'test-project-1',
        initialProject: null,
        children: null,
        ...props,
    };

    return function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <WorkspaceProvider {...defaultProps}>
                {children}
            </WorkspaceProvider>
        );
    };
}

describe('WorkspaceContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('useWorkspace hook', () => {
        it('should throw error when used outside WorkspaceProvider', () => {
            // Suppress console.error for this test
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

            expect(() => {
                renderHook(() => useWorkspace());
            }).toThrow('useWorkspace must be used within a WorkspaceProvider');

            consoleError.mockRestore();
        });

        it('should return context value when used within WorkspaceProvider', () => {
            const { result } = renderHook(() => useWorkspace(), {
                wrapper: createWrapper(),
            });

            expect(result.current).toBeDefined();
            expect(result.current.projectId).toBe('test-project-1');
            expect(result.current.eventBus).toBeDefined();
        });
    });

    describe('Initial state', () => {
        it('should have null state when no initial project', () => {
            const { result } = renderHook(() => useWorkspace(), {
                wrapper: createWrapper({
                    projectId: 'test-1',
                    initialProject: null,
                }),
            });

            expect(result.current.projectId).toBe('test-1');
            expect(result.current.projectMetadata).toBeNull();
            expect(result.current.directoryHandle).toBeNull();
            expect(result.current.permissionState).toBe('unknown');
            expect(result.current.syncStatus).toBe('idle');
            expect(result.current.syncProgress).toBeNull();
            expect(result.current.lastSyncTime).toBeNull();
            expect(result.current.syncError).toBeNull();
            expect(result.current.autoSync).toBe(true);
            expect(result.current.isOpeningFolder).toBe(false);
        });

        it('should initialize state from initial project', () => {
            const mockHandle = createMockHandle('my-project');
            const initialProject: ProjectMetadata = {
                id: 'project-1',
                name: 'My Project',
                folderPath: 'my-project',
                fsaHandle: mockHandle,
                lastOpened: new Date('2025-01-01'),
                autoSync: false,
            };

            const { result } = renderHook(() => useWorkspace(), {
                wrapper: createWrapper({
                    projectId: 'project-1',
                    initialProject,
                }),
            });

            expect(result.current.projectMetadata).toEqual(initialProject);
            expect(result.current.directoryHandle).toBe(mockHandle);
            expect(result.current.permissionState).toBe('prompt'); // Initially prompt until effect runs
            expect(result.current.autoSync).toBe(false);
        });

        it('should trigger sync if permission is already granted', async () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Mock SyncManager to verify instantiation
            const { SyncManager } = await import('../filesystem');
            const { getPermissionState } = await import('../filesystem/permission-lifecycle');

            (getPermissionState as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
                'granted'
            );

            const mockHandle = createMockHandle('my-project');
            const initialProject: ProjectMetadata = {
                id: 'project-autostart',
                name: 'My Project',
                folderPath: 'my-project',
                fsaHandle: mockHandle,
                lastOpened: new Date(),
            };

            renderHook(() => useWorkspace(), {
                wrapper: createWrapper({
                    projectId: 'project-autostart',
                    initialProject,
                }),
            });

            await waitFor(() => {
                expect(getPermissionState).toHaveBeenCalled();
                expect(SyncManager).toHaveBeenCalled();
            });

            consoleError.mockRestore();
        });

        it('should not run full sync on mount when autoSync is disabled', async () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            const { SyncManager } = await import('../filesystem');
            const { getPermissionState } = await import('../filesystem/permission-lifecycle');

            (getPermissionState as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
                'granted'
            );

            const mockHandle = createMockHandle('my-project');
            const initialProject: ProjectMetadata = {
                id: 'project-autosync-off',
                name: 'My Project',
                folderPath: 'my-project',
                fsaHandle: mockHandle,
                lastOpened: new Date(),
                autoSync: false,
            };

            const { result } = renderHook(() => useWorkspace(), {
                wrapper: createWrapper({
                    projectId: 'project-autosync-off',
                    initialProject,
                }),
            });

            await waitFor(() => {
                expect(getPermissionState).toHaveBeenCalled();
                expect(SyncManager).toHaveBeenCalled();
            });

            expect(result.current.autoSync).toBe(false);
            expect(result.current.syncStatus).toBe('idle');
            expect(result.current.lastSyncTime).toBeNull();
            expect(result.current.syncProgress).toBeNull();
            expect(result.current.syncManagerRef.current).not.toBeNull();

            consoleError.mockRestore();
        });
    });

    describe('Actions', () => {
        describe('closeProject', () => {
            it('should navigate to dashboard', () => {
                const { result } = renderHook(() => useWorkspace(), {
                    wrapper: createWrapper(),
                });

                act(() => {
                    result.current.closeProject();
                });

                expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
            });
        });

        describe('setAutoSync', () => {
            it('should update autoSync state and persist to ProjectStore', async () => {
                const mockHandle = createMockHandle('my-project');
                const initialProject: ProjectMetadata = {
                    id: 'project-1',
                    name: 'My Project',
                    folderPath: 'my-project',
                    fsaHandle: mockHandle,
                    lastOpened: new Date('2025-01-01'),
                    autoSync: true,
                };

                const { result } = renderHook(() => useWorkspace(), {
                    wrapper: createWrapper({
                        projectId: 'project-1',
                        initialProject,
                    }),
                });

                const { saveProject } = await import('./project-store');

                await act(async () => {
                    await result.current.setAutoSync(false);
                });

                expect(result.current.autoSync).toBe(false);
                expect(saveProject as unknown as { mock: unknown }).toHaveBeenCalled();
                expect((saveProject as unknown as { mock: { calls: any[][] } }).mock.calls[0][0]).toEqual(
                    expect.objectContaining({ id: 'project-1', autoSync: false })
                );
            });
        });

        // Note: openFolder and switchFolder tests require browser APIs
        // which are difficult to mock properly in unit tests.
        // These would be better tested with integration/E2E tests.
    });

    describe('Refs', () => {
        it('should provide localAdapterRef', () => {
            const { result } = renderHook(() => useWorkspace(), {
                wrapper: createWrapper(),
            });

            expect(result.current.localAdapterRef).toBeDefined();
            expect(result.current.localAdapterRef.current).toBeNull();
        });

        it('should provide syncManagerRef', () => {
            const { result } = renderHook(() => useWorkspace(), {
                wrapper: createWrapper(),
            });

            expect(result.current.syncManagerRef).toBeDefined();
            expect(result.current.syncManagerRef.current).toBeNull();
        });
    });
});
