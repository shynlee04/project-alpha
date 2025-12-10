import { useState, useCallback } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { MessageSquare, X, FolderOpen } from 'lucide-react'
import { XTerminal } from '../ide/XTerminal'
import { FileTree } from '../ide/FileTree'
import { LocalFSAdapter } from '../../lib/filesystem/local-fs-adapter'
import { boot } from '../../lib/webcontainer'
import { useEffect } from 'react'

interface IDELayoutProps {
    projectId: string
}

export function IDELayout({ projectId }: IDELayoutProps) {
    const [isChatVisible, setIsChatVisible] = useState(true)
    const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null)
    const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>()
    const [isOpeningFolder, setIsOpeningFolder] = useState(false)

    useEffect(() => {
        // Start booting WebContainer as soon as IDE layout mounts
        boot().catch(console.error);
    }, []);

    const handleOpenFolder = useCallback(async () => {
        if (!LocalFSAdapter.isSupported()) {
            alert('File System Access API is not supported in this browser.');
            return;
        }

        setIsOpeningFolder(true);
        try {
            const adapter = new LocalFSAdapter();
            const handle = await adapter.requestDirectoryAccess();
            setDirectoryHandle(handle);
        } catch (error) {
            console.error('Failed to open folder:', error);
        } finally {
            setIsOpeningFolder(false);
        }
    }, []);

    const handleFileSelect = useCallback((path: string, handle: FileSystemFileHandle) => {
        setSelectedFilePath(path);
        console.log('File selected:', path, handle);
        // TODO: Open file in Monaco editor
    }, []);

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
                        disabled={isOpeningFolder}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                        title="Open Folder"
                    >
                        <FolderOpen className="w-4 h-4" />
                        {isOpeningFolder ? 'Opening...' : 'Open Folder'}
                    </button>
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
                                directoryHandle={directoryHandle}
                                selectedPath={selectedFilePath}
                                onFileSelect={handleFileSelect}
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
                                    <div className="h-full flex flex-col">
                                        <div className="h-9 flex items-center bg-slate-900 border-b border-slate-800 px-2 overflow-x-auto">
                                            <div className="px-3 py-1.5 bg-slate-800 text-slate-300 text-sm rounded-t border-t border-x border-slate-700/50 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-cyan-500/50"></span>
                                                Welcome.md
                                            </div>
                                        </div>
                                        <div className="flex-1 p-8 flex items-center justify-center text-slate-600">
                                            Monaco Editor Placeholder
                                        </div>
                                    </div>
                                </Panel>

                                <PanelResizeHandle className="w-1 bg-slate-800 hover:bg-cyan-500/50 transition-colors cursor-col-resize" />

                                {/* Preview */}
                                <Panel defaultSize={40} minSize={15} className="bg-slate-900/30">
                                    <div className="h-full flex flex-col border-l border-slate-800">
                                        <div className="h-9 px-4 flex items-center justify-between border-b border-slate-800/50">
                                            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Preview</span>
                                        </div>
                                        <div className="flex-1 flex items-center justify-center text-sm text-slate-500 italic">
                                            Preview Iframe Placeholder
                                        </div>
                                    </div>
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
