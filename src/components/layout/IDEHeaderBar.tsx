/**
 * @fileoverview IDE Header Bar Component
 * @module components/layout/IDEHeaderBar
 * 
 * Top navigation bar for the IDE with project name, sync controls,
 * and workspace management buttons.
 * 
 * @example
 * ```tsx
 * <IDEHeaderBar
 *   projectId="my-project"
 *   projectName="My Project"
 *   isChatVisible={true}
 *   onToggleChat={() => setIsChatVisible(!isChatVisible)}
 * />
 * ```
 */

import { MessageSquare, FolderOpen, Loader2, RefreshCw } from 'lucide-react';
import { useWorkspace } from '../../lib/workspace';

/**
 * Props for the IDEHeaderBar component.
 * 
 * @interface IDEHeaderBarProps
 */
export interface IDEHeaderBarProps {
    /** Current project ID */
    projectId: string | null;
    /** Whether the chat panel is visible */
    isChatVisible: boolean;
    /** Callback to toggle chat visibility */
    onToggleChat: () => void;
}

/**
 * IDEHeaderBar - Top navigation bar for the IDE.
 * 
 * Displays:
 * - Project name and branding
 * - Auto-sync toggle
 * - Sync Now button
 * - Open/Switch Folder button
 * - Permission state indicators
 * - Chat toggle
 * - Version indicator
 * 
 * @param props - Component props
 * @returns Header bar JSX element
 */
export function IDEHeaderBar({
    projectId,
    isChatVisible,
    onToggleChat,
}: IDEHeaderBarProps): React.JSX.Element {
    const {
        directoryHandle,
        permissionState,
        syncStatus,
        syncProgress,
        syncError,
        autoSync,
        isOpeningFolder,
        openFolder,
        switchFolder,
        syncNow,
        setAutoSync,
    } = useWorkspace();

    const isSyncing = syncStatus === 'syncing';
    const isDisabled = isOpeningFolder || isSyncing;

    return (
        <header className="h-10 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between shrink-0">
            <div className="flex items-center gap-3">
                <span className="text-cyan-400 font-bold tracking-tight">
                    via-gent
                </span>
                <span className="text-slate-600">/</span>
                <span className="font-medium text-slate-300">{projectId}</span>
            </div>
            <div className="flex items-center gap-4">
                {/* Conditional button rendering based on folder state */}
                {directoryHandle ? (
                    <FolderOpenedControls
                        autoSync={autoSync}
                        isDisabled={isDisabled}
                        isSyncing={isSyncing}
                        isOpeningFolder={isOpeningFolder}
                        syncProgress={syncProgress}
                        onSyncNow={syncNow}
                        onSwitchFolder={switchFolder}
                        onSetAutoSync={setAutoSync}
                    />
                ) : (
                    <OpenFolderButton
                        isDisabled={isDisabled}
                        isOpeningFolder={isOpeningFolder}
                        onOpenFolder={openFolder}
                    />
                )}

                {/* Permission state indicator */}
                {permissionState !== 'unknown' && permissionState !== 'granted' && (
                    <span className="text-xs text-slate-500">
                        FS: {permissionState}
                    </span>
                )}

                {/* Re-authorize button when permission needs prompt */}
                {permissionState === 'prompt' && directoryHandle && (
                    <button
                        onClick={openFolder}
                        className="text-xs text-cyan-400 hover:text-cyan-200 underline"
                        title="Re-authorize folder access"
                    >
                        Re-authorize
                    </button>
                )}

                {/* Permission denied warning */}
                {permissionState === 'denied' && (
                    <span className="text-xs text-amber-400">
                        Local folder access denied – using virtual workspace
                    </span>
                )}

                {/* Sync error indicator */}
                {syncError && (
                    <span className="text-xs text-amber-400" title={syncError}>
                        ⚠️{' '}
                        {syncError.length > 25
                            ? syncError.slice(0, 25) + '...'
                            : syncError}
                    </span>
                )}

                {/* Chat toggle */}
                <button
                    onClick={onToggleChat}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    title="Toggle Chat (⌘K)"
                >
                    <MessageSquare className="w-4 h-4" />
                    {isChatVisible ? 'Hide Chat' : 'Show Chat'}
                </button>

                {/* Version indicator */}
                <span className="text-xs text-slate-500">alpha-v0.1</span>
            </div>
        </header>
    );
}

