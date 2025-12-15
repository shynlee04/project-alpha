/**
 * FileTree Utilities
 */
import type { DirectoryEntry } from '../../../lib/filesystem/local-fs-adapter';
import type { TreeNode } from './types';

/**
 * Build a TreeNode from a DirectoryEntry.
 * 
 * @param entry - Directory entry from file system
 * @param parentPath - Parent path for constructing full path
 * @returns TreeNode for the file tree
 */
export function buildTreeNode(entry: DirectoryEntry, parentPath: string): TreeNode {
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
 * Update a node in the tree by path.
 * 
 * @param nodes - Array of tree nodes
 * @param targetPath - Path of node to update
 * @param updater - Function to update the node
 * @returns Updated array of tree nodes
 */
export function updateNodeByPath(
    nodes: TreeNode[],
    targetPath: string,
    updater: (n: TreeNode) => TreeNode,
): TreeNode[] {
    return nodes.map((n) => {
        if (n.path === targetPath) {
            return updater(n);
        }
        if (n.children && n.path !== targetPath && targetPath.startsWith(n.path + '/')) {
            return {
                ...n,
                children: updateNodeByPath(n.children, targetPath, updater),
            };
        }
        return n;
    });
}
