import { useState, useCallback, useEffect, useRef } from 'react';
import {
    runProcess,
    killProcess,
    ProcessInfo,
    RunProcessOptions,
    isProcessRunning,
    getProcess
} from '../lib/webcontainer/process-manager';

export interface UseProcessManagerReturn {
    /** Run a command in the WebContainer */
    runCommand: (command: string, args?: string[], options?: RunProcessOptions) => Promise<ProcessInfo>;
    /** Kill a specific process */
    killChildProcess: (processId: string) => void;
    /** List of processes started by this hook instance */
    processes: ProcessInfo[];
    /** Whether any process started by this hook is currently running */
    isAnyRunning: boolean;
}

/**
 * Hook to manage WebContainer processes with automatic cleanup.
 * Tracks processes started by this hook instance and kills them on unmount.
 */
export function useProcessManager(): UseProcessManagerReturn {
    // Track process IDs started by this hook
    const processIdsRef = useRef<Set<string>>(new Set());
    const [processes, setProcesses] = useState<ProcessInfo[]>([]);

    // Update the list of processes and running state
    const updateState = useCallback(() => {
        const ids = Array.from(processIdsRef.current);
        const currentProcesses = ids
            .map(id => getProcess(id))
            .filter((p): p is ProcessInfo => !!p);

        setProcesses(currentProcesses);
    }, []);

    const runCommand = useCallback(async (
        command: string,
        args: string[] = [],
        options: RunProcessOptions = {}
    ) => {
        // Wrap onExit to update state
        const originalOnExit = options.onExit;

        const info = await runProcess(command, args, {
            ...options,
            onExit: (code) => {
                updateState();
                if (originalOnExit) {
                    originalOnExit(code);
                }
            }
        });

        processIdsRef.current.add(info.id);
        updateState();
        return info;
    }, [updateState]);

    const killChildProcess = useCallback((processId: string) => {
        if (processIdsRef.current.has(processId)) {
            killProcess(processId);
            updateState();
        }
    }, [updateState]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            const ids = Array.from(processIdsRef.current);
            ids.forEach(id => {
                if (isProcessRunning(id)) {
                    console.log(`[useProcessManager] Cleaning up process ${id} on unmount`);
                    try {
                        killProcess(id);
                    } catch (e) {
                        // Ignore errors during cleanup
                    }
                }
            });
        };
    }, []);

    const isAnyRunning = processes.some(p => p.status === 'running');

    return {
        runCommand,
        killChildProcess,
        processes,
        isAnyRunning
    };
}
