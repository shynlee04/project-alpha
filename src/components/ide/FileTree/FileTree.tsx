/**
 * @fileoverview FileTree Component
 * Main file tree component for displaying and navigating project structure
 * 
 * Features:
 * - Hierarchical display of files and folders
 * - Expand/collapse folders with lazy loading
 * - File extension icons
 * - Context menu for CRUD operations
 * - Keyboard navigation
 * - Selection state
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { LocalFSAdapter, FileSystemError, PermissionDeniedError, type DirectoryEntry } from '../../../lib/filesystem/local-fs-adapter';
import { FileTreeItemList } from './FileTreeItem';
import { ContextMenu } from './ContextMenu';
import type { FileTreeProps, TreeNode, ContextMenuState, ContextMenuAction } from './types';
import { AlertCircle, FolderOpen } from 'lucide-react';

/**
 * Build a TreeNode from a DirectoryEntry
 */
function buildTreeNode(entry: DirectoryEntry, parentPath: string): TreeNode {
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    return {
        name: entry.name,
        path,
        type: entry.type,
        handle: entry.handle,
        expanded: false,
        loading: false,
        children: entry.type === 'directory' ? undefined : undefined,
    };
}

/**
 * FileTree - Main file tree component
 */
export function FileTree({
    directoryHandle,
    onFileSelect,
    selectedPath,
    className = '',
}: FileTreeProps): JSX.Element {
    const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
    const [focusedPath, setFocusedPath] = useState<string | undefined>();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        visible: false,
        x: 0,
        y: 0,
        targetNode: null,
    });

    const treeRef = useRef<HTMLDivElement>(null);
    const adapterRef = useRef<LocalFSAdapter | null>(null);

    // Get or create adapter with the directory handle
    const getAdapter = useCallback(() => {
        if (!adapterRef.current) {
            adapterRef.current = new LocalFSAdapter();
        }
        return adapterRef.current;
    }, []);

    // Load root directory contents
    const loadRootDirectory = useCallback(async () => {
        if (!directoryHandle) {
            setRootNodes([]);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const adapter = getAdapter();
            // Set the directory handle on the adapter
            (adapter as any).directoryHandle = directoryHandle;

            const entries = await adapter.listDirectory('');
            const nodes = entries.map(entry => buildTreeNode(entry, ''));
            setRootNodes(nodes);
        } catch (err) {
            if (err instanceof PermissionDeniedError) {
                setError('Permission required to access this folder.');
            } else if (err instanceof FileSystemError) {
                setError(`Error loading directory: ${err.message}`);
            } else {
                setError('An unexpected error occurred.');
                console.error('FileTree error:', err);
            }
            setRootNodes([]);
        } finally {
            setIsLoading(false);
        }
    }, [directoryHandle, getAdapter]);

    // Load directory children (lazy loading)
    const loadChildren = useCallback(async (node: TreeNode): Promise<TreeNode[]> => {
        if (!directoryHandle) return [];

        try {
            const adapter = getAdapter();
            (adapter as any).directoryHandle = directoryHandle;

            const entries = await adapter.listDirectory(node.path);
            return entries.map(entry => buildTreeNode(entry, node.path));
        } catch (err) {
            console.error('Error loading children:', err);
            return [];
        }
    }, [directoryHandle, getAdapter]);

    // Effect to load root when directory handle changes
    useEffect(() => {
        loadRootDirectory();
    }, [loadRootDirectory]);

    // Toggle folder expand/collapse
    const handleToggle = useCallback(async (node: TreeNode) => {
        if (node.type !== 'directory') return;

        const updateNode = (nodes: TreeNode[], targetPath: string, updater: (n: TreeNode) => TreeNode): TreeNode[] => {
            return nodes.map(n => {
                if (n.path === targetPath) {
                    return updater(n);
                }
                if (n.children && n.path !== targetPath && targetPath.startsWith(n.path + '/')) {
                    return {
                        ...n,
                        children: updateNode(n.children, targetPath, updater),
                    };
                }
                return n;
            });
        };

        if (node.expanded) {
            // Collapse
            setRootNodes(prev => updateNode(prev, node.path, n => ({
                ...n,
                expanded: false,
            })));
        } else {
            // Expand - load children if needed
            if (!node.children) {
                // Set loading
                setRootNodes(prev => updateNode(prev, node.path, n => ({
                    ...n,
                    loading: true,
                })));

                const children = await loadChildren(node);

                setRootNodes(prev => updateNode(prev, node.path, n => ({
                    ...n,
                    loading: false,
                    expanded: true,
                    children,
                })));
            } else {
                setRootNodes(prev => updateNode(prev, node.path, n => ({
                    ...n,
                    expanded: true,
                })));
            }
        }
    }, [loadChildren]);

    // Handle file selection
    const handleSelect = useCallback((node: TreeNode) => {
        if (node.type === 'file' && onFileSelect) {
            onFileSelect(node.path, node.handle as FileSystemFileHandle);
        }
        setFocusedPath(node.path);
    }, [onFileSelect]);

    // Handle context menu
    const handleContextMenu = useCallback((event: React.MouseEvent, node: TreeNode) => {
        event.preventDefault();
        setContextMenu({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            targetNode: node,
        });
    }, []);

    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, visible: false, targetNode: null }));
    }, []);

    // Handle context menu actions
    const handleContextMenuAction = useCallback(async (action: ContextMenuAction) => {
        const targetNode = contextMenu.targetNode;
        if (!targetNode || !directoryHandle) return;

        const adapter = getAdapter();
        (adapter as any).directoryHandle = directoryHandle;

        try {
            switch (action) {
                case 'new-file': {
                    const name = prompt('Enter file name:');
                    if (name) {
                        const path = targetNode.type === 'directory'
                            ? `${targetNode.path}/${name}`
                            : name;
                        await adapter.createFile(path, '');
                        // Refresh the parent directory
                        if (targetNode.type === 'directory') {
                            handleToggle({ ...targetNode, expanded: false, children: undefined });
                            setTimeout(() => handleToggle({ ...targetNode, expanded: false, children: undefined }), 100);
                        } else {
                            loadRootDirectory();
                        }
                    }
                    break;
                }
                case 'new-folder': {
                    const name = prompt('Enter folder name:');
                    if (name) {
                        const path = targetNode.type === 'directory'
                            ? `${targetNode.path}/${name}`
                            : name;
                        await adapter.createDirectory(path);
                        // Refresh
                        if (targetNode.type === 'directory') {
                            handleToggle({ ...targetNode, expanded: false, children: undefined });
                            setTimeout(() => handleToggle({ ...targetNode, expanded: false, children: undefined }), 100);
                        } else {
                            loadRootDirectory();
                        }
                    }
                    break;
                }
                case 'rename': {
                    const newName = prompt('Enter new name:', targetNode.name);
                    if (newName && newName !== targetNode.name) {
                        const parentPath = targetNode.path.includes('/')
                            ? targetNode.path.substring(0, targetNode.path.lastIndexOf('/'))
                            : '';
                        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
                        await adapter.rename(targetNode.path, newPath);
                        loadRootDirectory();
                    }
                    break;
                }
                case 'delete': {
                    const confirmed = confirm(`Are you sure you want to delete "${targetNode.name}"?`);
                    if (confirmed) {
                        if (targetNode.type === 'directory') {
                            await adapter.deleteDirectory(targetNode.path);
                        } else {
                            await adapter.deleteFile(targetNode.path);
                        }
                        loadRootDirectory();
                    }
                    break;
                }
            }
        } catch (err) {
            console.error('Context menu action error:', err);
            alert(`Failed to ${action}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }, [contextMenu.targetNode, directoryHandle, getAdapter, handleToggle, loadRootDirectory]);

    // Keyboard navigation
    const getAllVisiblePaths = useCallback((): string[] => {
        const paths: string[] = [];
        const traverse = (nodes: TreeNode[]) => {
            for (const node of nodes) {
                paths.push(node.path);
                if (node.type === 'directory' && node.expanded && node.children) {
                    traverse(node.children);
                }
            }
        };

        // Sort: folders first, then files
        const sortedNodes = [...rootNodes].sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        traverse(sortedNodes);
        return paths;
    }, [rootNodes]);

    const findNodeByPath = useCallback((path: string): TreeNode | undefined => {
        const find = (nodes: TreeNode[]): TreeNode | undefined => {
            for (const node of nodes) {
                if (node.path === path) return node;
                if (node.children) {
                    const found = find(node.children);
                    if (found) return found;
                }
            }
            return undefined;
        };
        return find(rootNodes);
    }, [rootNodes]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const paths = getAllVisiblePaths();
        if (paths.length === 0) return;

        const currentIndex = focusedPath ? paths.indexOf(focusedPath) : -1;
        const currentNode = focusedPath ? findNodeByPath(focusedPath) : undefined;

        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault();
                const nextIndex = currentIndex < paths.length - 1 ? currentIndex + 1 : 0;
                setFocusedPath(paths[nextIndex]);
                break;
            }
            case 'ArrowUp': {
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : paths.length - 1;
                setFocusedPath(paths[prevIndex]);
                break;
            }
            case 'ArrowRight': {
                e.preventDefault();
                if (currentNode?.type === 'directory' && !currentNode.expanded) {
                    handleToggle(currentNode);
                } else if (currentNode?.type === 'directory' && currentNode.expanded && currentNode.children?.length) {
                    // Move to first child
                    const sortedChildren = [...currentNode.children].sort((a, b) => {
                        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                        return a.name.localeCompare(b.name);
                    });
                    setFocusedPath(sortedChildren[0]?.path);
                }
                break;
            }
            case 'ArrowLeft': {
                e.preventDefault();
                if (currentNode?.type === 'directory' && currentNode.expanded) {
                    handleToggle(currentNode);
                } else if (focusedPath?.includes('/')) {
                    // Move to parent
                    const parentPath = focusedPath.substring(0, focusedPath.lastIndexOf('/'));
                    setFocusedPath(parentPath || paths[0]);
                }
                break;
            }
            case 'Enter': {
                e.preventDefault();
                if (currentNode) {
                    if (currentNode.type === 'directory') {
                        handleToggle(currentNode);
                    } else {
                        handleSelect(currentNode);
                    }
                }
                break;
            }
        }
    }, [focusedPath, getAllVisiblePaths, findNodeByPath, handleToggle, handleSelect]);

    // Render empty state when no directory handle
    if (!directoryHandle) {
        return (
            <div className={`h-full flex flex-col items-center justify-center text-slate-500 p-4 ${className}`}>
                <FolderOpen size={32} className="mb-2 text-slate-600" />
                <p className="text-sm text-center">No folder selected</p>
                <p className="text-xs text-slate-600 text-center mt-1">
                    Open a folder to view files
                </p>
            </div>
        );
    }

    // Render error state
    if (error) {
        return (
            <div className={`h-full flex flex-col items-center justify-center text-red-400 p-4 ${className}`}>
                <AlertCircle size={32} className="mb-2" />
                <p className="text-sm text-center">{error}</p>
            </div>
        );
    }

    // Render loading state
    if (isLoading) {
        return (
            <div className={`h-full flex items-center justify-center text-slate-500 ${className}`}>
                <p className="text-sm">Loading...</p>
            </div>
        );
    }

    return (
        <div
            ref={treeRef}
            role="tree"
            aria-label="File explorer"
            tabIndex={0}
            className={`h-full overflow-auto focus:outline-none ${className}`}
            onKeyDown={handleKeyDown}
            onClick={() => treeRef.current?.focus()}
        >
            <FileTreeItemList
                nodes={rootNodes}
                depth={0}
                selectedPath={selectedPath}
                focusedPath={focusedPath}
                onSelect={handleSelect}
                onToggle={handleToggle}
                onContextMenu={handleContextMenu}
            />

            {/* Context Menu */}
            <ContextMenu
                visible={contextMenu.visible}
                x={contextMenu.x}
                y={contextMenu.y}
                targetNode={contextMenu.targetNode}
                onAction={handleContextMenuAction}
                onClose={closeContextMenu}
            />
        </div>
    );
}
