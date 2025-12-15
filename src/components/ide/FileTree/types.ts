/**
 * @fileoverview FileTree Component Types
 * Type definitions for the FileTree component and related utilities
 */

// Note: FileSystemHandle, FileSystemDirectoryHandle, FileSystemFileHandle
// are built-in browser types from TypeScript DOM lib (ES2022+)

/**
 * Represents a node in the file tree
 */
export interface TreeNode {
    /** File or folder name */
    name: string;
    /** Full relative path from root */
    path: string;
    /** Type of node */
    type: 'file' | 'directory';
    /** Handle to the file/directory */
    handle: FileSystemHandle;
    /** Child nodes (only for directories) */
    children?: TreeNode[];
    /** Whether folder is expanded */
    expanded?: boolean;
    /** Whether children are currently loading */
    loading?: boolean;
}

/**
 * Props for the FileTree component
 */
export interface FileTreeProps {
    /** Directory handle to display (from LocalFSAdapter.requestDirectoryAccess) */
    directoryHandle?: FileSystemDirectoryHandle | null;
    /** Callback when a file is selected */
    onFileSelect?: (path: string, handle: FileSystemFileHandle) => void;
    /** Currently selected file path */
    selectedPath?: string;
    /** Optional className for styling */
    className?: string;
    /** Key to trigger refresh (increment to refresh tree) */
    refreshKey?: number;
}

/**
 * Props for individual tree items
 */
export interface FileTreeItemProps {
    node: TreeNode;
    depth: number;
    selectedPath?: string;
    focusedPath?: string;
    onSelect: (node: TreeNode) => void;
    onToggle: (node: TreeNode) => void;
    onContextMenu: (event: React.MouseEvent, node: TreeNode) => void;
    onRetryFile?: (path: string) => void;
    /** Whether this file/folder is excluded from sync */
    isExcluded?: boolean;
}

/**
 * Context menu action types
 */
export type ContextMenuAction = 'new-file' | 'new-folder' | 'rename' | 'delete';

/**
 * Context menu state
 */
export interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    targetNode: TreeNode | null;
}

/**
 * File icon type identifiers
 */
export type FileIconType =
    | 'typescript'
    | 'javascript'
    | 'css'
    | 'json'
    | 'markdown'
    | 'html'
    | 'image'
    | 'folder'
    | 'folder-open'
    | 'default';
