import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { createTerminalAdapter, boot } from '../../lib/webcontainer';

interface XTerminalProps {
    /**
     * Optional class name for the container
     */
    className?: string;
}

export function XTerminal({ className }: XTerminalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const adapterRef = useRef<ReturnType<typeof createTerminalAdapter> | null>(null);
    const initializedRef = useRef(false);

    useEffect(() => {
        // Strict Mode protection: don't double init
        if (initializedRef.current || !containerRef.current) return;
        initializedRef.current = true;

        console.log('[XTerminal] Initializing...');

        // 1. Initialize xterm.js
        const term = new Terminal({
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 13,
            cursorBlink: true,
            theme: {
                background: '#020617', // slate-950
                foreground: '#e2e8f0', // slate-200
                cursor: '#22d3ee',     // cyan-400
                selectionBackground: 'rgba(34, 211, 238, 0.3)', // cyan-400/30
                black: '#020617',
                red: '#ef4444',
                green: '#22c55e',
                yellow: '#eab308',
                blue: '#3b82f6',
                magenta: '#d946ef',
                cyan: '#06b6d4',
                white: '#f8fafc',
                brightBlack: '#475569',
                brightRed: '#fca5a5',
                brightGreen: '#86efac',
                brightYellow: '#fde047',
                brightBlue: '#93c5fd',
                brightMagenta: '#f0abfc',
                brightCyan: '#67e8f9',
                brightWhite: '#ffffff',
            },
            allowProposedApi: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        // Open terminal in container
        term.open(containerRef.current);
        fitAddon.fit();

        // Save refs
        terminalRef.current = term;
        fitAddonRef.current = fitAddon;

        // 2. create adapter
        const adapter = createTerminalAdapter({
            terminal: term,
            fitAddon,
            onExit: (code) => {
                term.write(`\r\n\x1b[33mShell exited with code ${code}\x1b[0m\r\n`);
            },
            onError: (err) => {
                term.write(`\r\n\x1b[31mTerminal Error: ${err.message}\x1b[0m\r\n`);
            }
        });
        adapterRef.current = adapter;

        // 3. Start shell
        // Wait for WebContainer to be ready
        boot().then(async () => {
            if (initializedRef.current && adapter) {
                await adapter.startShell();
            }
        }).catch((err: any) => {
            term.write(`\r\n\x1b[31mFailed to boot WebContainer: ${err.message}\x1b[0m\r\n`);
        });

        // 4. Resize observer
        const resizeObserver = new ResizeObserver(() => {
            // Debounce or just call fit
            window.requestAnimationFrame(() => {
                if (fitAddonRef.current) {
                    try {
                        fitAddonRef.current.fit();
                    } catch (e) {
                        // ignore fit errors (e.g. if container is hidden)
                    }
                }
            });
        });
        resizeObserver.observe(containerRef.current);

        // Cleanup
        return () => {
            console.log('[XTerminal] Disposing...');
            resizeObserver.disconnect();
            if (adapterRef.current) {
                adapterRef.current.dispose();
            }
            if (terminalRef.current) {
                terminalRef.current.dispose();
            }
            initializedRef.current = false;
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={`h-full w-full overflow-hidden ${className || ''}`}
        />
    );
}
