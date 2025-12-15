/**
 * @fileoverview FileTree Module Barrel Export
 * Exports all FileTree components, hooks, and types
 */

export { FileTree } from './FileTree';
export { FileTreeItem, FileTreeItemList } from './FileTreeItem';
export { FileIcon, getFileIconType, getIconColor, getIconComponent } from './icons';
export { ContextMenu } from './ContextMenu';

// Hooks
export {
    useFileTreeState,
    useFileTreeActions,
    useContextMenuActions,
    useKeyboardNavigation,
    buildTreeNode,
    updateNodeByPath,
} from './hooks';

// Types
export type {
    TreeNode,
    FileTreeProps,
    FileTreeItemProps,
    ContextMenuAction,
    ContextMenuState,
    FileIconType
} from './types';

