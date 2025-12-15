/**
 * @fileoverview IDE State Persistence Hook
 * @module hooks/useIdeStatePersistence
 * 
 * Custom hook for managing IDE state persistence including:
 * - Panel layouts
 * - Open files
 * - Active file and scroll position
 * - Terminal tab state
 * - Chat visibility
 * 
 * @example
 * ```tsx
 * const {
 *   restoredIdeState,
 *   panelLayoutsRef,
 *   scheduleIdeStatePersistence,
 *   handlePanelLayoutChange,
 * } = useIdeStatePersistence({ projectId });
 * ```
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
    getIdeState,
    saveIdeState,
    type IdeState,
    type TerminalTab,
} from '../lib/workspace';

/**
 * Options for the useIdeStatePersistence hook.
 * 
 * @interface UseIdeStatePersistenceOptions
 */
export interface UseIdeStatePersistenceOptions {
    /** Current project ID */
    projectId: string | null;
}

/**
 * Return type for the useIdeStatePersistence hook.
 * 
 * @interface UseIdeStatePersistenceResult
 */
export interface UseIdeStatePersistenceResult {
    /** Restored IDE state from storage */
    restoredIdeState: IdeState | null;
    /** Reference to panel layouts */
    panelLayoutsRef: React.MutableRefObject<Record<string, number[]>>;
    /** Reference to set of applied panel groups */
    appliedPanelGroupsRef: React.MutableRefObject<Set<string>>;
    /** Whether open files have been restored */
    didRestoreOpenFilesRef: React.MutableRefObject<boolean>;
    /** Reference to active file scroll position */
    activeFileScrollTopRef: React.MutableRefObject<number | undefined>;
    /** Reference to open file paths */
    openFilePathsRef: React.MutableRefObject<string[]>;
    /** Reference to active file path */
    activeFilePathRef: React.MutableRefObject<string | null>;
    /** Reference to terminal tab */
    terminalTabRef: React.MutableRefObject<TerminalTab>;
    /** Reference to chat visibility */
    chatVisibleRef: React.MutableRefObject<boolean>;
    /** Schedule state persistence with debouncing */
    scheduleIdeStatePersistence: (delayMs?: number) => void;
    /** Handle panel layout change */
    handlePanelLayoutChange: (groupId: string, layout: number[]) => void;
}

/**
 * Custom hook for IDE state persistence.
 * 
 * Handles loading and saving of IDE state including panel layouts,
 * open files, scroll positions, and UI visibility states.
 * 
 * @param options - Hook options
 * @returns IDE state persistence utilities and refs
 */
export function useIdeStatePersistence({
    projectId,
}: UseIdeStatePersistenceOptions): UseIdeStatePersistenceResult {
    const [restoredIdeState, setRestoredIdeState] = useState<IdeState | null>(null);

    // Refs for mutable state
    const panelLayoutsRef = useRef<Record<string, number[]>>({});
    const appliedPanelGroupsRef = useRef<Set<string>>(new Set());
    const didRestoreOpenFilesRef = useRef(false);
    const activeFileScrollTopRef = useRef<number | undefined>(undefined);
    const persistenceSuppressedRef = useRef(true);
    const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const openFilePathsRef = useRef<string[]>([]);
    const activeFilePathRef = useRef<string | null>(null);
    const terminalTabRef = useRef<TerminalTab>('terminal');
    const chatVisibleRef = useRef(true);

    /**
     * Schedule IDE state persistence with debouncing.
     * 
     * @param delayMs - Delay in milliseconds before persisting (default: 250)
     */
    const scheduleIdeStatePersistence = useCallback(
        (delayMs = 250) => {
            if (!projectId || persistenceSuppressedRef.current) return;

            if (persistTimeoutRef.current) {
                clearTimeout(persistTimeoutRef.current);
            }

            persistTimeoutRef.current = setTimeout(() => {
                void saveIdeState({
                    projectId,
                    panelLayouts: panelLayoutsRef.current,
                    openFiles: openFilePathsRef.current,
                    activeFile: activeFilePathRef.current,
                    activeFileScrollTop: activeFileScrollTopRef.current,
                    terminalTab: terminalTabRef.current,
                    chatVisible: chatVisibleRef.current,
                }).catch((error) => {
                    console.warn('[IDE] Failed to persist IDE state:', error);
                });
            }, delayMs);
        },
        [projectId],
    );

    /**
     * Handle panel layout change event.
     * 
     * @param groupId - Panel group identifier
     * @param layout - New layout sizes array
     */
    const handlePanelLayoutChange = useCallback(
        (groupId: string, layout: number[]) => {
            panelLayoutsRef.current[groupId] = layout;
            scheduleIdeStatePersistence(400);
        },
        [scheduleIdeStatePersistence],
    );

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (persistTimeoutRef.current) {
                clearTimeout(persistTimeoutRef.current);
            }
        };
    }, []);

    // Load IDE state when project ID changes
    useEffect(() => {
        let cancelled = false;
        appliedPanelGroupsRef.current = new Set();
        didRestoreOpenFilesRef.current = false;
        persistenceSuppressedRef.current = true;
        setRestoredIdeState(null);

        const load = async () => {
            if (!projectId) {
                persistenceSuppressedRef.current = false;
                return;
            }

            const saved = await getIdeState(projectId);
            if (cancelled) return;

            setRestoredIdeState(saved);

            if (saved) {
                panelLayoutsRef.current = saved.panelLayouts ?? {};
            }

            persistenceSuppressedRef.current = false;
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [projectId]);

    return {
        restoredIdeState,
        panelLayoutsRef,
        appliedPanelGroupsRef,
        didRestoreOpenFilesRef,
        activeFileScrollTopRef,
        openFilePathsRef,
        activeFilePathRef,
        terminalTabRef,
        chatVisibleRef,
        scheduleIdeStatePersistence,
        handlePanelLayoutChange,
    };
}
