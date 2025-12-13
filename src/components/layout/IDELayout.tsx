import { useState, useCallback, useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { MessageSquare, X, FolderOpen, Loader2, RefreshCw } from 'lucide-react'
import { XTerminal } from '../ide/XTerminal'
import { FileTree } from '../ide/FileTree'
import { MonacoEditor, type OpenFile } from '../ide/MonacoEditor'
import { PreviewPanel } from '../ide/PreviewPanel'
import { AgentChatPanel } from '../ide/AgentChatPanel'
// Story 3-8: Use Workspace Context
import { useWorkspace } from '../../lib/workspace'
import { boot, onServerReady, isBooted } from '../../lib/webcontainer'
import { useToast } from '../ui/Toast'

// Story 3-8: IDELayout no longer needs props as it consumes context
export function IDELayout() {
  const { toast } = useToast()

  // Use Workspace Context
  // Story 3-5: Added directoryHandle, switchFolder, syncNow for folder switching UI
  const {
    projectId,
    projectMetadata,
    directoryHandle,
    permissionState,
    syncStatus,
    syncProgress,
    syncError,
    isOpeningFolder,
    openFolder,
    switchFolder,
    syncNow,
    syncManagerRef,
  } = useWorkspace()

  const [isChatVisible, setIsChatVisible] = useState(true)
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey
      if (!isModifierPressed || event.key.toLowerCase() !== 'k') return

      const target = event.target
      if (target instanceof HTMLElement) {
        const tagName = target.tagName?.toLowerCase()
        const isEditable =
          tagName === 'input' ||
          tagName === 'textarea' ||
          target.isContentEditable ||
          Boolean(target.closest('.monaco-editor'))

        if (isEditable) return
      }

      event.preventDefault()
      setIsChatVisible(true)
      window.dispatchEvent(new CustomEvent('ide.chat.focus'))
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Monaco Editor state
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

  // FileTree refresh key (increment to trigger refresh)
  const [fileTreeRefreshKey, setFileTreeRefreshKey] = useState(0)

  // Preview panel state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewPort, setPreviewPort] = useState<number | null>(null)

  useEffect(() => {
    // Start booting WebContainer as soon as IDE layout mounts
    boot()
      .then(() => {
        // Subscribe to server-ready event for preview panel
        if (isBooted()) {
          const unsubscribe = onServerReady((port, url) => {
            console.log(`[IDE] Server ready on port ${port}: ${url}`)
            setPreviewUrl(url)
            setPreviewPort(port)
          })
          return unsubscribe
        }
      })
      .catch(console.error)

    // Story 3-8: Handle restoration and permissions is now managed by WorkspaceContext
  }, [])

  const handleFileSelect = useCallback(
    async (path: string, handle: FileSystemFileHandle) => {
      setSelectedFilePath(path)
      console.log('[IDE] File selected:', path)

      // Check if file is already open
      const existingFile = openFiles.find((f) => f.path === path)
      if (existingFile) {
        setActiveFilePath(path)
        return
      }

      // Read file content
      try {
        const file = await handle.getFile()
        const content = await file.text()

        // Add to open files
        setOpenFiles((prev) => [...prev, { path, content, isDirty: false }])
        setActiveFilePath(path)
      } catch (error) {
        console.error('[IDE] Failed to read file:', path, error)
      }
    },
    [openFiles],
  )

  // Handle file save (called by Monaco auto-save)
  const handleSave = useCallback(
    async (path: string, content: string) => {
      console.log('[IDE] Saving file:', path)
      try {
        if (syncManagerRef.current) {
          await syncManagerRef.current.writeFile(path, content)
          // Update openFiles to mark as not dirty
          setOpenFiles((prev) =>
            prev.map((f) =>
              f.path === path ? { ...f, content, isDirty: false } : f,
            ),
          )
          console.log('[IDE] File saved successfully:', path)
          // Trigger FileTree refresh to detect any new files
          setFileTreeRefreshKey((prev) => prev + 1)
        } else {
          console.warn('[IDE] No SyncManager available for save')
          toast('No project folder open - save skipped', 'warning')
        }
      } catch (error) {
        console.error('[IDE] Failed to save file:', path, error)
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        toast(
          `Failed to save ${path.split('/').pop()}: ${errorMessage}`,
          'error',
        )
      }
    },
    [toast, syncManagerRef],
  )

  // Handle content change (update dirty state)
  const handleContentChange = useCallback((path: string, content: string) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content, isDirty: true } : f)),
    )
  }, [])

  // Handle tab close
  const handleTabClose = useCallback(
    (path: string) => {
      setOpenFiles((prev) => prev.filter((f) => f.path !== path))
      // If closing active file, switch to another open file
      if (activeFilePath === path) {
        setActiveFilePath(openFiles.find((f) => f.path !== path)?.path ?? null)
      }
    },
    [activeFilePath, openFiles],
  )

  // Derived state for button labels
  const isSyncing = syncStatus === 'syncing'
  const isDisabled = isOpeningFolder || isSyncing

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col">
      {/* Top Bar */}
      <header className="h-10 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 font-bold tracking-tight">
            via-gent
          </span>
          <span className="text-slate-600">/</span>
          <span className="font-medium text-slate-300">{projectId}</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Story 3-5: Conditional button rendering based on folder state */}
          {directoryHandle ? (
            /* Folder is open: Show Sync + Switch Folder buttons */
            <>
              <button
                onClick={syncNow}
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
                  : 'Sync'}
              </button>
              <button
                onClick={switchFolder}
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
          ) : (
            /* No folder open: Show single Open Folder button */
            <button
              onClick={openFolder}
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
            onClick={() => setIsChatVisible(!isChatVisible)}
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

      {/* Main Resizable Layout */}
      <PanelGroup
        direction="horizontal"
        className="flex-1"
        autoSaveId="via-gent-ide-main"
      >
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
              <PanelGroup
                direction="horizontal"
                autoSaveId="via-gent-ide-editor"
              >
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
                <Panel
                  defaultSize={40}
                  minSize={15}
                  className="bg-slate-900/30"
                >
                  <PreviewPanel previewUrl={previewUrl} port={previewPort} />
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
                  <span className="text-xs font-medium text-cyan-400 border-b-2 border-cyan-400 h-full flex items-center">
                    Terminal
                  </span>
                  <span className="text-xs font-medium text-slate-500 hover:text-slate-300 cursor-pointer h-full flex items-center">
                    Output
                  </span>
                  <span className="text-xs font-medium text-slate-500 hover:text-slate-300 cursor-pointer h-full flex items-center">
                    Problems
                  </span>
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
                  <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                    Agent Chat
                  </span>
                  <button
                    onClick={() => setIsChatVisible(false)}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                    title="Close chat panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <AgentChatPanel projectName={projectMetadata?.name ?? projectId ?? 'Project'} />
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
        <h2 className="text-xl font-semibold text-white mb-2">
          Screen Too Small
        </h2>
        <p className="text-slate-400 text-sm">
          via-gent IDE requires a minimum viewport width of 1024px.
          <br />
          Please resize your browser window or use a larger screen.
        </p>
      </div>
    </div>
  )
}
