/**
 * WebContainers Manager - Singleton pattern for managing WebContainer lifecycle
 * @module lib/webcontainer/manager
 * 
 * @example
 * ```ts
 * import { boot, mount, spawn, getFileSystem } from '@/lib/webcontainer';
 * 
 * // Boot WebContainer (only once per page)
 * const instance = await boot();
 * 
 * // Mount files
 * await mount({
 *   'index.js': { file: { contents: 'console.log("hello")' } }
 * });
 * 
 * // Spawn process
 * const process = await spawn('node', ['index.js']);
 * process.output.pipeTo(new WritableStream({
 *   write(data) { console.log(data); }
 * }));
 * ```
 */

import { WebContainer } from '@webcontainer/api';
import type {
    FileSystemTree,
    WebContainerProcess,
    SpawnOptions,
    WebContainerManagerOptions
} from './types';
import { WebContainerError } from './types';

// Singleton instance
let instance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

/**
 * Boot a WebContainer instance with singleton pattern.
 * Only ONE WebContainer can be booted per page.
 * 
 * @param options - Boot configuration options
 * @returns Promise resolving to the WebContainer instance
 * @throws {WebContainerError} If boot fails
 * 
 * @example
 * ```ts
 * const wc = await boot({ workdirName: 'my-project' });
 * console.log('WebContainer booted!');
 * ```
 */
export async function boot(
    options: WebContainerManagerOptions = {}
): Promise<WebContainer> {
    // Return existing instance if already booted
    if (instance) {
        return instance;
    }

    // If boot is in progress, return the same promise (avoid double boot)
    if (bootPromise) {
        return bootPromise;
    }

    const {
        coep = 'require-corp',
        workdirName = 'project',
        forwardPreviewErrors = true,
    } = options;

    bootPromise = (async () => {
        try {
            console.log('[WebContainer] Booting...');
            const startTime = performance.now();

            instance = await WebContainer.boot({
                coep,
                workdirName,
                forwardPreviewErrors,
            });

            const bootTime = Math.round(performance.now() - startTime);
            console.log(`[WebContainer] Booted successfully in ${bootTime}ms`);

            return instance;
        } catch (error) {
            bootPromise = null; // Reset for retry
            const message = error instanceof Error ? error.message : 'Unknown boot error';
            throw new WebContainerError(
                `Failed to boot WebContainer: ${message}`,
                'BOOT_FAILED'
            );
        }
    })();

    return bootPromise;
}

/**
 * Mount a file system tree into the WebContainer.
 * 
 * @param files - FileSystemTree object to mount
 * @param mountPoint - Optional directory to mount files into
 * @throws {WebContainerError} If WebContainer is not booted or mount fails
 * 
 * @example
 * ```ts
 * await mount({
 *   'package.json': { file: { contents: '{"name": "test"}' } },
 *   'src': {
 *     directory: {
 *       'index.ts': { file: { contents: 'console.log("hi")' } }
 *     }
 *   }
 * });
 * ```
 */
export async function mount(
    files: FileSystemTree,
    mountPoint?: string
): Promise<void> {
    if (!instance) {
        throw new WebContainerError(
            'WebContainer not booted. Call boot() first.',
            'NOT_BOOTED'
        );
    }

    try {
        console.log('[WebContainer] Mounting files...');
        await instance.mount(files, { mountPoint });
        console.log('[WebContainer] Files mounted successfully');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown mount error';
        throw new WebContainerError(
            `Failed to mount files: ${message}`,
            'MOUNT_FAILED'
        );
    }
}

/**
 * Get the WebContainer's file system API.
 * 
 * @returns The FileSystemAPI for reading/writing files
 * @throws {WebContainerError} If WebContainer is not booted
 * 
 * @example
 * ```ts
 * const fs = getFileSystem();
 * const content = await fs.readFile('/package.json', 'utf-8');
 * ```
 */
export function getFileSystem() {
    if (!instance) {
        throw new WebContainerError(
            'WebContainer not booted. Call boot() first.',
            'NOT_BOOTED'
        );
    }
    return instance.fs;
}

/**
 * Spawn a process in the WebContainer.
 * 
 * @param command - Command to run (e.g., 'npm', 'node', 'jsh')
 * @param args - Command arguments
 * @param options - Spawn options including terminal dimensions
 * @returns Promise resolving to the WebContainerProcess
 * @throws {WebContainerError} If WebContainer is not booted or spawn fails
 * 
 * @example
 * ```ts
 * // Run npm install
 * const install = await spawn('npm', ['install']);
 * install.output.pipeTo(new WritableStream({
 *   write(data) { console.log(data); }
 * }));
 * const exitCode = await install.exit;
 * 
 * // Interactive shell
 * const shell = await spawn('jsh', [], {
 *   terminal: { cols: 80, rows: 24 }
 * });
 * ```
 */
export async function spawn(
    command: string,
    args: string[] = [],
    options?: SpawnOptions
): Promise<WebContainerProcess> {
    if (!instance) {
        throw new WebContainerError(
            'WebContainer not booted. Call boot() first.',
            'NOT_BOOTED'
        );
    }

    try {
        console.log(`[WebContainer] Spawning: ${command} ${args.join(' ')}`);
        return await instance.spawn(command, args, options);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown spawn error';
        throw new WebContainerError(
            `Failed to spawn process "${command}": ${message}`,
            'SPAWN_FAILED'
        );
    }
}

/**
 * Get the current WebContainer instance.
 * Useful for debugging or accessing advanced features.
 * 
 * @returns The WebContainer instance or null if not booted
 */
export function getInstance(): WebContainer | null {
    return instance;
}

/**
 * Check if WebContainer is currently booted.
 * 
 * @returns true if booted, false otherwise
 */
export function isBooted(): boolean {
    return instance !== null;
}

/**
 * Subscribe to server-ready events.
 * Fired when a server starts listening on a port in WebContainers.
 * 
 * @param callback - Function called with port and URL when server is ready
 * @returns Unsubscribe function
 * @throws {WebContainerError} If WebContainer is not booted
 * 
 * @example
 * ```ts
 * const unsubscribe = onServerReady((port, url) => {
 *   console.log(`Server ready at ${url}`);
 *   iframeEl.src = url;
 * });
 * 
 * // Cleanup
 * unsubscribe();
 * ```
 */
export function onServerReady(
    callback: (port: number, url: string) => void
): () => void {
    if (!instance) {
        throw new WebContainerError(
            'WebContainer not booted. Call boot() first.',
            'NOT_BOOTED'
        );
    }

    console.log('[WebContainer] Subscribing to server-ready events');
    return instance.on('server-ready', callback);
}
