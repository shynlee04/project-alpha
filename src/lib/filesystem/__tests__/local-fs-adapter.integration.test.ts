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

const mockFile = {
  text: vi.fn(),
  arrayBuffer: vi.fn(),
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
    it('should handle nested directory structure', async () => {
      // Setup
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();

      // Create nested structure: src/components/Button.tsx
      const subDirHandle = {
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

      // Mock directory traversal
      mockDirectoryHandle.getDirectoryHandle
        .mockResolvedValueOnce(subDirHandle) // For 'src'
        .mockResolvedValueOnce(componentsDirHandle); // For 'src/components'

      mockDirectoryHandle.getFileHandle
        .mockResolvedValueOnce(mockFileHandle); // For 'src/components/Button.tsx'

      // Create file in nested directory
      await adapter.writeFile('src/components/Button.tsx', 'export default Button;');

      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith('src', { create: true });
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith('src/components', { create: true });
      expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('src/components/Button.tsx', { create: true });

      // Read file from nested directory
      mockFileHandle.getFile.mockResolvedValueOnce(mockFile);
      mockFile.text.mockResolvedValueOnce('export default Button;');

      const content = await adapter.readFile('src/components/Button.tsx');

      expect(content.content).toBe('export default Button;');
    });

    it('should handle directory listing with nested structure', async () => {
      // Setup
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();

      // Create nested directory handles
      const srcDirHandle = {
        kind: 'directory' as const,
        name: 'src',
        getFileHandle: vi.fn(),
        getDirectoryHandle: vi.fn(),
        removeEntry: vi.fn(),
        entries: vi.fn(),
      };

      // Mock the directory traversal
      mockDirectoryHandle.getDirectoryHandle.mockResolvedValueOnce(srcDirHandle);

      const mockEntries = [
        ['index.ts', mockFileHandle],
        ['utils.ts', mockFileHandle],
      ];

      srcDirHandle.entries.mockReturnValue(mockEntries as any);

      // List nested directory
      const entries = await adapter.listDirectory('src');

      expect(entries).toHaveLength(2);
      expect(entries[0].name).toBe('index.ts');
      expect(entries[1].name).toBe('utils.ts');
      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith('src');
      expect(srcDirHandle.entries).toHaveBeenCalled();
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

      await expect(adapter.readFile('nonexistent.txt')).rejects.toThrow('File not found: nonexistent.txt');
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
      await expect(adapter.readFile('')).rejects.toThrow('Path cannot be empty');

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
        // Just validate that the path passes validation
        // (we don't need to actually create/read the file)
        try {
          adapter.validatePath(filename, 'test');
          // If we get here, validation passed
        } catch (error: any) {
          // If validation fails, it should not be because of the dots
          if (error.message.includes('Path traversal')) {
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
        value: { },
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
