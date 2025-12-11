import { useState, useCallback, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { MessageSquare, X, FolderOpen, Loader2 } from 'lucide-react'
import { XTerminal } from '../ide/XTerminal'
import { FileTree } from '../ide/FileTree'
import { MonacoEditor, type OpenFile } from '../ide/MonacoEditor'
import { PreviewPanel } from '../ide/PreviewPanel'
import { LocalFSAdapter, SyncManager, type SyncProgress, type SyncResult } from '../../lib/filesystem'
import {
    saveDirectoryHandleReference,
    loadDirectoryHandleReference,
    getPermissionState,
    ensureReadWritePermission,
    type FsaPermissionState,
} from '../../lib/filesystem/permission-lifecycle'
import {
    saveProject,
    updateProjectLastOpened,
} from '../../lib/workspace'
import { boot, onServerReady, isBooted } from '../../lib/webcontainer'
import { useEffect } from 'react'
import { useToast } from '../ui/Toast'

interface IDELayoutProps {
    projectId: string
}

export function IDELayout({ projectId }: IDELayoutProps) {
    const { toast } = useToast()
    const [isChatVisible, setIsChatVisible] = useState(true)
    const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null)
    const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>()
    const [isOpeningFolder, setIsOpeningFolder] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
    const [syncError, setSyncError] = useState<string | null>(null)
    const [permissionState, setPermissionState] = useState<FsaPermissionState>('unknown')

    // Monaco Editor state
    const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
    const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

    // FileTree refresh key (increment to trigger refresh)
    const [fileTreeRefreshKey, setFileTreeRefreshKey] = useState(0)

    // Preview panel state
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [previewPort, setPreviewPort] = useState<number | null>(null)

    // Keep a reference to the LocalFSAdapter for reading files
    const localAdapterRef = useRef<LocalFSAdapter | null>(null)

    // Keep a reference to the SyncManager for dual writes
    const syncManagerRef = useRef<SyncManager | null>(null)

    useEffect(() => {
        // Start booting WebContainer as soon as IDE layout mounts
        boot()
            .then(() => {
                // Subscribe to server-ready event for preview panel
                if (isBooted()) {
                    const unsubscribe = onServerReady((port, url) => {
                        console.log(`[IDE] Server ready on port ${port}: ${url}`);
                        setPreviewUrl(url);
                        setPreviewPort(port);
                    });
                    return unsubscribe;
                }
            })
            .catch(console.error);

        // Attempt to restore previously granted directory handle (Story 3.4)
        if (!LocalFSAdapter.isSupported()) {
            setPermissionState('denied');
            console.warn('[IDE] File System Access API not supported; using virtual-only mode.');
            return;
        }

        (async () => {
            try {
                const restored = await loadDirectoryHandleReference(projectId);
                if (!restored) return;

                setDirectoryHandle(restored);

                const state = await getPermissionState(restored, 'readwrite');
                setPermissionState(state);
                console.log('[IDE] FSA permission state on restore:', state);

                if (state !== 'granted') {
                    // Keep handle for potential re-prompt via Open Folder button
                    return;
                }

                // Story 3-7: Update lastOpened timestamp for dashboard sorting
                await updateProjectLastOpened(projectId);

                // Auto-sync when permission is still granted on reload
                setIsSyncing(true);
                const adapter = new LocalFSAdapter();
                adapter.setDirectoryHandle(restored);

                const syncManager = new SyncManager(adapter, {
                    onProgress: (progress) => {
                        setSyncProgress(progress);
                    },
                    onError: (error) => {
                        console.warn('[IDE] Sync error (restored):', error.message, error.filePath);
                    },
                    onComplete: (result: SyncResult) => {
                        console.log('[IDE] Sync complete (restored):', result);
                        if (result.failedFiles.length > 0) {
                            setSyncError(`Synced with ${result.failedFiles.length} failed files`);
                        }
                    },
                });

                syncManagerRef.current = syncManager;
                localAdapterRef.current = adapter;
                await syncManager.syncToWebContainer();
            } catch (error) {
                console.warn('[IDE] Failed to restore directory handle:', error);
            } finally {
                setIsSyncing(false);
                setSyncProgress(null);
            }
        })();
    }, []);

    const handleOpenFolder = useCallback(async () => {
        if (!LocalFSAdapter.isSupported()) {
            alert('File System Access API is not supported in this browser.');
            return;
        }

        setIsOpeningFolder(true);
        setSyncError(null);

        try {
            let handle = directoryHandle;

            // If we already have a handle, try to ensure read/write permission first
            if (handle) {
                const perm = await ensureReadWritePermission(handle);
                if (perm === 'denied') {
                    handle = null;
                    setPermissionState('denied');
                    console.warn('[IDE] FSA permission denied; switching to virtual-only mode.');
                } else {
                    setPermissionState('granted');
                }
            }

            const adapter = new LocalFSAdapter();

            // If no usable handle, fall back to requesting a new one via picker
            if (!handle) {
                const requested = await adapter.requestDirectoryAccess();
                handle = requested;
                setPermissionState('granted');
            } else {
                adapter.setDirectoryHandle(handle);
            }

            if (!handle) {
                throw new Error('No directory handle available after permission flow');
            }

            setDirectoryHandle(handle);

            // Story 3-7: Save to ProjectStore for dashboard integration
            const persisted = await saveProject({
                id: projectId,
                name: handle.name,
                folderPath: handle.name, // Display path only
                fsaHandle: handle,
                lastOpened: new Date(),
            });
            if (!persisted) {
                console.warn('[IDE] Failed to persist project metadata');
            }

            // Also save to legacy permission-lifecycle for backward compat
            await saveDirectoryHandleReference(handle, projectId);

            // Step 2: Create SyncManager and sync to WebContainers
            setIsSyncing(true);
            const syncManager = new SyncManager(adapter, {
                onProgress: (progress) => {
                    setSyncProgress(progress);
                },
                onError: (error) => {
                    console.warn('[IDE] Sync error:', error.message, error.filePath);
                    // Individual file errors don't stop the sync
                },
                onComplete: (result: SyncResult) => {
                    console.log('[IDE] Sync complete:', result);
                    if (result.failedFiles.length > 0) {
                        setSyncError(`Synced with ${result.failedFiles.length} failed files`);
                    }
                },
            });

            // Store reference for dual writes
            syncManagerRef.current = syncManager;
            localAdapterRef.current = adapter;

            // Perform initial sync
            await syncManager.syncToWebContainer();

        } catch (error) {
            console.error('Failed to open folder:', error);
            setSyncError(error instanceof Error ? error.message : 'Failed to open folder');
        } finally {
            setIsOpeningFolder(false);
            setIsSyncing(false);
            setSyncProgress(null);
        }
    }, [directoryHandle]);

    const handleFileSelect = useCallback(async (path: string, handle: FileSystemFileHandle) => {
        setSelectedFilePath(path);
        console.log('[IDE] File selected:', path);

        // Check if file is already open
        const existingFile = openFiles.find(f => f.path === path);
        if (existingFile) {
            setActiveFilePath(path);
            return;
        }

        // Read file content
        try {
            const file = await handle.getFile();
            const content = await file.text();

            // Add to open files
            setOpenFiles(prev => [...prev, { path, content, isDirty: false }]);
            setActiveFilePath(path);
        } catch (error) {
            console.error('[IDE] Failed to read file:', path, error);
        }
    }, [openFiles]);

    // Handle file save (called by Monaco auto-save)
    const handleSave = useCallback(async (path: string, content: string) => {
        console.log('[IDE] Saving file:', path);
        try {
            if (syncManagerRef.current) {
                await syncManagerRef.current.writeFile(path, content);
                // Update openFiles to mark as not dirty
                setOpenFiles(prev =>
                    prev.map(f => (f.path === path ? { ...f, content, isDirty: false } : f))
                );
                console.log('[IDE] File saved successfully:', path);
                // Trigger FileTree refresh to detect any new files
                setFileTreeRefreshKey(prev => prev + 1);
            } else {
                console.warn('[IDE] No SyncManager available for save');
                toast('No project folder open - save skipped', 'warning');
            }
        } catch (error) {
            console.error('[IDE] Failed to save file:', path, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast(`Failed to save ${path.split('/').pop()}: ${errorMessage}`, 'error');
        }
    }, [toast]);

    // Handle content change (update dirty state)
    const handleContentChange = useCallback((path: string, content: string) => {
        setOpenFiles(prev =>
            prev.map(f => (f.path === path ? { ...f, content, isDirty: true } : f))
        );
    }, []);

    // Handle tab close
    const handleTabClose = useCallback((path: string) => {
        setOpenFiles(prev => prev.filter(f => f.path !== path));
        // If closing active file, switch to another open file
        if (activeFilePath === path) {
            setActiveFilePath(openFiles.find(f => f.path !== path)?.path ?? null);
        }
    }, [activeFilePath, openFiles]);

    return (
        <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col">
            {/* Top Bar */}
            <header className="h-10 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-cyan-400 font-bold tracking-tight">via-gent</span>
                    <span className="text-slate-600">/</span>
                    <span className="font-medium text-slate-300">{projectId}</span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleOpenFolder}
                        disabled={isOpeningFolder || isSyncing}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                        title="Open Folder"
                    >
                        {isSyncing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <FolderOpen className="w-4 h-4" />
                        )}
                        {isOpeningFolder
                            ? 'Opening...'
                            : isSyncing
                                ? `Syncing${syncProgress ? ` (${syncProgress.syncedFiles} files)` : '...'}`
                                : 'Open Folder'}
                    </button>
                    {permissionState !== 'unknown' && (
                        <span className="text-xs text-slate-500">
                            FS: {permissionState}
                        </span>
                    )}
                    {permissionState === 'prompt' && (
                        <button
                            onClick={handleOpenFolder}
                            className="text-xs text-cyan-400 hover:text-cyan-200 underline"
                        >
                            Re-authorize
                        </button>
                    )}
                    {permissionState === 'denied' && (
                        <span className="text-xs text-amber-400">
                            Local folder access denied – using virtual workspace
                        </span>
                    )}
                    {syncError && (
                        <span className="text-xs text-amber-400" title={syncError}>
                            ⚠️ {syncError.length > 25 ? syncError.slice(0, 25) + '...' : syncError}
                        </span>
                    )}
                    <button
                        onClick={() => setIsChatVisible(!isChatVisible)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                        title="Toggle Chat (⌘K)"
                    >
                        <MessageSquare className="w-4 h-4" />
                        {isChatVisible ? 'Hide Chat' : 'Show Chat'}
                    </button>
                    <span className="text-xs text-slate-500">alpha-v0.1</span>
                </div>
            </header>

            {/* Main Resizable Layout */}
            <PanelGroup direction="horizontal" className="flex-1" autoSaveId="via-gent-ide-main">
                {/* Left Sidebar - FileTree */}
                <Panel
                    defaultSize={20}
                    minSize={10}
                    maxSize={30}
                    className="bg-slate-900/50"
                >
                    <div className="h-full flex flex-col border-r border-slate-800">
                        <div className="h-9 px-4 flex items-center text-xs font-semibold text-slate-400 tracking-wider uppercase border-b border-slate-800/50">
                            Explorer
                        </div>
                        <div className="flex-1 min-h-0">
                            <FileTree
                                directoryHandle={permissionState === 'granted' ? directoryHandle : null}
                                selectedPath={selectedFilePath}
                                onFileSelect={handleFileSelect}
                                refreshKey={fileTreeRefreshKey}
                            />
                        </div>
                    </div>
                </Panel>

                <PanelResizeHandle className="w-1 bg-slate-800 hover:bg-cyan-500/50 transition-colors cursor-col-resize" />

                {/* Center Area - Editor + Terminal (Vertical Split) */}
                <Panel minSize={30}>
                    <PanelGroup direction="vertical" autoSaveId="via-gent-ide-center">
                        {/* Editor + Preview (Horizontal Split) */}
                        <Panel defaultSize={70} minSize={30}>
                            <PanelGroup direction="horizontal" autoSaveId="via-gent-ide-editor">
                                {/* Editor */}
                                <Panel defaultSize={60} minSize={30} className="bg-slate-950">
                                    <MonacoEditor
                                        openFiles={openFiles}
                                        activeFilePath={activeFilePath}
                                        onSave={handleSave}
                                        onActiveFileChange={setActiveFilePath}
                                        onTabClose={handleTabClose}
                                        onContentChange={handleContentChange}
                                    />
                                </Panel>

                                <PanelResizeHandle className="w-1 bg-slate-800 hover:bg-cyan-500/50 transition-colors cursor-col-resize" />

                                {/* Preview */}
                                <Panel defaultSize={40} minSize={15} className="bg-slate-900/30">
                                    <PreviewPanel
                                        previewUrl={previewUrl}
                                        port={previewPort}
                                    />
                                </Panel>
                            </PanelGroup>
                        </Panel>

                        <PanelResizeHandle className="h-1 bg-slate-800 hover:bg-cyan-500/50 transition-colors cursor-row-resize" />

                        {/* Terminal */}
                        <Panel
                            defaultSize={30}
                            minSize={10}
                            maxSize={50}
                            className="bg-slate-900"
                        >
                            <div className="h-full flex flex-col border-t border-slate-800">
                                <div className="h-8 px-4 flex items-center gap-6 border-b border-slate-800/50">
                                    <span className="text-xs font-medium text-cyan-400 border-b-2 border-cyan-400 h-full flex items-center">Terminal</span>
                                    <span className="text-xs font-medium text-slate-500 hover:text-slate-300 cursor-pointer h-full flex items-center">Output</span>
                                    <span className="text-xs font-medium text-slate-500 hover:text-slate-300 cursor-pointer h-full flex items-center">Problems</span>
                                </div>
                                <div className="flex-1 bg-slate-950 min-h-0 relative">
                                    <XTerminal />
                                </div>
                            </div>
                        </Panel>
                    </PanelGroup>
                </Panel>

                {/* Right Sidebar - Chat (Collapsible) */}
                {isChatVisible && (
                    <>
                        <PanelResizeHandle className="w-1 bg-slate-800 hover:bg-cyan-500/50 transition-colors cursor-col-resize" />
                        <Panel
                            defaultSize={25}
                            minSize={15}
                            maxSize={40}
                            className="bg-slate-900/50"
                        >
                            <div className="h-full flex flex-col border-l border-slate-800">
                                <div className="h-9 px-4 flex items-center justify-between border-b border-slate-800/50">
                                    <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Agent Chat</span>
                                    <button
                                        onClick={() => setIsChatVisible(false)}
                                        className="text-slate-500 hover:text-slate-300 transition-colors"
                                        title="Close chat panel"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex-1 p-4 flex flex-col">
                                    <div className="flex-1 text-sm text-slate-500 italic flex items-center justify-center">
                                        Chat Messages Placeholder
                                    </div>
                                    <div className="mt-4">
                                        <input
                                            type="text"
                                            placeholder="Ask the agent... (⌘K)"
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                                        />
                                    </div>
                                </div>
                            </div>
                        </Panel>
                    </>
                )}
            </PanelGroup>

            {/* Minimum Viewport Warning */}
            <MinViewportWarning />
        </div>
    )
}

function MinViewportWarning() {
    return (
        <div className="fixed inset-0 bg-slate-950/95 z-50 hidden min-[1024px]:hidden items-center justify-center p-8 text-center max-[1023px]:flex">
            <div>
                <h2 className="text-xl font-semibold text-white mb-2">Screen Too Small</h2>
                <p className="text-slate-400 text-sm">
                    via-gent IDE requires a minimum viewport width of 1024px.
                    <br />
                    Please resize your browser window or use a larger screen.
                </p>
            </div>
        </div>
    )
}
