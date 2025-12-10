/**
 * @fileoverview Unit tests for LocalFSAdapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalFSAdapter, FileSystemError, PermissionDeniedError } from '../local-fs-adapter';

// Type declarations for test globals
declare global {
  var showDirectoryPicker: any;
}

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
  name: 'test-directory',
  getFileHandle: vi.fn(),
  getDirectoryHandle: vi.fn(),
  removeEntry: vi.fn(),
  entries: vi.fn(),
};

const mockFileHandle = {
  kind: 'file' as const,
  name: 'test-file.txt',
  getFile: vi.fn(),
  createWritable: vi.fn(),
};

const mockFile = {
  text: vi.fn(),
};

const mockWritable = {
  write: vi.fn(),
  close: vi.fn(),
};

describe('LocalFSAdapter', () => {
  let adapter: LocalFSAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new LocalFSAdapter();
  });

  describe('requestDirectoryAccess', () => {
    it('should return directory handle when user grants permission', async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);

      const result = await adapter.requestDirectoryAccess();

      expect(result).toBe(mockDirectoryHandle);
      expect(mockShowDirectoryPicker).toHaveBeenCalledTimes(1);
    });

    it('should throw PermissionDeniedError when user denies permission', async () => {
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      mockShowDirectoryPicker.mockRejectedValue(error);

      await expect(adapter.requestDirectoryAccess()).rejects.toThrow(PermissionDeniedError);
    });

    it('should throw PermissionDeniedError when user cancels picker', async () => {
      const error = new Error('Operation aborted');
      error.name = 'AbortError';
      mockShowDirectoryPicker.mockRejectedValue(error);

      await expect(adapter.requestDirectoryAccess()).rejects.toThrow(PermissionDeniedError);
    });

    it('should throw FileSystemError for other errors', async () => {
      const error = new Error('Unknown error');
      error.name = 'SomeOtherError';
      mockShowDirectoryPicker.mockRejectedValue(error);

      await expect(adapter.requestDirectoryAccess()).rejects.toThrow(FileSystemError);
      await expect(adapter.requestDirectoryAccess()).rejects.not.toThrow(PermissionDeniedError);
    });
  });

  describe('getDirectoryHandle', () => {
    it('should return null when no directory has been granted', () => {
      expect(adapter.getDirectoryHandle()).toBeNull();
    });

    it('should return the directory handle after access is granted', async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);

      await adapter.requestDirectoryAccess();

      expect(adapter.getDirectoryHandle()).toBe(mockDirectoryHandle);
    });
  });

  describe('readFile', () => {
    beforeEach(async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();
    });

    it('should read file content successfully', async () => {
      const fileContent = 'Hello, World!';
      mockFileHandle.getFile.mockResolvedValue(mockFile);
      mockFile.text.mockResolvedValue(fileContent);
      mockDirectoryHandle.getFileHandle.mockResolvedValue(mockFileHandle);

      const result = await adapter.readFile('test.txt');

      expect(result.content).toBe(fileContent);
      expect(result.encoding).toBe('utf-8');
      expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('test.txt', { create: false });
    });

    it('should throw FileSystemError when no directory access', async () => {
      const newAdapter = new LocalFSAdapter();
      await expect(newAdapter.readFile('test.txt')).rejects.toThrow(FileSystemError);
    });

    it('should throw FileSystemError with FILE_NOT_FOUND when file does not exist', async () => {
      const error = new Error('File not found');
      error.name = 'NotFoundError';
      mockDirectoryHandle.getFileHandle.mockRejectedValue(error);

      await expect(adapter.readFile('nonexistent.txt')).rejects.toThrow(FileSystemError);
      await expect(adapter.readFile('nonexistent.txt')).rejects.toThrow('File not found: nonexistent.txt');
    });

    it('should wrap other errors in FileSystemError', async () => {
      const error = new Error('Permission error');
      mockDirectoryHandle.getFileHandle.mockRejectedValue(error);

      await expect(adapter.readFile('test.txt')).rejects.toThrow(FileSystemError);
      await expect(adapter.readFile('test.txt')).rejects.toThrow('Failed to read file "test.txt"');
    });
  });

  describe('writeFile', () => {
    beforeEach(async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();
    });

    it('should write file content successfully', async () => {
      const content = 'Test content';
      mockDirectoryHandle.getFileHandle.mockResolvedValue(mockFileHandle);
      mockFileHandle.createWritable.mockResolvedValue(mockWritable);

      await adapter.writeFile('test.txt', content);

      expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('test.txt', { create: true });
      expect(mockWritable.write).toHaveBeenCalledWith(content);
      expect(mockWritable.close).toHaveBeenCalledTimes(1);
    });

    it('should throw FileSystemError when no directory access', async () => {
      const newAdapter = new LocalFSAdapter();
      await expect(newAdapter.writeFile('test.txt', 'content')).rejects.toThrow(FileSystemError);
    });

    it('should wrap errors in FileSystemError', async () => {
      const error = new Error('Write failed');
      mockDirectoryHandle.getFileHandle.mockRejectedValue(error);

      await expect(adapter.writeFile('test.txt', 'content')).rejects.toThrow(FileSystemError);
      await expect(adapter.writeFile('test.txt', 'content')).rejects.toThrow('Failed to write file "test.txt"');
    });
  });

  describe('createFile', () => {
    beforeEach(async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();
    });

    it('should create file with default content', async () => {
      const writeFileSpy = vi.spyOn(adapter, 'writeFile').mockResolvedValue();

      await adapter.createFile('new-file.txt');

      expect(writeFileSpy).toHaveBeenCalledWith('new-file.txt', '');
    });

    it('should create file with specified content', async () => {
      const writeFileSpy = vi.spyOn(adapter, 'writeFile').mockResolvedValue();

      await adapter.createFile('new-file.txt', 'Initial content');

      expect(writeFileSpy).toHaveBeenCalledWith('new-file.txt', 'Initial content');
    });
  });

  describe('deleteFile', () => {
    beforeEach(async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();
    });

    it('should delete file successfully', async () => {
      await adapter.deleteFile('test.txt');

      expect(mockDirectoryHandle.removeEntry).toHaveBeenCalledWith('test.txt');
    });

    it('should throw FileSystemError when file does not exist', async () => {
      const error = new Error('File not found');
      error.name = 'NotFoundError';
      mockDirectoryHandle.removeEntry.mockRejectedValue(error);

      await expect(adapter.deleteFile('nonexistent.txt')).rejects.toThrow(FileSystemError);
      await expect(adapter.deleteFile('nonexistent.txt')).rejects.toThrow('File not found: nonexistent.txt');
    });
  });

  describe('listDirectory', () => {
    beforeEach(async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();
    });

    it('should list directory contents successfully', async () => {
      const fileHandle = {
        kind: 'file' as const,
        name: 'file1.txt',
        getFile: vi.fn(),
        createWritable: vi.fn(),
      };
      const dirHandle = {
        kind: 'directory' as const,
        name: 'dir1',
        getFileHandle: vi.fn(),
        getDirectoryHandle: vi.fn(),
        removeEntry: vi.fn(),
        entries: vi.fn(),
      };

      const mockEntries = [
        ['file1.txt', fileHandle],
        ['dir1', dirHandle],
      ];

      mockDirectoryHandle.entries.mockReturnValue(mockEntries as any);

      const result = await adapter.listDirectory();

      expect(result).toHaveLength(2);
      // Alphabetically, 'dir1' comes before 'file1.txt' (d < f)
      expect(result[0].name).toBe('dir1');
      expect(result[0].type).toBe('directory');
      expect(result[0].handle).toBe(dirHandle);
      expect(result[1].name).toBe('file1.txt');
      expect(result[1].type).toBe('file');
      expect(result[1].handle).toBe(fileHandle);
    });

    it('should sort entries alphabetically', async () => {
      const mockEntries = [
        ['z-file.txt', mockFileHandle],
        ['a-file.txt', mockFileHandle],
        ['m-file.txt', mockFileHandle],
      ];

      mockDirectoryHandle.entries.mockReturnValue(mockEntries as any);

      const result = await adapter.listDirectory();

      expect(result[0].name).toBe('a-file.txt');
      expect(result[1].name).toBe('m-file.txt');
      expect(result[2].name).toBe('z-file.txt');
    });

    it('should list subdirectory contents when path is provided', async () => {
      const subDirHandle = {
        kind: 'directory' as const,
        name: 'subdir',
        entries: vi.fn().mockReturnValue([]),
      };

      mockDirectoryHandle.getDirectoryHandle.mockResolvedValue(subDirHandle);

      await adapter.listDirectory('subdir');

      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith('subdir');
      expect(subDirHandle.entries).toHaveBeenCalled();
    });

    it('should throw FileSystemError when directory does not exist', async () => {
      const error = new Error('Directory not found');
      error.name = 'NotFoundError';
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      await expect(adapter.listDirectory('nonexistent')).rejects.toThrow(FileSystemError);
    });
  });

  describe('createDirectory', () => {
    beforeEach(async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();
    });

    it('should create directory successfully', async () => {
      const newDirHandle = {
        kind: 'directory' as const,
        name: 'newdir',
      };

      mockDirectoryHandle.getDirectoryHandle.mockResolvedValue(newDirHandle);

      await adapter.createDirectory('newdir');

      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith('newdir', { create: true });
    });

    it('should wrap errors in FileSystemError', async () => {
      const error = new Error('Create failed');
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      await expect(adapter.createDirectory('newdir')).rejects.toThrow(FileSystemError);
    });
  });

  describe('deleteDirectory', () => {
    beforeEach(async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();
      // Set up mock to resolve successfully
      mockDirectoryHandle.removeEntry.mockResolvedValue(undefined);
    });

    it('should delete directory successfully', async () => {
      await adapter.deleteDirectory('testdir');

      expect(mockDirectoryHandle.removeEntry).toHaveBeenCalledWith('testdir', { recursive: true });
    });

    it('should throw FileSystemError when directory does not exist', async () => {
      const error = new Error('Directory not found');
      error.name = 'NotFoundError';
      mockDirectoryHandle.removeEntry.mockRejectedValue(error);

      await expect(adapter.deleteDirectory('nonexistent')).rejects.toThrow(FileSystemError);
    });
  });

  describe('rename', () => {
    beforeEach(async () => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
      await adapter.requestDirectoryAccess();
    });

    it('should rename file successfully', async () => {
      mockFileHandle.getFile.mockResolvedValue(mockFile);
      mockFile.text.mockResolvedValue('file content');
      mockDirectoryHandle.getFileHandle.mockResolvedValue(mockFileHandle);
      mockFileHandle.createWritable.mockResolvedValue(mockWritable);
      mockDirectoryHandle.removeEntry.mockResolvedValue(undefined);

      await adapter.rename('old-file.txt', 'new-file.txt');

      expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith('new-file.txt', { create: true });
      expect(mockWritable.write).toHaveBeenCalledWith('file content');
      expect(mockDirectoryHandle.removeEntry).toHaveBeenCalledWith('old-file.txt');
    });

    it('should rename directory successfully', async () => {
      const subDirHandle = {
        kind: 'directory' as const,
        name: 'olddir',
        entries: vi.fn().mockReturnValue([]),
      };

      const newDirHandle = {
        kind: 'directory' as const,
        name: 'newdir',
        entries: vi.fn().mockReturnValue([]),
      };

      const getFileHandleMock = vi.fn().mockRejectedValue(new Error('Not a file'));
      const getDirectoryHandleMock = vi.fn().mockImplementation((path: string, options?: any) => {
        if (path === 'olddir') {
          return Promise.resolve(subDirHandle);
        }
        if (path === 'newdir' && options?.create) {
          return Promise.resolve(newDirHandle);
        }
        throw new Error(`Unexpected call to getDirectoryHandle: ${path}`);
      });

      mockDirectoryHandle.getFileHandle = getFileHandleMock;
      mockDirectoryHandle.getDirectoryHandle = getDirectoryHandleMock;

      mockDirectoryHandle.removeEntry.mockResolvedValue(undefined);

      await adapter.rename('olddir', 'newdir');

      expect(mockDirectoryHandle.getDirectoryHandle).toHaveBeenCalledWith('newdir', { create: true });
      expect(mockDirectoryHandle.removeEntry).toHaveBeenCalledWith('olddir', { recursive: true });
    });

    it('should throw FileSystemError when old path does not exist', async () => {
      const error = new Error('Path not found');
      mockDirectoryHandle.getFileHandle.mockRejectedValue(error);
      mockDirectoryHandle.getDirectoryHandle.mockRejectedValue(error);

      await expect(adapter.rename('nonexistent.txt', 'new.txt')).rejects.toThrow(FileSystemError);
      await expect(adapter.rename('nonexistent.txt', 'new.txt')).rejects.toThrow('Path not found: nonexistent.txt');
    });
  });
});
