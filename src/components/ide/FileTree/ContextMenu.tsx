/**
 * @fileoverview ContextMenu Component
 * Right-click context menu for file tree operations
 */

import React, { useEffect, useRef } from 'react';
import { FilePlus, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import type { ContextMenuAction, TreeNode } from './types';

interface ContextMenuProps {
    visible: boolean;
    x: number;
    y: number;
    targetNode: TreeNode | null;
    onAction: (action: ContextMenuAction) => void;
    onClose: () => void;
}

/**
 * ContextMenu - File tree context menu with CRUD operations
 */
export function ContextMenu({
    visible,
    x,
    y,
    targetNode,
    onAction,
    onClose,
}: ContextMenuProps): React.JSX.Element | null {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!visible) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        // Delay to avoid immediate close
        const timeoutId = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [visible, onClose]);

    // Focus menu when visible
    useEffect(() => {
        if (visible && menuRef.current) {
            menuRef.current.focus();
        }
    }, [visible]);

    if (!visible || !targetNode) {
        return null;
    }

    const menuItems: Array<{
        action: ContextMenuAction;
        label: string;
        icon: React.ReactNode;
        destructive?: boolean;
    }> = [
            { action: 'new-file', label: 'New File', icon: <FilePlus size={14} /> },
            { action: 'new-folder', label: 'New Folder', icon: <FolderPlus size={14} /> },
            { action: 'rename', label: 'Rename', icon: <Pencil size={14} /> },
            { action: 'delete', label: 'Delete', icon: <Trash2 size={14} />, destructive: true },
        ];

    // Only show new file/folder for directories
    const filteredItems = targetNode.type === 'directory'
        ? menuItems
        : menuItems.filter(item => item.action !== 'new-file' && item.action !== 'new-folder');

    const handleAction = (action: ContextMenuAction) => {
        onAction(action);
        onClose();
    };

    return (
        <div
            ref={menuRef}
            role="menu"
            tabIndex={-1}
            className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{
                left: `${x}px`,
                top: `${y}px`,
                // Prevent menu from going off-screen
                maxWidth: 'calc(100vw - 20px)',
            }}
        >
            {filteredItems.map((item, index) => (
                <button
                    key={item.action}
                    role="menuitem"
                    className={`
            w-full px-3 py-1.5 text-left text-sm flex items-center gap-2
            ${item.destructive
                            ? 'text-red-400 hover:bg-red-500/20'
                            : 'text-slate-300 hover:bg-slate-700/50'
                        }
            ${index === 0 ? '' : ''}
            transition-colors
          `}
                    onClick={() => handleAction(item.action)}
                >
                    {item.icon}
                    {item.label}
                </button>
            ))}
        </div>
    );
}
