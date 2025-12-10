/**
 * Process Manager - Manages WebContainers process lifecycle
 * @module lib/webcontainer/process-manager
 * 
 * Provides process lifecycle tracking for npm commands and other processes
 * running in WebContainers. Supports:
 * - Running commands (npm install, npm run dev, etc.)
 * - Real-time output streaming
 * - Exit code capture
 * - Process kill support
 * 
 * @example
 * ```ts
 * import { runProcess, killProcess, getActiveProcesses } from '@/lib/webcontainer';
 * 
 * // Run npm install
 * const info = await runProcess('npm', ['install'], {
 *   onOutput: (data) => terminal.write(data),
 *   onExit: (code) => console.log(`Exited: ${code}`),
 * });
 * 
 * // Run dev server (long-running)
 * const devInfo = await runProcess('npm', ['run', 'dev'], {
 *   onOutput: (data) => terminal.write(data),
 * });
 * 
 * // Kill when done
 * killProcess(devInfo.id);
 * ```
 */

import type { WebContainerProcess } from '@webcontainer/api';
import { spawn, isBooted } from './manager';

/**
 * Process status enum
 */
export type ProcessStatus = 'running' | 'exited' | 'killed';

/**
 * Information about a managed process
 */
export interface ProcessInfo {
    /** Unique process identifier */
    id: string;
    /** Command that was run */
    command: string;
    /** Command arguments */
    args: string[];
    /** Current process status */
    status: ProcessStatus;
    /** Exit code (set when status is 'exited' or 'killed') */
    exitCode?: number;
    /** Process start timestamp */
    startTime: number;
    /** Process end timestamp (set when completed) */
    endTime?: number;
    /** Reference to the WebContainerProcess */
    process: WebContainerProcess;
}

/**
 * Options for running a process
 */
export interface RunProcessOptions {
    /** Callback for stdout/stderr output */
    onOutput?: (data: string) => void;
    /** Callback when process exits */
    onExit?: (exitCode: number) => void;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Terminal dimensions for interactive processes */
    terminal?: { cols: number; rows: number };
}

/**
 * Error thrown when process operations fail
 */
export class ProcessManagerError extends Error {
    constructor(
        message: string,
        public readonly code: 'NOT_BOOTED' | 'PROCESS_NOT_FOUND' | 'SPAWN_FAILED' | 'ALREADY_TERMINATED'
    ) {
        super(message);
        this.name = 'ProcessManagerError';
    }
}

// Process registry
const processes = new Map<string, ProcessInfo>();
let processIdCounter = 0;

/**
 * Generate a unique process ID
 */
function generateProcessId(): string {
    return `proc_${++processIdCounter}_${Date.now()}`;
}

/**
 * Run a process in WebContainers with lifecycle tracking.
 * 
 * @param command - Command to run (e.g., 'npm', 'node')
 * @param args - Command arguments (e.g., ['install'], ['run', 'dev'])
 * @param options - Process options including callbacks
 * @returns ProcessInfo with id and process reference
 * @throws {ProcessManagerError} If WebContainer is not booted or spawn fails
 * 
 * @example
 * ```ts
 * // Install dependencies
 * const installInfo = await runProcess('npm', ['install'], {
 *   onOutput: (data) => console.log(data),
 *   onExit: (code) => console.log(`Done: ${code}`),
 * });
 * 
 * // Start dev server
 * const devInfo = await runProcess('npm', ['run', 'dev'], {
 *   onOutput: (data) => terminal.write(data),
 * });
 * ```
 */
