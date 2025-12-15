/**
 * @fileoverview FileTreeItem Component
 * Renders a single item in the file tree (file or folder)
 */

import React, { useState } from 'react';
import { useStore } from '@tanstack/react-store'
import { ChevronRight, ChevronDown, Loader2, Check, Clock, AlertTriangle } from 'lucide-react';
import { FileIcon } from './icons';
import type { FileTreeItemProps } from './types';
import { fileSyncStatusStore } from '../../../lib/workspace'
import { isPathExcluded } from '../../../lib/filesystem/exclusion-config'

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
    onRetryFile,
    isExcluded = false,
}: FileTreeItemProps): React.JSX.Element {

    const isSelected = selectedPath === node.path;
    const isFocused = focusedPath === node.path;
    const isDirectory = node.type === 'directory';
    const isExpanded = node.expanded ?? false;
    const isLoading = node.loading ?? false;

    const [isErrorDetailsOpen, setIsErrorDetailsOpen] = useState(false)
    const fileSyncStatus = useStore(fileSyncStatusStore, (map) => map.get(node.path))

    const isError = !isDirectory && fileSyncStatus?.state === 'error'
    const isPending = !isDirectory && fileSyncStatus?.state === 'pending'
    const isSynced = !isDirectory && fileSyncStatus?.state === 'synced'

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDirectory) {
            onToggle(node);
        } else {
            onSelect(node);
        }
    };

    const handleContextMenuEvent = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, node);
    };

    return (
        <div
            role="treeitem"
            aria-selected={isSelected}
            aria-expanded={isDirectory ? isExpanded : undefined}
            tabIndex={isFocused ? 0 : -1}
            className="outline-none"
            onClick={handleClick}
            onContextMenu={handleContextMenuEvent}
        >
            <div
                className={`
        flex items-center gap-1 h-7 cursor-pointer select-none
        text-sm hover:bg-slate-800/50
        ${isExcluded ? 'text-slate-500 opacity-60' : 'text-slate-300'}
        ${isSelected ? 'bg-cyan-500/20 text-cyan-200' : ''}
        ${isFocused ? 'outline outline-1 outline-cyan-500/50 outline-offset-[-1px]' : ''}
        transition-colors duration-75
      `}
                title={isExcluded ? 'Excluded from sync' : undefined}
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

                {/* Per-file sync status */}
                {!isDirectory && fileSyncStatus && (
                    <div className="ml-auto flex items-center gap-1 shrink-0">
                        {isSynced && (
                            <span title="Synced">
                                <Check size={14} className="text-emerald-400" />
                            </span>
                        )}

                        {isPending && (
                            <span title="Pending">
                                <Clock size={14} className="text-amber-400" />
                            </span>
                        )}

                        {isError && (
                            <button
                                type="button"
                                className="text-red-400 hover:text-red-300 transition-colors"
                                title={fileSyncStatus.errorMessage || 'Sync error'}
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setIsErrorDetailsOpen((prev) => !prev)
                                }}
                            >
                                <AlertTriangle size={14} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {isError && isErrorDetailsOpen && (
                <div
                    className="pl-10 pr-3 py-2 text-xs text-slate-200 bg-slate-900/60 border-b border-slate-800/40"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="text-red-300 break-words">
                        {fileSyncStatus?.errorMessage ?? 'Unknown error'}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                        <button
                            type="button"
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onRetryFile?.(node.path)
                            }}
                        >
                            Retry
                        </button>
                        <button
                            type="button"
                            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setIsErrorDetailsOpen(false)
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {isDirectory && isExpanded && node.children && (
                <div role="group" className="pl-3">
                    <FileTreeItemList
                        nodes={node.children}
                        depth={depth + 1}
                        selectedPath={selectedPath}
                        focusedPath={focusedPath}
                        onSelect={onSelect}
                        onToggle={onToggle}
                        onContextMenu={onContextMenu}
                        onRetryFile={onRetryFile}
                    />
                </div>
            )}
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
    onRetryFile?: (path: string) => void;
    /** Exclusion patterns to check against */
    exclusionPatterns?: string[];
}

export function FileTreeItemList({
    nodes,
    depth,
    selectedPath,
    focusedPath,
    onSelect,
    onToggle,
    onContextMenu,
    onRetryFile,
    exclusionPatterns = [],
}: FileTreeItemListProps): React.JSX.Element {
    // Sort: folders first, then files, both alphabetically
    const sortedNodes = [...nodes].sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    return (
        <>
            {sortedNodes.map((node) => (
                <FileTreeItem
                    key={node.path}
                    node={node}
                    depth={depth}
                    selectedPath={selectedPath}
                    focusedPath={focusedPath}
                    onSelect={onSelect}
                    onToggle={onToggle}
                    onContextMenu={onContextMenu}
                    onRetryFile={onRetryFile}
                    isExcluded={exclusionPatterns.length > 0 && isPathExcluded(node.path, exclusionPatterns)}
                />
            ))}
        </>
    );
}
