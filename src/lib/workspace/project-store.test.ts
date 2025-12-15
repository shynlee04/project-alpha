/**
 * Unit tests for ProjectStore.
 *
 * Story 3-7: Implement Project Metadata Persistence
 */

// Import fake-indexeddb polyfill BEFORE any idb imports
import 'fake-indexeddb/auto';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    saveProject,
    getProject,
    listProjects,
    deleteProject,
    updateProjectLastOpened,
    generateProjectId,
    clearAllProjects,
    getProjectCount,
    _resetDBForTesting,
    type ProjectMetadata,
} from './project-store';

// Mock FileSystemDirectoryHandle - must be structured-clone compatible for IndexedDB
// Real FSA handles are native objects that ARE structured-clone compatible
// Our mock needs to mimic this by avoiding function properties as own enumerable properties
function createMockHandle(name = 'test-folder'): FileSystemDirectoryHandle {
    // Create a base object with only serializable properties
    const handle = Object.create(null);

    // Add the serializable properties
    Object.defineProperty(handle, 'name', { value: name, enumerable: true });
    Object.defineProperty(handle, 'kind', { value: 'directory', enumerable: true });

    // Add methods as non-enumerable to avoid structured clone issues
    Object.defineProperty(handle, 'isSameEntry', { value: vi.fn().mockResolvedValue(false), enumerable: false });
    Object.defineProperty(handle, 'queryPermission', { value: vi.fn().mockResolvedValue('granted'), enumerable: false });
    Object.defineProperty(handle, 'requestPermission', { value: vi.fn().mockResolvedValue('granted'), enumerable: false });
    Object.defineProperty(handle, 'resolve', { value: vi.fn().mockResolvedValue(null), enumerable: false });
    Object.defineProperty(handle, 'getDirectoryHandle', { value: vi.fn(), enumerable: false });
    Object.defineProperty(handle, 'getFileHandle', { value: vi.fn(), enumerable: false });
    Object.defineProperty(handle, 'removeEntry', { value: vi.fn(), enumerable: false });
    Object.defineProperty(handle, 'keys', { value: vi.fn(), enumerable: false });
    Object.defineProperty(handle, 'values', { value: vi.fn(), enumerable: false });
    Object.defineProperty(handle, 'entries', { value: vi.fn(), enumerable: false });

    return handle as unknown as FileSystemDirectoryHandle;
}

// Create test project metadata
function createTestProject(overrides: Partial<ProjectMetadata> = {}): ProjectMetadata {
    return {
        id: generateProjectId(),
        name: 'Test Project',
        folderPath: '/test/path',
        fsaHandle: createMockHandle(),
        lastOpened: new Date(),
        ...overrides,
    };
}