export async function runProcess(
    command: string,
    args: string[] = [],
    options: RunProcessOptions = {}
): Promise<ProcessInfo> {
    const { onOutput, onExit, onError, terminal: terminalDims } = options;

    if (!isBooted()) {
        throw new ProcessManagerError(
            'WebContainer not booted. Call boot() first.',
            'NOT_BOOTED'
        );
    }

    const id = generateProcessId();
    console.log(`[ProcessManager] Starting process ${id}: ${command} ${args.join(' ')}`);

    try {
        // Spawn the process
        const process = await spawn(command, args, {
            terminal: terminalDims,
        });

        // Create process info
        const info: ProcessInfo = {
            id,
            command,
            args,
            status: 'running',
            startTime: Date.now(),
            process,
        };

        // Register process
        processes.set(id, info);

        // Set up output streaming
        process.output.pipeTo(
            new WritableStream({
                write(data) {
                    if (onOutput) {
                        onOutput(data);
                    }
                },
            })
        ).catch((error) => {
            // Stream closed or error - may be normal on kill
            if (info.status === 'running') {
                console.warn(`[ProcessManager] Output stream error for ${id}:`, error);
            }
        });

        // Track exit
        process.exit.then((exitCode) => {
            console.log(`[ProcessManager] Process ${id} exited with code ${exitCode}`);

            // Update info
            info.status = info.status === 'killed' ? 'killed' : 'exited';
            info.exitCode = exitCode;
            info.endTime = Date.now();

            // Invoke callback
            if (onExit) {
                onExit(exitCode);
            }
        }).catch((error) => {
            console.error(`[ProcessManager] Exit error for ${id}:`, error);
            if (onError) {
                onError(error instanceof Error ? error : new Error(String(error)));
            }
        });

        return info;
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`[ProcessManager] Failed to start process ${id}:`, err);

        if (onError) {
            onError(err);
        }

        throw new ProcessManagerError(
            `Failed to spawn process "${command}": ${err.message}`,
            'SPAWN_FAILED'
        );
    }
}

/**
 * Kill a running process by ID.
 * 
 * @param processId - ID of the process to kill
 * @throws {ProcessManagerError} If process not found
 * 
 * @example
 * ```ts
 * const devInfo = await runProcess('npm', ['run', 'dev']);
 * // ... later
 * killProcess(devInfo.id);
 * ```
 */
export function killProcess(processId: string): void {
    const info = processes.get(processId);

    if (!info) {
        throw new ProcessManagerError(
            `Process ${processId} not found`,
            'PROCESS_NOT_FOUND'
        );
    }

    if (info.status !== 'running') {
        console.log(`[ProcessManager] Process ${processId} already terminated`);
        return;
    }

    console.log(`[ProcessManager] Killing process ${processId}`);

    try {
        info.status = 'killed';
        info.process.kill();
    } catch (error) {
        // Process may already be terminated
        console.warn(`[ProcessManager] Kill error for ${processId}:`, error);
    }
}

/**
 * Kill all running processes.
 * Useful for cleanup on component unmount.
 * 
 * @example
 * ```ts
 * // In React cleanup
 * useEffect(() => {
 *   return () => {
 *     killAllProcesses();
 *   };
 * }, []);
 * ```
 */
export function killAllProcesses(): void {
    console.log(`[ProcessManager] Killing all processes (${processes.size} tracked)`);

    for (const [id, info] of processes) {
        if (info.status === 'running') {
            try {
                info.status = 'killed';
                info.process.kill();
                console.log(`[ProcessManager] Killed ${id}`);
            } catch (error) {
                // Ignore - process may already be terminated
            }
        }
    }
}

/**
 * Get a process by ID.
 * 
 * @param processId - ID of the process
 * @returns ProcessInfo or undefined if not found
 */
export function getProcess(processId: string): ProcessInfo | undefined {
    return processes.get(processId);
}

/**
 * Get all active (running) processes.
 * 
 * @returns Array of ProcessInfo for running processes
 */
export function getActiveProcesses(): ProcessInfo[] {
    return Array.from(processes.values()).filter(p => p.status === 'running');
}

/**
 * Get all tracked processes (including completed).
 * 
 * @returns Array of all ProcessInfo
 */
export function getAllProcesses(): ProcessInfo[] {
    return Array.from(processes.values());
}

/**
 * Clear completed processes from the registry.
 * Keeps running processes in the registry.
 */
export function clearCompletedProcesses(): void {
    const toRemove: string[] = [];

    for (const [id, info] of processes) {
        if (info.status !== 'running') {
            toRemove.push(id);
        }
    }

    for (const id of toRemove) {
        processes.delete(id);
    }

    console.log(`[ProcessManager] Cleared ${toRemove.length} completed processes`);
}

/**
 * Check if a process is running.
 * 
 * @param processId - ID of the process
 * @returns true if process exists and is running
 */
export function isProcessRunning(processId: string): boolean {
    const info = processes.get(processId);
    return info?.status === 'running' || false;
}
