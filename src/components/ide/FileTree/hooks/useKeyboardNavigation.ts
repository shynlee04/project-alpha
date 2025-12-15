import { useCallback } from 'react';
import type { TreeNode } from '../types';

/**
 * Options for the useKeyboardNavigation hook.
 */
export interface UseKeyboardNavigationOptions {
    /** Root nodes of the tree */
    rootNodes: TreeNode[];
    /** Currently focused path */
    focusedPath: string | undefined;
    /** Set focused path */
    setFocusedPath: React.Dispatch<React.SetStateAction<string | undefined>>;
    /** Handle toggle for folders */
    handleToggle: (node: TreeNode) => Promise<void>;
    /** Handle select for files */
    handleSelect: (node: TreeNode) => void;
}

/**
 * Return type for the useKeyboardNavigation hook.
 */
export interface UseKeyboardNavigationResult {
    /** Keyboard event handler */
    handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Hook for keyboard navigation in the file tree.
 * 
 * @param options - Hook options
 * @returns Keyboard navigation handler
 */
export function useKeyboardNavigation(
    options: UseKeyboardNavigationOptions
): UseKeyboardNavigationResult {
    const {
        rootNodes,
        focusedPath,
        setFocusedPath,
        handleToggle,
        handleSelect,
    } = options;

    /**
     * Get all visible paths in order.
     */
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

    /**
     * Find a node by path.
     */
    const findNodeByPath = useCallback(
        (path: string): TreeNode | undefined => {
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
        },
        [rootNodes],
    );

    /**
     * Handle keyboard events.
     */
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
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
                    } else if (
                        currentNode?.type === 'directory' &&
                        currentNode.expanded &&
                        currentNode.children?.length
                    ) {
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
        },
        [focusedPath, getAllVisiblePaths, findNodeByPath, handleToggle, handleSelect, setFocusedPath],
    );

    return {
        handleKeyDown,
    };
}
