/**
 * @fileoverview FileTree Component
 * @module components/ide/FileTree
 * 
 * Main file tree component for displaying and navigating project structure.
 *
 * Features:
 * - Hierarchical display of files and folders
 * - Expand/collapse folders with lazy loading
 * - File extension icons
 * - Context menu for CRUD operations
 * - Keyboard navigation
 * - Selection state
 * - Sync status integration
 * 
 * @example
 * ```tsx
 * <FileTree
 *   selectedPath={selectedFilePath}
 *   onFileSelect={handleFileSelect}
 *   refreshKey={fileTreeRefreshKey}
 * />
 * ```
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useStore } from '@tanstack/react-store';
import { FolderOpen, AlertCircle } from 'lucide-react';

// Internal components
import { FileTreeItemList } from './FileTreeItem';
import { ContextMenu } from './ContextMenu';
import { SyncStatusIndicator } from '../SyncStatusIndicator';

// Hooks
import {
  useFileTreeState,
  useFileTreeActions,
  useContextMenuActions,
  useKeyboardNavigation,
} from './hooks';

// State and types
import { fileSyncCountsStore, useWorkspace } from '../../../lib/workspace';
import type { TreeNode } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the FileTree component.
 * 
 * @interface FileTreeProps
 */
interface FileTreeProps {
  /** Currently selected file path */
  selectedPath?: string;
  /** Callback when a file is selected */
  onFileSelect: (path: string, handle: FileSystemFileHandle) => void;
  /** Key to trigger refresh (increment to refresh tree) */
  refreshKey?: number;
  /** Optional class name for styling */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * FileTree - Main file tree component.
 * 
 * Displays a hierarchical view of the project filesystem with:
 * - Folder expand/collapse
 * - File selection
 * - Context menu operations
 * - Keyboard navigation
 * - Sync status indicators
 * 
 * @param props - Component props
 * @returns FileTree JSX element
 */
export function FileTree({
  onFileSelect,
  selectedPath,
  className = '',
  refreshKey,
}: FileTreeProps): React.JSX.Element {
  // Workspace context
  const {
    directoryHandle,
    syncStatus,
    syncProgress,
    lastSyncTime,
    syncError,
    syncNow,
    localAdapterRef,
    syncManagerRef,
    exclusionPatterns,
  } = useWorkspace();

  // Sync counts for status display
  const fileSyncCounts = useStore(fileSyncCountsStore, (state) => state);

  // Container ref for focus management
  const treeRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // State Management
  // ============================================================================

  const {
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
    getAdapter,
  } = useFileTreeState({ directoryHandle, refreshKey });

  // ============================================================================
  // Actions
  // ============================================================================

  const {
    loadRootDirectory,
    handleToggle,
    handleRetryFile,
  } = useFileTreeActions({
    directoryHandle,
    getAdapter,
    setRootNodes,
    setError,
    setIsLoading,
    localAdapterRef,
    syncManagerRef,
  });

  // File selection handler
  const handleSelect = useCallback(
    (node: TreeNode) => {
      if (node.type === 'file' && onFileSelect) {
        onFileSelect(node.path, node.handle as FileSystemFileHandle);
      }
      setFocusedPath(node.path);
    },
    [onFileSelect, setFocusedPath],
  );

  // ============================================================================
  // Context Menu
  // ============================================================================

  const {
    handleContextMenu,
    closeContextMenu,
    handleContextMenuAction,
  } = useContextMenuActions({
    contextMenu,
    setContextMenu,
    directoryHandle,
    getAdapter,
    handleToggle,
    loadRootDirectory,
  });

  // ============================================================================
  // Keyboard Navigation
  // ============================================================================

  const { handleKeyDown } = useKeyboardNavigation({
    rootNodes,
    focusedPath,
    setFocusedPath,
    handleToggle,
    handleSelect,
  });

  // ============================================================================
  // Effects
  // ============================================================================

  // Load root when directory handle changes or refresh is triggered
  useEffect(() => {
    loadRootDirectory();
  }, [loadRootDirectory, refreshKey]);

  // ============================================================================
  // Render States
  // ============================================================================

  // Empty state - no directory
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

  // Error state
  if (error) {
    return (
      <div className={`h-full flex flex-col items-center justify-center text-red-400 p-4 ${className}`}>
        <AlertCircle size={32} className="mb-2" />
        <p className="text-sm text-center">{error}</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`h-full flex items-center justify-center text-slate-500 ${className}`}>
        <p className="text-sm">Loading...</p>
      </div>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Sync Status Header */}
      <div className="h-7 px-3 flex items-center justify-between border-b border-slate-800/30 bg-slate-900/30 shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {fileSyncCounts.total > 0 && (
            <>
              <span title="Pending files" className="text-amber-400">
                {fileSyncCounts.pending} pending
              </span>
              <span title="Files with errors" className="text-red-400">
                {fileSyncCounts.error} error
              </span>
              <span title="Synced files" className="text-emerald-400">
                {fileSyncCounts.synced} synced
              </span>
            </>
          )}
        </div>
        <SyncStatusIndicator
          status={syncStatus}
          progress={syncProgress}
          lastSyncTime={lastSyncTime}
          errorMessage={syncError}
          onRetry={syncNow}
        />
      </div>

      {/* File Tree Content */}
      <div
        ref={treeRef}
        role="tree"
        aria-label="File explorer"
        tabIndex={0}
        className="flex-1 overflow-auto focus:outline-none min-h-0"
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
          onRetryFile={handleRetryFile}
          exclusionPatterns={exclusionPatterns}
        />
      </div>

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
