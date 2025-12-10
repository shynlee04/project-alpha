/**
 * Terminal Adapter - Binds xterm.js to WebContainers shell
 * @module lib/webcontainer/terminal-adapter
 * 
 * @example
 * ```ts
 * import { Terminal } from '@xterm/xterm';
 * import { FitAddon } from '@xterm/addon-fit';
 * import { createTerminalAdapter } from '@/lib/webcontainer';
 * 
 * const terminal = new Terminal();
 * const fitAddon = new FitAddon();
 * terminal.loadAddon(fitAddon);
 * terminal.open(containerElement);
 * 
 * const adapter = createTerminalAdapter({ terminal, fitAddon });
 * await adapter.startShell();
 * ```
 */

import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import type { WebContainerProcess } from '@webcontainer/api';
import { spawn, isBooted } from './manager';

/**
 * Options for creating a terminal adapter
 */
export interface TerminalAdapterOptions {
    /** xterm.js Terminal instance */
    terminal: Terminal;
    /** FitAddon instance for resize handling (optional) */
    fitAddon?: FitAddon;
    /** Callback when shell process exits */
    onExit?: (exitCode: number) => void;
    /** Callback when an error occurs */
    onError?: (error: Error) => void;
}

/**
 * Terminal adapter interface for managing xterm ↔ WebContainers binding
 */
export interface TerminalAdapter {
    /** Start the jsh shell and bind to terminal */
    startShell(): Promise<void>;
    /** Write data directly to shell stdin */
    write(data: string): void;
    /** Resize the shell terminal */
    resize(cols: number, rows: number): void;
    /** Clean up all resources */
    dispose(): void;
    /** Check if shell is currently running */
    isRunning(): boolean;
}

/**
 * Error thrown when terminal adapter operations fail
 */
export class TerminalAdapterError extends Error {
    constructor(
        message: string,
        public readonly code: 'NOT_BOOTED' | 'SHELL_NOT_STARTED' | 'ALREADY_STARTED' | 'DISPOSED'
    ) {
        super(message);
        this.name = 'TerminalAdapterError';
    }
}

/**
 * Create a terminal adapter that binds xterm.js to WebContainers shell.
 * 
 * @param options - Configuration options
 * @returns TerminalAdapter instance
 * 
 * @example
 * ```ts
 * const adapter = createTerminalAdapter({
 *   terminal,
 *   fitAddon,
 *   onExit: (code) => console.log(`Shell exited with code ${code}`),
 * });
 * 
 * await adapter.startShell();
 * ```
 */
export function createTerminalAdapter(options: TerminalAdapterOptions): TerminalAdapter {
    const { terminal, fitAddon, onExit, onError } = options;

    // Internal state
    let shellProcess: WebContainerProcess | null = null;
    let inputWriter: WritableStreamDefaultWriter<string> | null = null;
    let disposed = false;
    let dataDisposable: { dispose: () => void } | null = null;
    let resizeDisposable: { dispose: () => void } | null = null;

    /**
     * Start the jsh shell and bind input/output streams
     */
    async function startShell(): Promise<void> {
        if (disposed) {
            throw new TerminalAdapterError(
                'Terminal adapter has been disposed',
                'DISPOSED'
            );
        }

        if (shellProcess) {
            throw new TerminalAdapterError(
                'Shell already started. Call dispose() first to restart.',
                'ALREADY_STARTED'
            );
        }

        if (!isBooted()) {
            throw new TerminalAdapterError(
                'WebContainer not booted. Call boot() first.',
                'NOT_BOOTED'
            );
        }

        try {
            console.log('[TerminalAdapter] Starting jsh shell...');

            // Spawn jsh shell with terminal dimensions
            shellProcess = await spawn('jsh', [], {
                terminal: {
                    cols: terminal.cols,
                    rows: terminal.rows,
                },
            });

            console.log(`[TerminalAdapter] Shell started with dimensions ${terminal.cols}x${terminal.rows}`);

            // Output binding: shell → terminal
            shellProcess.output.pipeTo(
                new WritableStream({
                    write(data) {
                        terminal.write(data);
                    },
                })
            ).catch((error) => {
                // Stream closed or error
                if (!disposed) {
                    console.warn('[TerminalAdapter] Output stream closed:', error);
                }
            });

            // Input binding: terminal → shell
            inputWriter = shellProcess.input.getWriter();

            dataDisposable = terminal.onData((data) => {
                if (inputWriter && !disposed) {
                    inputWriter.write(data).catch((error) => {
                        console.warn('[TerminalAdapter] Failed to write to shell:', error);
                    });
                }
            });

            // Resize binding
            resizeDisposable = terminal.onResize(({ cols, rows }) => {
                console.log(`[TerminalAdapter] Terminal resized to ${cols}x${rows}`);
                // Note: jsh doesn't support live resize, but we track it
                // Future: could restart shell with new dimensions
            });

            // Handle shell exit
            shellProcess.exit.then((exitCode) => {
                console.log(`[TerminalAdapter] Shell exited with code ${exitCode}`);
                shellProcess = null;
                if (onExit && !disposed) {
                    onExit(exitCode);
                }
            });

            console.log('[TerminalAdapter] Shell ready');
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('[TerminalAdapter] Failed to start shell:', err);
            if (onError) {
                onError(err);
            }
            throw err;
        }
    }

    /**
     * Write data directly to shell stdin
     */
    function write(data: string): void {
        if (disposed) {
            throw new TerminalAdapterError(
                'Terminal adapter has been disposed',
                'DISPOSED'
            );
        }

        if (!inputWriter) {
            throw new TerminalAdapterError(
                'Shell not started. Call startShell() first.',
                'SHELL_NOT_STARTED'
            );
        }

        inputWriter.write(data).catch((error) => {
            console.warn('[TerminalAdapter] Failed to write:', error);
        });
    }

    /**
     * Resize the terminal (triggers fit addon if available)
     */
    function resize(cols: number, rows: number): void {
        if (disposed) return;

        if (fitAddon) {
            fitAddon.fit();
        } else {
            terminal.resize(cols, rows);
        }
    }

    /**
     * Clean up all resources
     */
    function dispose(): void {
        if (disposed) return;
        disposed = true;

        console.log('[TerminalAdapter] Disposing...');

        // Remove event listeners
        if (dataDisposable) {
            dataDisposable.dispose();
            dataDisposable = null;
        }

        if (resizeDisposable) {
            resizeDisposable.dispose();
            resizeDisposable = null;
        }

        // Release writer lock
        if (inputWriter) {
            try {
                inputWriter.releaseLock();
            } catch (error) {
                // Ignore - stream may already be closed
            }
            inputWriter = null;
        }

        // Kill shell process
        if (shellProcess) {
            try {
                shellProcess.kill();
            } catch (error) {
                // Ignore - process may already be terminated
            }
            shellProcess = null;
        }

        console.log('[TerminalAdapter] Disposed');
    }

    /**
     * Check if shell is currently running
     */
    function isRunning(): boolean {
        return shellProcess !== null && !disposed;
    }

    return {
        startShell,
        write,
        resize,
        dispose,
        isRunning,
    };
}
