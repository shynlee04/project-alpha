/**
 * @module lib/workspace/hooks/useInitialSync
 */

import { useEffect } from 'react';
import { getPermissionState } from '../../filesystem/permission-lifecycle';
import type { useWorkspaceState } from './useWorkspaceState';
import type { useSyncOperations } from './useSyncOperations';

type WorkspaceStateReturn = ReturnType<typeof useWorkspaceState>;
type SyncOperationsReturn = ReturnType<typeof useSyncOperations>;

export function useInitialSync(
    state: WorkspaceStateReturn['state'],
    setters: WorkspaceStateReturn['setters'],
    refs: WorkspaceStateReturn['refs'],
    syncOperations: SyncOperationsReturn
) {
    const { directoryHandle, syncStatus, autoSync } = state;
    const { setPermissionState } = setters;
    const { syncManagerRef } = refs;
    const { performSync } = syncOperations;

    useEffect(() => {
        if (directoryHandle && !syncManagerRef.current && syncStatus === 'idle') {
            const initSync = async () => {
                const updatedState = await getPermissionState(directoryHandle, 'readwrite');
                setPermissionState(updatedState);

                if (updatedState === 'granted') {
                    await performSync(directoryHandle, { fullSync: autoSync });
                } else {
                    console.log('[Workspace] Permission needed for initial sync');
                    // We don't auto-prompt here as it requires user gesture usually.
                    // We just set status so UI shows "Re-authorize"
                }
            };
            initSync();
        }
    }, [directoryHandle, syncStatus, autoSync, performSync, setPermissionState, syncManagerRef]);
}
