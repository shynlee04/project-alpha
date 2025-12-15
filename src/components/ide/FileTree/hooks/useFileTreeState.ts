import { useState, useCallback, useRef } from 'react';
import { LocalFSAdapter } from '../../../../lib/filesystem/local-fs-adapter';
import type { TreeNode, ContextMenuState } from '../types';

/**
 * Options for the useFileTreeState hook.
 */
export interface UseFileTreeStateOptions {
    /** Directory handle to use */
    directoryHandle: FileSystemDirectoryHandle | null | undefined;
    /** Key to trigger refresh */
    refreshKey?: number;
}

/**
 * Return type for the useFileTreeState hook.
 */
export interface UseFileTreeStateResult {
    /** Root nodes of the tree */
    rootNodes: TreeNode[];
    /** Set root nodes */
    setRootNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    /** Currently focused path */
    focusedPath: string | undefined;
    /** Set focused path */
    setFocusedPath: React.Dispatch<React.SetStateAction<string | undefined>>;
    /** Error message if any */
    error: string | null;
    /** Set error */
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    /** Whether tree is loading */
    isLoading: boolean;
    /** Set loading state */
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    /** Context menu state */
    contextMenu: ContextMenuState;
    /** Set context menu state */
    setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState>>;
    /** Ref to LocalFSAdapter */
    adapterRef: React.MutableRefObject<LocalFSAdapter | null>;
    /** Get or create adapter */
    getAdapter: () => LocalFSAdapter;
}

/**
 * Hook for managing FileTree state.
 * 
 * @param options - Hook options
 * @returns FileTree state and setters
 */
export function useFileTreeState(
    options: UseFileTreeStateOptions
): UseFileTreeStateResult {
    const { directoryHandle } = options;

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

    const adapterRef = useRef<LocalFSAdapter | null>(null);

    const getAdapter = useCallback(() => {
        if (!adapterRef.current) {
            adapterRef.current = new LocalFSAdapter();
        }
        if (directoryHandle) {
            adapterRef.current.setDirectoryHandle(directoryHandle);
        }
        return adapterRef.current;
    }, [directoryHandle]);

    return {
        rootNodes,
        setRootNodes,
        focusedPath,
        setFocusedPath,
        error,
        setError,
        isLoading,
        setIsLoading,
        contextMenu,
        setContextMenu,
        adapterRef,
        getAdapter,
    };
}