describe('ProjectStore', () => {
    beforeEach(async () => {
        // Reset database completely before each test - this deletes and recreates the DB
        await _resetDBForTesting();
    });

    afterEach(async () => {
        // Close connection after tests
        await _resetDBForTesting();
    });

    describe('generateProjectId', () => {
        it('should generate unique IDs', () => {
            const id1 = generateProjectId();
            const id2 = generateProjectId();

            expect(id1).toBeDefined();
            expect(id2).toBeDefined();
            expect(id1).not.toEqual(id2);
        });

        it('should generate string IDs', () => {
            const id = generateProjectId();
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
        });
    });

    describe('saveProject', () => {
        it('should save a project successfully', async () => {
            const project = createTestProject();

            const result = await saveProject(project);

            expect(result).toBe(true);
        });

        it('should default autoSync to true when not provided', async () => {
            const project = createTestProject({ autoSync: undefined });

            const result = await saveProject(project);
            expect(result).toBe(true);

            const retrieved = await getProject(project.id);
            expect(retrieved?.autoSync).toBe(true);
        });

        it('should update existing project', async () => {
            const project = createTestProject();
            await saveProject(project);

            // Update project
            project.name = 'Updated Name';
            const result = await saveProject(project);

            expect(result).toBe(true);

            // Verify update
            const retrieved = await getProject(project.id);
            expect(retrieved?.name).toBe('Updated Name');
        });
    });

    describe('getProject', () => {
        it('should retrieve saved project by ID', async () => {
            const project = createTestProject();
            await saveProject(project);

            const retrieved = await getProject(project.id);

            expect(retrieved).not.toBeNull();
            expect(retrieved?.id).toBe(project.id);
            expect(retrieved?.name).toBe(project.name);
        });

        it('should return null for non-existent ID', async () => {
            const retrieved = await getProject('non-existent-id');

            expect(retrieved).toBeNull();
        });
    });

    describe('listProjects', () => {
        it('should return empty array when no projects', async () => {
            const projects = await listProjects();

            expect(projects).toEqual([]);
        });

        it('should return all projects', async () => {
            const project1 = createTestProject({ name: 'Project 1' });
            const project2 = createTestProject({ name: 'Project 2' });

            await saveProject(project1);
            await saveProject(project2);

            const projects = await listProjects();

            expect(projects.length).toBe(2);
        });

        it('should sort by lastOpened descending', async () => {
            const oldDate = new Date('2024-01-01');
            const newDate = new Date('2025-01-01');

            const oldProject = createTestProject({
                name: 'Old Project',
                lastOpened: oldDate,
            });
            const newProject = createTestProject({
                name: 'New Project',
                lastOpened: newDate,
            });

            // Save old first, then new
            await saveProject(oldProject);
            await saveProject(newProject);

            const projects = await listProjects();

            // New project should be first
            expect(projects[0].name).toBe('New Project');
            expect(projects[1].name).toBe('Old Project');
        });
    });

    describe('deleteProject', () => {
        it('should delete existing project', async () => {
            const project = createTestProject();
            await saveProject(project);

            // Verify saved
            expect(await getProject(project.id)).not.toBeNull();

            // Delete
            const result = await deleteProject(project.id);

            expect(result).toBe(true);
            expect(await getProject(project.id)).toBeNull();
        });

        it('should return true for non-existent ID', async () => {
            // IndexedDB delete doesn't error on non-existent keys
            const result = await deleteProject('non-existent-id');

            expect(result).toBe(true);
        });
    });

    describe('updateProjectLastOpened', () => {
        it('should update lastOpened timestamp', async () => {
            const oldDate = new Date('2024-01-01');
            const project = createTestProject({ lastOpened: oldDate });
            await saveProject(project);

            // Wait a bit to ensure time difference
            await new Promise((resolve) => setTimeout(resolve, 10));

            const result = await updateProjectLastOpened(project.id);

            expect(result).toBe(true);

            const updated = await getProject(project.id);
            expect(updated).not.toBeNull();
            expect(updated!.lastOpened.getTime()).toBeGreaterThan(oldDate.getTime());
        });

        it('should return false for non-existent ID', async () => {
            const result = await updateProjectLastOpened('non-existent-id');

            expect(result).toBe(false);
        });
    });

    describe('getProjectCount', () => {
        it('should return 0 for empty store', async () => {
            const count = await getProjectCount();

            expect(count).toBe(0);
        });

        it('should return correct count', async () => {
            await saveProject(createTestProject({ name: 'Project 1' }));
            await saveProject(createTestProject({ name: 'Project 2' }));
            await saveProject(createTestProject({ name: 'Project 3' }));

            const count = await getProjectCount();

            expect(count).toBe(3);
        });
    });

    describe('clearAllProjects', () => {
        it('should remove all projects', async () => {
            await saveProject(createTestProject({ name: 'Project 1' }));
            await saveProject(createTestProject({ name: 'Project 2' }));

            expect(await getProjectCount()).toBe(2);

            const result = await clearAllProjects();

            expect(result).toBe(true);
            expect(await getProjectCount()).toBe(0);
        });
    });

    describe('project with layoutState', () => {
        it('should save and retrieve layoutState', async () => {
            const project = createTestProject({
                layoutState: {
                    panelSizes: [20, 60, 20],
                    openFiles: ['src/index.ts', 'package.json'],
                    activeFile: 'src/index.ts',
                },
            });

            await saveProject(project);

            const retrieved = await getProject(project.id);

            expect(retrieved?.layoutState).toBeDefined();
            expect(retrieved?.layoutState?.panelSizes).toEqual([20, 60, 20]);
            expect(retrieved?.layoutState?.openFiles).toEqual(['src/index.ts', 'package.json']);
            expect(retrieved?.layoutState?.activeFile).toBe('src/index.ts');
        });
    });
});
