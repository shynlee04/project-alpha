/**
 * @fileoverview IDE Layout Component
 * @module components/layout/IDELayout
 * 
 * Main IDE layout component that orchestrates all IDE panels.
 * Uses react-resizable-panels for a VS Code-like layout with:
 * - Left sidebar (FileTree)
 * - Center area (Editor + Preview)
 * - Bottom panel (Terminal)
 * - Right sidebar (Agent Chat)
 * 
 * @example
 * ```tsx
 * <WorkspaceProvider projectId="my-project">
 *   <IDELayout />
 * </WorkspaceProvider>
 * ```
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelGroupHandle,
} from 'react-resizable-panels';

// Layout sub-components
import { IDEHeaderBar } from './IDEHeaderBar';
import { TerminalPanel } from './TerminalPanel';
import { ChatPanelWrapper } from './ChatPanelWrapper';

// IDE components
import { FileTree } from '../ide/FileTree';
import { MonacoEditor, type OpenFile } from '../ide/MonacoEditor';
import { PreviewPanel } from '../ide/PreviewPanel';

// Hooks and context
import { useIdeStatePersistence } from '../../hooks/useIdeStatePersistence';
import { useWorkspace, type TerminalTab } from '../../lib/workspace';
import { boot, onServerReady, isBooted } from '../../lib/webcontainer';
import { useToast } from '../ui/Toast';

/**
 * IDELayout - Main IDE layout component.
 * 
 * Consumes WorkspaceContext for project state and provides:
 * - Resizable panel layout
 * - File tree navigation
 * - Monaco editor with tabs
 * - Preview panel for dev server
 * - Terminal panel
 * - Agent chat panel
 * - IDE state persistence
 * 
 * @returns IDE layout JSX element
 */
