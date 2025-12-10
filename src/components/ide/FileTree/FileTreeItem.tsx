/**
 * @fileoverview FileTreeItem Component
 * Renders a single item in the file tree (file or folder)
 */

import React from 'react';
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { FileIcon } from './icons';
import type { FileTreeItemProps } from './types';

/**
 * FileTreeItem - Renders a single file or folder in the tree
 */
export function FileTreeItem({
    node,
    depth,
    selectedPath,
    focusedPath,
    onSelect,
    onToggle,
    onContextMenu,
}: FileTreeItemProps): React.JSX.Element {
    const isSelected = selectedPath === node.path;
    const isFocused = focusedPath === node.path;
    const isDirectory = node.type === 'directory';
    const isExpanded = node.expanded ?? false;
    const isLoading = node.loading ?? false;

    // Indentation: 12px per depth level
    const paddingLeft = 8 + depth * 12;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDirectory) {
            onToggle(node);
        } else {
            onSelect(node);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (isDirectory) {
                onToggle(node);
            } else {
                onSelect(node);
            }
        } else if (e.key === 'ArrowRight' && isDirectory && !isExpanded) {
            e.preventDefault();
            onToggle(node);
        } else if (e.key === 'ArrowLeft' && isDirectory && isExpanded) {
            e.preventDefault();
            onToggle(node);
        }
    };

    const handleContextMenuEvent = (e: React.MouseEvent) => {
        e.preventDefault();
        onContextMenu(e, node);
    };

    return (
        <div
            role="treeitem"
            aria-selected={isSelected}
            aria-expanded={isDirectory ? isExpanded : undefined}
            tabIndex={isFocused ? 0 : -1}
            className={`
        flex items-center gap-1 h-7 cursor-pointer select-none
        text-sm text-slate-300 hover:bg-slate-800/50
        ${isSelected ? 'bg-cyan-500/20 text-cyan-200' : ''}
        ${isFocused ? 'outline outline-1 outline-cyan-500/50 outline-offset-[-1px]' : ''}
        transition-colors duration-75
      `}
            style={{ paddingLeft: `${paddingLeft}px`, paddingRight: '8px' }}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onContextMenu={handleContextMenuEvent}
        >
            {/* Chevron for directories */}
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
                {isDirectory && (
                    isLoading ? (
                        <Loader2 size={12} className="text-slate-500 animate-spin" />
                    ) : isExpanded ? (
                        <ChevronDown size={12} className="text-slate-500" />
                    ) : (
                        <ChevronRight size={12} className="text-slate-500" />
                    )
                )}
            </div>

            {/* File/Folder Icon */}
            <FileIcon
                filename={node.name}
                isDirectory={isDirectory}
                isExpanded={isExpanded}
                size={16}
            />

            {/* Name */}
            <span className="truncate">{node.name}</span>
        </div>
    );
}

/**
 * FileTreeItemList - Renders a list of tree items with their children
 */
interface FileTreeItemListProps {
    nodes: Array<import('./types').TreeNode>;
    depth: number;
    selectedPath?: string;
    focusedPath?: string;
    onSelect: (node: import('./types').TreeNode) => void;
    onToggle: (node: import('./types').TreeNode) => void;
    onContextMenu: (event: React.MouseEvent, node: import('./types').TreeNode) => void;
}

export function FileTreeItemList({
    nodes,
    depth,
    selectedPath,
    focusedPath,
    onSelect,
    onToggle,
    onContextMenu,
}: FileTreeItemListProps): React.JSX.Element {
    // Sort: folders first, then files, both alphabetically
    const sortedNodes = [...nodes].sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    return (
        <div role="group">
            {sortedNodes.map((node) => (
                <div key={node.path}>
                    <FileTreeItem
                        node={node}
                        depth={depth}
                        selectedPath={selectedPath}
                        focusedPath={focusedPath}
                        onSelect={onSelect}
                        onToggle={onToggle}
                        onContextMenu={onContextMenu}
                    />
                    {/* Render children if expanded */}
                    {node.type === 'directory' && node.expanded && node.children && (
                        <FileTreeItemList
                            nodes={node.children}
                            depth={depth + 1}
                            selectedPath={selectedPath}
                            focusedPath={focusedPath}
                            onSelect={onSelect}
                            onToggle={onToggle}
                            onContextMenu={onContextMenu}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
