/**
 * Editor Tab Bar component for managing multiple open files
 * @module components/ide/MonacoEditor/EditorTabBar
 */

import { X } from 'lucide-react';
import { getFileName } from '../../../lib/editor/language-utils';

export interface OpenFile {
    /** File path (unique identifier) */
    path: string;
    /** File content */
    content: string;
    /** Whether the file has unsaved changes */
    isDirty: boolean;
}

export interface EditorTabBarProps {
    /** List of open files */
    openFiles: OpenFile[];
    /** Currently active file path */
    activeFilePath: string | null;
    /** Callback when a tab is clicked */
    onTabClick: (path: string) => void;
    /** Callback when a tab close button is clicked */
    onTabClose: (path: string) => void;
}

/**
 * Tab bar component for switching between open files
 */
export function EditorTabBar({
    openFiles,
    activeFilePath,
    onTabClick,
    onTabClose,
}: EditorTabBarProps) {
    if (openFiles.length === 0) {
        return (
            <div className="h-9 bg-slate-900 border-b border-slate-800 flex items-center px-2">
                <span className="text-xs text-slate-500">No files open</span>
            </div>
        );
    }

    return (
        <div className="h-9 bg-slate-900 border-b border-slate-800 flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
            {openFiles.map((file) => {
                const isActive = file.path === activeFilePath;
                const fileName = getFileName(file.path);

                return (
                    <div
                        key={file.path}
                        className={`
              group flex items-center gap-2 h-full px-3 cursor-pointer
              border-r border-slate-800 min-w-0 max-w-[180px]
              transition-colors
              ${isActive
                                ? 'bg-slate-800 text-slate-200 border-t-2 border-t-cyan-500'
                                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                            }
            `}
                        onClick={() => onTabClick(file.path)}
                        title={file.path}
                    >
                        {/* Dirty indicator */}
                        {file.isDirty && (
                            <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
                        )}

                        {/* File name */}
                        <span className="truncate text-sm">{fileName}</span>

                        {/* Close button */}
                        <button
                            className={`
                p-0.5 rounded hover:bg-slate-700 flex-shrink-0
                ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                transition-opacity
              `}
                            onClick={(e) => {
                                e.stopPropagation();
                                onTabClose(file.path);
                            }}
                            title="Close file"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
