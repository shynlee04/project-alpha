/**
 * WebContainers Manager Module
 * 
 * Provides a singleton-based interface for managing WebContainers lifecycle
 * including booting, mounting files, spawning processes, and filesystem access.
 * 
 * @module lib/webcontainer
 * 
 * @example
 * ```ts
 * import { boot, mount, spawn, getFileSystem } from '@/lib/webcontainer';
 * 
 * // Initialize WebContainer
 * await boot();
 * 
 * // Mount project files
 * await mount({ 'index.js': { file: { contents: 'console.log("hi")' } } });
 * 
 * // Run a command
 * const process = await spawn('node', ['index.js']);
 * ```
 */

// Manager functions
export {
    boot,
    mount,
    spawn,
    getFileSystem,
    getInstance,
    isBooted,
    onServerReady,
} from './manager';

// Types
export type {
    WebContainer,
    FileSystemTree,
    WebContainerProcess,
    SpawnOptions,
    WebContainerManagerOptions,
} from './types';

export { WebContainerError } from './types';

// Terminal Adapter
export {
    createTerminalAdapter,
    TerminalAdapterError,
} from './terminal-adapter';
export type {
    TerminalAdapterOptions,
    TerminalAdapter,
} from './terminal-adapter';

// Process Manager
export {
    runProcess,
    killProcess,
    killAllProcesses,
    getProcess,
    getActiveProcesses,
    getAllProcesses,
    clearCompletedProcesses,
    isProcessRunning,
    ProcessManagerError,
} from './process-manager';
export type {
    ProcessInfo,
    ProcessStatus,
    RunProcessOptions,
} from './process-manager';