export function IDELayout(): React.JSX.Element {
  const { toast } = useToast();

  // Workspace context
  const {
    projectId,
    projectMetadata,
    permissionState,
    syncStatus,
    localAdapterRef,
    syncManagerRef,
    eventBus,
  } = useWorkspace();

  // UI state
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>();
  const [terminalTab, setTerminalTab] = useState<TerminalTab>('terminal');
  const [fileTreeRefreshKey, setFileTreeRefreshKey] = useState(0);

  // Editor state
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPort, setPreviewPort] = useState<number | null>(null);

  // Panel refs
  const mainPanelGroupRef = useRef<ImperativePanelGroupHandle | null>(null);
  const centerPanelGroupRef = useRef<ImperativePanelGroupHandle | null>(null);
  const editorPanelGroupRef = useRef<ImperativePanelGroupHandle | null>(null);

  // State persistence
  const {
    restoredIdeState,
    appliedPanelGroupsRef,
    didRestoreOpenFilesRef,
    activeFileScrollTopRef,
    openFilePathsRef,
    activeFilePathRef,
    terminalTabRef,
    chatVisibleRef,
    scheduleIdeStatePersistence,
    handlePanelLayoutChange,
  } = useIdeStatePersistence({ projectId });


  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (!isModifierPressed || event.key.toLowerCase() !== 'k') return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName?.toLowerCase();
        const isEditable =
          tagName === 'input' ||
          tagName === 'textarea' ||
          target.isContentEditable ||
          Boolean(target.closest('.monaco-editor'));

        if (isEditable) return;
      }

      event.preventDefault();
      setIsChatVisible(true);
      window.dispatchEvent(new CustomEvent('ide.chat.focus'));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ============================================================================
  // State Sync with Refs
  // ============================================================================

  const openFilePathsKey = openFiles.map((f) => f.path).join('\0');

  useEffect(() => {
    openFilePathsRef.current = openFiles.map((f) => f.path);
  }, [openFilePathsKey, openFilePathsRef]);

  useEffect(() => {
    activeFilePathRef.current = activeFilePath;
  }, [activeFilePath, activeFilePathRef]);

  useEffect(() => {
    terminalTabRef.current = terminalTab;
  }, [terminalTab, terminalTabRef]);

  useEffect(() => {
    chatVisibleRef.current = isChatVisible;
  }, [isChatVisible, chatVisibleRef]);

  useEffect(() => {
    scheduleIdeStatePersistence(250);
  }, [scheduleIdeStatePersistence, openFilePathsKey, activeFilePath, terminalTab, isChatVisible]);

  // ============================================================================
  // State Restoration
  // ============================================================================

  // Restore UI state from saved state
  useEffect(() => {
    if (!restoredIdeState) return;
    setIsChatVisible(restoredIdeState.chatVisible);
    setTerminalTab(restoredIdeState.terminalTab);
    setActiveFilePath(restoredIdeState.activeFile);
    activeFileScrollTopRef.current = restoredIdeState.activeFileScrollTop;
  }, [restoredIdeState, activeFileScrollTopRef]);

  // Apply panel layouts
  useEffect(() => {
    const layouts = restoredIdeState?.panelLayouts;
    if (!layouts) return;

    const applyLayout = (
      groupKey: string,
      ref: ImperativePanelGroupHandle | null,
      expectedLength?: number,
    ) => {
      if (appliedPanelGroupsRef.current.has(groupKey)) return;
      const layout = layouts[groupKey];
      if (!ref || !layout) return;
      if (expectedLength !== undefined && layout.length !== expectedLength) return;

      ref.setLayout(layout);
      appliedPanelGroupsRef.current.add(groupKey);
    };

    applyLayout('center', centerPanelGroupRef.current);
    applyLayout('editor', editorPanelGroupRef.current);
    applyLayout('main', mainPanelGroupRef.current, isChatVisible ? 3 : 2);
  }, [restoredIdeState, isChatVisible, appliedPanelGroupsRef]);

  // Restore open files
  useEffect(() => {
    if (didRestoreOpenFilesRef.current) return;
    if (!restoredIdeState) return;
    if (openFiles.length > 0) {
      didRestoreOpenFilesRef.current = true;
      return;
    }
    if (restoredIdeState.openFiles.length === 0) {
      didRestoreOpenFilesRef.current = true;
      return;
    }
    if (permissionState !== 'granted') return;
    if (syncStatus === 'syncing') return;

    const adapter = localAdapterRef.current;
    if (!adapter) return;

    didRestoreOpenFilesRef.current = true;

    void (async () => {
      const restoredFiles: OpenFile[] = [];

      for (const path of restoredIdeState.openFiles) {
        try {
          const result = await adapter.readFile(path);
          if ('content' in result) {
            restoredFiles.push({ path, content: result.content, isDirty: false });
          }
        } catch (error) {
          console.warn('[IDE] Failed to restore tab:', path, error);
        }
      }

      if (restoredFiles.length === 0) return;

      setOpenFiles(restoredFiles);

      const preferredActive =
        restoredIdeState.activeFile &&
          restoredFiles.some((f) => f.path === restoredIdeState.activeFile)
          ? restoredIdeState.activeFile
          : restoredFiles[0].path;

      setActiveFilePath(preferredActive);
      setSelectedFilePath(preferredActive);
    })();
  }, [restoredIdeState, openFiles.length, permissionState, syncStatus, localAdapterRef, didRestoreOpenFilesRef]);

  // ============================================================================
  // WebContainer Initialization
  // ============================================================================

  useEffect(() => {
    boot()
      .then(() => {
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
  }, []);

  // ============================================================================
  // File Handlers
  // ============================================================================

  const handleFileSelect = useCallback(
    async (path: string, handle: FileSystemFileHandle) => {
      setSelectedFilePath(path);
      console.log('[IDE] File selected:', path);

      const existingFile = openFiles.find((f) => f.path === path);
      if (existingFile) {
        setActiveFilePath(path);
        return;
      }

      try {
        const file = await handle.getFile();
        const content = await file.text();
        setOpenFiles((prev) => [...prev, { path, content, isDirty: false }]);
        setActiveFilePath(path);
      } catch (error) {
        console.error('[IDE] Failed to read file:', path, error);
      }
    },
    [openFiles],
  );

  const handleSave = useCallback(
    async (path: string, content: string) => {
      console.log('[IDE] Saving file:', path);
      try {
        if (syncManagerRef.current) {
          await syncManagerRef.current.writeFile(path, content);
          setOpenFiles((prev) =>
            prev.map((f) =>
              f.path === path ? { ...f, content, isDirty: false } : f,
            ),
          );
          console.log('[IDE] File saved successfully:', path);
          setFileTreeRefreshKey((prev) => prev + 1);
        } else {
          console.warn('[IDE] No SyncManager available for save');
          toast('No project folder open - save skipped', 'warning');
        }
      } catch (error) {
        console.error('[IDE] Failed to save file:', path, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast(`Failed to save ${path.split('/').pop()}: ${errorMessage}`, 'error');
      }
    },
    [toast, syncManagerRef],
  );

  const handleContentChange = useCallback(
    (path: string, content: string) => {
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === path ? { ...f, content, isDirty: true } : f,
        ),
      );
      eventBus.emit('file:modified', { path, source: 'editor', content });
    },
    [eventBus],
  );

  const handleTabClose = useCallback(
    (path: string) => {
      setOpenFiles((prev) => prev.filter((f) => f.path !== path));
      if (activeFilePath === path) {
        setActiveFilePath(openFiles.find((f) => f.path !== path)?.path ?? null);
      }
    },
    [activeFilePath, openFiles],
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col">
      {/* Header */}
      <IDEHeaderBar
        projectId={projectId}
        isChatVisible={isChatVisible}
        onToggleChat={() => setIsChatVisible(!isChatVisible)}
      />

      {/* Main Resizable Layout */}
      <PanelGroup
        ref={mainPanelGroupRef}
        direction="horizontal"
        className="flex-1"
        onLayout={(layout) => handlePanelLayoutChange('main', layout)}
      >
        {/* Left Sidebar - FileTree */}
        <Panel
          order={1}
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

        {/* Center Area - Editor + Terminal */}
        <Panel order={2} minSize={30}>
          <PanelGroup
            ref={centerPanelGroupRef}
            direction="vertical"
            onLayout={(layout) => handlePanelLayoutChange('center', layout)}
          >
            {/* Editor + Preview */}
            <Panel defaultSize={70} minSize={30}>
              <PanelGroup
                ref={editorPanelGroupRef}
                direction="horizontal"
                onLayout={(layout) => handlePanelLayoutChange('editor', layout)}
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
                    initialScrollTop={
                      activeFilePath && activeFilePath === restoredIdeState?.activeFile
                        ? restoredIdeState.activeFileScrollTop
                        : undefined
                    }
                    onScrollTopChange={(_path, scrollTop) => {
                      activeFileScrollTopRef.current = scrollTop;
                      scheduleIdeStatePersistence(400);
                    }}
                  />
                </Panel>

                <PanelResizeHandle className="w-1 bg-slate-800 hover:bg-cyan-500/50 transition-colors cursor-col-resize" />

                {/* Preview */}
                <Panel defaultSize={40} minSize={15} className="bg-slate-900/30">
                  <PreviewPanel previewUrl={previewUrl} port={previewPort} />
                </Panel>
              </PanelGroup>
            </Panel>

            <PanelResizeHandle className="h-1 bg-slate-800 hover:bg-cyan-500/50 transition-colors cursor-row-resize" />

            {/* Terminal */}
            <Panel defaultSize={30} minSize={10} maxSize={50} className="bg-slate-900">
              <TerminalPanel activeTab={terminalTab} onTabChange={setTerminalTab} />
            </Panel>
          </PanelGroup>
        </Panel>

        {/* Right Sidebar - Chat */}
        {isChatVisible && (
          <>
            <PanelResizeHandle className="w-1 bg-slate-800 hover:bg-cyan-500/50 transition-colors cursor-col-resize" />
            <Panel
              order={3}
              defaultSize={25}
              minSize={15}
              maxSize={40}
              className="bg-slate-900/50"
            >
              <ChatPanelWrapper
                projectId={projectId}
                projectName={projectMetadata?.name ?? projectId ?? 'Project'}
                onClose={() => setIsChatVisible(false)}
              />
            </Panel>
          </>
        )}
      </PanelGroup>

      {/* Minimum Viewport Warning */}
      <MinViewportWarning />
    </div>
  );
}

/**
 * MinViewportWarning - Shown when viewport is too small.
 * 
 * @returns Warning overlay JSX element
 */
function MinViewportWarning(): React.JSX.Element {
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
  );
}
