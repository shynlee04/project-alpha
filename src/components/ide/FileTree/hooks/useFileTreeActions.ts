import { useCallback } from 'react';
import {
    LocalFSAdapter,
    FileSystemError,
    PermissionDeniedError,
} from '../../../../lib/filesystem/local-fs-adapter';
import type { TreeNode } from '../types';
import { buildTreeNode, updateNodeByPath } from '../utils';

/**
 * Options for the useFileTreeActions hook.
 */
export interface UseFileTreeActionsOptions {
    /** Directory handle */
    directoryHandle: FileSystemDirectoryHandle | null | undefined;
    /** Get adapter function */
    getAdapter: () => LocalFSAdapter;
    /** Set root nodes */
    setRootNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    /** Set error */
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    /** Set loading */
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    /** Local adapter ref from workspace */
    localAdapterRef: React.RefObject<LocalFSAdapter | null>;
    /** Sync manager ref from workspace */
    syncManagerRef: React.RefObject<import('../../../../lib/filesystem').SyncManager | null>;
}

/**
 * Return type for the useFileTreeActions hook.
 */
export interface UseFileTreeActionsResult {
    /** Load root directory */
    loadRootDirectory: () => Promise<void>;
    /** Load children of a node */
    loadChildren: (node: TreeNode) => Promise<TreeNode[]>;
    /** Toggle folder expand/collapse */
    handleToggle: (node: TreeNode) => Promise<void>;
    /** Retry syncing a file */
    handleRetryFile: (path: string) => Promise<void>;
}

/**
 * Hook for FileTree actions.
 * 
 * @param options - Hook options
 * @returns FileTree actions
 */
export function useFileTreeActions(
    options: UseFileTreeActionsOptions
): UseFileTreeActionsResult {
    const {
        directoryHandle,
        getAdapter,
        setRootNodes,
        setError,
        setIsLoading,
        localAdapterRef,
        syncManagerRef,
    } = options;

    /**
     * Load root directory contents.
     */
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
            adapter.setDirectoryHandle(directoryHandle);

            const entries = await adapter.listDirectory('');
            const nodes = entries.map((entry) => buildTreeNode(entry, ''));
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
    }, [directoryHandle, getAdapter, setRootNodes, setError, setIsLoading]);

    /**
     * Load children of a directory node.
     */
    const loadChildren = useCallback(
        async (node: TreeNode): Promise<TreeNode[]> => {
            if (!directoryHandle) return [];

            try {
                const adapter = getAdapter();
                adapter.setDirectoryHandle(directoryHandle);

                const entries = await adapter.listDirectory(node.path);
                return entries.map((entry) => buildTreeNode(entry, node.path));
            } catch (err) {
                console.error('Error loading children:', err);
                return [];
            }
        },
        [directoryHandle, getAdapter],
    );

    /**
     * Toggle folder expand/collapse.
     */
    const handleToggle = useCallback(
        async (node: TreeNode) => {
            if (node.type !== 'directory') return;

            if (node.expanded) {
                // Collapse
                setRootNodes((prev) =>
                    updateNodeByPath(prev, node.path, (n) => ({
                        ...n,
                        expanded: false,
                    })),
                );
            } else {
                // Expand - load children if needed
                if (!node.children) {
                    // Set loading
                    setRootNodes((prev) =>
                        updateNodeByPath(prev, node.path, (n) => ({
                            ...n,
                            loading: true,
                        })),
                    );

                    const children = await loadChildren(node);

                    setRootNodes((prev) =>
                        updateNodeByPath(prev, node.path, (n) => ({
                            ...n,
                            loading: false,
                            expanded: true,
                            children,
                        })),
                    );
                } else {
                    setRootNodes((prev) =>
                        updateNodeByPath(prev, node.path, (n) => ({
                            ...n,
                            expanded: true,
                        })),
                    );
                }
            }
        },
        [loadChildren, setRootNodes],
    );

    /**
     * Retry syncing a file.
     */
    const handleRetryFile = useCallback(
        async (path: string) => {
            if (!directoryHandle) return;

            const adapter = localAdapterRef.current;
            const syncManager = syncManagerRef.current;
            if (!adapter || !syncManager) return;

            try {
                // Dynamic import to avoid circular dependencies
                const { setFileSyncPending } = await import('../../../../lib/workspace');

                adapter.setDirectoryHandle(directoryHandle);
                setFileSyncPending(path);
                const fileResult = await adapter.readFile(path);
                await syncManager.writeFile(path, fileResult.content);
            } catch (error) {
                // We need to import setFileSyncError here as well if it failed before the previous import
                const { setFileSyncError } = await import('../../../../lib/workspace');
                const err = error instanceof Error ? error : new Error('Unknown error');
                setFileSyncError(path, err);
            }
        },
        [directoryHandle, localAdapterRef, syncManagerRef],
    );

    return {
        loadRootDirectory,
        loadChildren,
        handleToggle,
        handleRetryFile,
    };
}