// ============================================================================
// Sub-components
// ============================================================================

interface FolderOpenedControlsProps {
    autoSync: boolean;
    isDisabled: boolean;
    isSyncing: boolean;
    isOpeningFolder: boolean;
    syncProgress: { syncedFiles: number } | null;
    onSyncNow: () => void;
    onSwitchFolder: () => void;
    onSetAutoSync: (enabled: boolean) => Promise<void>;
}

/**
 * Controls shown when a folder is already open.
 * Includes auto-sync toggle, sync now, and switch folder buttons.
 */
function FolderOpenedControls({
    autoSync,
    isDisabled,
    isSyncing,
    isOpeningFolder,
    syncProgress,
    onSyncNow,
    onSwitchFolder,
    onSetAutoSync,
}: FolderOpenedControlsProps): React.JSX.Element {
    return (
        <>
            <label
                className={`flex items-center gap-2 text-xs transition-colors ${isDisabled
                        ? 'text-slate-500 cursor-not-allowed'
                        : 'text-slate-400 hover:text-slate-200 cursor-pointer'
                    }`}
                title={
                    autoSync
                        ? 'Disable automatic sync on project open'
                        : 'Enable automatic sync on project open'
                }
            >
                <input
                    type="checkbox"
                    className="sr-only"
                    checked={autoSync}
                    onChange={(event) => void onSetAutoSync(event.target.checked)}
                    disabled={isDisabled}
                />
                <span
                    className={
                        `relative inline-flex h-4 w-7 items-center rounded-full transition-colors ` +
                        (autoSync ? 'bg-cyan-500/40' : 'bg-slate-700')
                    }
                    aria-hidden="true"
                >
                    <span
                        className={
                            `inline-block h-3 w-3 transform rounded-full bg-slate-200 transition-transform ` +
                            (autoSync ? 'translate-x-3.5' : 'translate-x-0.5')
                        }
                    />
                </span>
                Auto-sync
            </label>

            {!autoSync && (
                <span className="text-xs text-amber-400">Auto-sync off</span>
            )}

            <button
                onClick={onSyncNow}
                disabled={isDisabled}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                title="Sync files to WebContainer"
            >
                {isSyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <RefreshCw className="w-4 h-4" />
                )}
                {isSyncing
                    ? `Syncing${syncProgress ? ` (${syncProgress.syncedFiles} files)` : '...'}`
                    : 'Sync Now'}
            </button>
            <button
                onClick={onSwitchFolder}
                disabled={isDisabled}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                title="Open a different project folder"
            >
                {isOpeningFolder ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <FolderOpen className="w-4 h-4" />
                )}
                {isOpeningFolder ? 'Switching...' : 'Switch Folder'}
            </button>
        </>
    );
}

interface OpenFolderButtonProps {
    isDisabled: boolean;
    isOpeningFolder: boolean;
    onOpenFolder: () => void;
}

/**
 * Button shown when no folder is open.
 */
function OpenFolderButton({
    isDisabled,
    isOpeningFolder,
    onOpenFolder,
}: OpenFolderButtonProps): React.JSX.Element {
    return (
        <button
            onClick={onOpenFolder}
            disabled={isDisabled}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            title="Open a project folder"
        >
            {isOpeningFolder ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <FolderOpen className="w-4 h-4" />
            )}
            {isOpeningFolder ? 'Opening...' : 'Open Folder'}
        </button>
    );
}
