/**
 * @fileoverview Integration tests for LocalFSAdapter
 * @description Tests the adapter in realistic scenarios with multi-step workflows
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalFSAdapter, FileSystemError } from '../local-fs-adapter';

// Mock the window object and File System Access API
const mockShowDirectoryPicker = vi.fn();

const mockWindow = {
  showDirectoryPicker: mockShowDirectoryPicker,
} as any;

Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true,
});

// Mock the File System Access API
const mockDirectoryHandle = {
  kind: 'directory' as const,
  name: 'test-project',
  getFileHandle: vi.fn(),
  getDirectoryHandle: vi.fn(),
  removeEntry: vi.fn(),
  entries: vi.fn(),
};

const mockFileHandle = {
  kind: 'file' as const,
  name: 'test.txt',
  getFile: vi.fn(),
  createWritable: vi.fn(),
};

const mockFile: { text: ReturnType<typeof vi.fn>; arrayBuffer: ReturnType<typeof vi.fn>; type: string } = {
  text: vi.fn(),
  arrayBuffer: vi.fn(),
  type: '',
};

const mockWritable = {
  write: vi.fn(),
  close: vi.fn(),
};

describe('LocalFSAdapter Integration Tests', () => {
  let adapter: LocalFSAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new LocalFSAdapter();
  });

  describe('Complete file workflow', () => {
    it('should handle complete create-read-update-delete cycle', async () => {
      // Setup
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();

      // Create file
      const createContent = 'Initial content';
      mockDirectoryHandle.getFileHandle.mockResolvedValueOnce(mockFileHandle);
      mockFileHandle.createWritable.mockResolvedValueOnce(mockWritable);

      await adapter.createFile('test-cycle.txt', createContent);

      expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('test-cycle.txt', { create: true });
      expect(mockWritable.write).toHaveBeenCalledWith(createContent);
      expect(mockWritable.close).toHaveBeenCalledTimes(1);

      // Read file
      mockDirectoryHandle.getFileHandle.mockResolvedValueOnce(mockFileHandle);
      mockFileHandle.getFile.mockResolvedValueOnce(mockFile);
      mockFile.text.mockResolvedValueOnce(createContent);

      const readResult = await adapter.readFile('test-cycle.txt');

      expect(readResult.content).toBe(createContent);
      expect(readResult.encoding).toBe('utf-8');

      // Update file
      const updateContent = 'Updated content';
      mockDirectoryHandle.getFileHandle.mockResolvedValueOnce(mockFileHandle);
      mockFileHandle.createWritable.mockResolvedValueOnce(mockWritable);

      await adapter.writeFile('test-cycle.txt', updateContent);

      expect(mockWritable.write).toHaveBeenCalledWith(updateContent);

      // Delete file
      mockDirectoryHandle.removeEntry.mockResolvedValueOnce(undefined);

      await adapter.deleteFile('test-cycle.txt');

      expect(mockDirectoryHandle.removeEntry).toHaveBeenCalledWith('test-cycle.txt');
    });

    it('should handle binary file read', async () => {
      // Setup
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();

      // Read binary file
      const binaryData = new ArrayBuffer(10);
      mockDirectoryHandle.getFileHandle.mockResolvedValueOnce(mockFileHandle);
      mockFileHandle.getFile.mockResolvedValueOnce(mockFile);
      mockFile.type = 'application/octet-stream';
      mockFile.arrayBuffer.mockResolvedValueOnce(binaryData);

      const result = await adapter.readFile('binary-file.bin', { encoding: 'binary' });

      expect(result.data).toBe(binaryData);
      expect(result.mimeType).toBe('application/octet-stream');
    });
  });

  describe('Multi-segment path operations', () => {
    it('should support multi-segment file paths', async () => {
      // Setup
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();

      // Create nested directory structure for the path
      const srcDirHandle = {
        kind: 'directory' as const,
        name: 'src',
        getFileHandle: vi.fn(),
        getDirectoryHandle: vi.fn(),
        removeEntry: vi.fn(),
        entries: vi.fn(),
      };

      const componentsDirHandle = {
        kind: 'directory' as const,
        name: 'components',
        getFileHandle: vi.fn(),
        getDirectoryHandle: vi.fn(),
        removeEntry: vi.fn(),
        entries: vi.fn(),
      };

      // Mock the walk: root -> src -> components -> Button.tsx
      // First level: mockDirectoryHandle.getDirectoryHandle('src')
      const getDirectoryHandleMock = vi.fn()
        .mockResolvedValueOnce(srcDirHandle) // First call: get 'src'
        .mockResolvedValueOnce(componentsDirHandle); // Second call: get 'components' from 'src'

      // Second level: srcDirHandle.getDirectoryHandle('components')
      const srcGetDirectoryHandleMock = vi.fn()
        .mockResolvedValueOnce(componentsDirHandle);

      mockDirectoryHandle.getDirectoryHandle = getDirectoryHandleMock;
      srcDirHandle.getDirectoryHandle = srcGetDirectoryHandleMock;

      componentsDirHandle.getFileHandle.mockResolvedValue(mockFileHandle);
      mockFileHandle.createWritable.mockResolvedValue(mockWritable);

      await adapter.writeFile('src/components/Button.tsx', 'export default Button;');

      // Verify the file handle was created in the components directory
      expect(componentsDirHandle.getFileHandle).toHaveBeenCalledWith('Button.tsx', { create: true });
    });

    it('should support multi-segment directory paths', async () => {
      // Setup
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();

      // Create nested directory structure
      const srcDirHandle = {
        kind: 'directory' as const,
        name: 'src',
        getFileHandle: vi.fn(),
        getDirectoryHandle: vi.fn(),
        removeEntry: vi.fn(),
        entries: vi.fn(),
      };

      // Mock the walk: root -> src -> components
      // First level: mockDirectoryHandle.getDirectoryHandle('src')
      const getDirectoryHandleMock = vi.fn()
        .mockResolvedValueOnce(srcDirHandle) // First call: get 'src'
        .mockResolvedValueOnce(srcDirHandle); // Second call: get 'components' from 'src'

      // Second level: srcDirHandle.getDirectoryHandle('components')
      const srcGetDirectoryHandleMock = vi.fn()
        .mockResolvedValueOnce(srcDirHandle);

      mockDirectoryHandle.getDirectoryHandle = getDirectoryHandleMock;
      srcDirHandle.getDirectoryHandle = srcGetDirectoryHandleMock;

      await adapter.createDirectory('src/components');

      // Verify both directory handles were created
      expect(getDirectoryHandleMock).toHaveBeenCalledTimes(1);
      expect(srcGetDirectoryHandleMock).toHaveBeenCalledTimes(1);
      expect(getDirectoryHandleMock).toHaveBeenCalledWith('src', { create: true });
      expect(srcGetDirectoryHandleMock).toHaveBeenCalledWith('components', { create: true });
    });
  });

  describe('Error handling workflows', () => {
    it('should handle permission denial gracefully', async () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      mockShowDirectoryPicker.mockRejectedValue(error);

      await expect(adapter.requestDirectoryAccess()).rejects.toThrow('Permission was denied');
    });

    it('should handle missing files gracefully', async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();

      const notFoundError = new Error('File not found');
      notFoundError.name = 'NotFoundError';
      mockDirectoryHandle.getFileHandle.mockRejectedValueOnce(notFoundError);

      await expect(adapter.readFile('nonexistent.txt')).rejects.toThrow(FileSystemError);
    });

    it('should handle path traversal attempts', async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();

      await expect(adapter.readFile('../../../etc/passwd')).rejects.toThrow('Path traversal');
      await expect(adapter.readFile('../parent/file.txt')).rejects.toThrow('Path traversal');
      await expect(adapter.writeFile('./child/../../../secret.txt', 'data')).rejects.toThrow('Path traversal');
    });

    it('should handle absolute path attempts', async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();

      await expect(adapter.readFile('/etc/passwd')).rejects.toThrow('Use relative paths');
      await expect(adapter.readFile('C:\\Windows\\System32')).rejects.toThrow('Use relative paths');
    });
  });

  describe('Directory operations workflow', () => {
    it('should handle directory rename with contents', async () => {
      // Setup
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();

      // Create mock handles
      const oldDirHandle = {
        kind: 'directory' as const,
        name: 'old-name',
        entries: vi.fn().mockReturnValue([]),
      };

      const newDirHandle = {
        kind: 'directory' as const,
        name: 'new-name',
        getFileHandle: vi.fn(),
        getDirectoryHandle: vi.fn(),
        removeEntry: vi.fn(),
        entries: vi.fn(),
      };

      // Mock the operations
      const getFileHandleMock = vi.fn().mockRejectedValue(new Error('Not a file'));
      const getDirectoryHandleMock = vi.fn().mockImplementation((path: string, options?: any) => {
        if (path === 'old-name') return Promise.resolve(oldDirHandle);
        if (path === 'new-name' && options?.create) return Promise.resolve(newDirHandle);
        throw new Error(`Unexpected call: ${path}`);
      });

      mockDirectoryHandle.getFileHandle = getFileHandleMock;
      mockDirectoryHandle.getDirectoryHandle = getDirectoryHandleMock;
      mockDirectoryHandle.removeEntry.mockResolvedValue(undefined);

      // Rename directory
      await adapter.rename('old-name', 'new-name');

      expect(getDirectoryHandleMock).toHaveBeenCalledWith('new-name', { create: true });
      expect(mockDirectoryHandle.removeEntry).toHaveBeenCalledWith('old-name', { recursive: true });
    });

    it('should handle recursive directory deletion', async () => {
      // Setup
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();

      // Delete directory with contents
      await adapter.deleteDirectory('project');

      expect(mockDirectoryHandle.removeEntry).toHaveBeenCalledWith('project', { recursive: true });
    });
  });

  describe('Security validation', () => {
    beforeEach(async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();
    });

    it('should validate paths before operations', async () => {
      // Empty path
      await expect(adapter.readFile('')).rejects.toThrow('Path must be a non-empty string');

      // Null/undefined
      await expect(adapter.readFile(null as any)).rejects.toThrow('Path must be a non-empty string');
      await expect(adapter.readFile(undefined as any)).rejects.toThrow('Path must be a non-empty string');

      // Traversal attempts
      await expect(adapter.readFile('..')).rejects.toThrow('Path traversal');
      await expect(adapter.readFile('../file')).rejects.toThrow('Path traversal');
      await expect(adapter.writeFile('../../file', 'data')).rejects.toThrow('Path traversal');
    });

    it('should allow dots in filenames', async () => {
      // These should be valid (dots are part of the filename)
      const validFilenames = [
        'file..txt',
        'my..file..name',
        '...',
        '..file',
      ];

      for (const filename of validFilenames) {
        // Just validate that the path passes validation by attempting to read
        // The file won't exist but we're testing that path validation passes
        mockDirectoryHandle.getFileHandle.mockRejectedValueOnce(new Error('File not found'));

        // If path validation fails, it will throw before trying to get file handle
        try {
          await adapter.readFile(filename);
        } catch (error: any) {
          // Should fail with file not found, not path traversal
          if (error.message?.includes('Path traversal')) {
            throw new Error(`Path "${filename}" should be valid (dots in filename)`);
          }
        }
      }
    });
  });

  describe('API compatibility', () => {
    it('should detect browser support correctly', () => {
      // Mock window without showDirectoryPicker
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true,
      });

      expect(LocalFSAdapter.isSupported()).toBe(false);
    });

    it('should work when API is supported', () => {
      // Mock window with showDirectoryPicker
      Object.defineProperty(global, 'window', {
        value: { showDirectoryPicker: vi.fn() },
        writable: true,
      });

      expect(LocalFSAdapter.isSupported()).toBe(true);
    });
  });
});
