/**
 * WebContainers Manager Types
 * @module lib/webcontainer/types
 */

// Re-export core types from @webcontainer/api
export type {
    WebContainer,
    FileSystemTree,
    WebContainerProcess,
    SpawnOptions,
} from '@webcontainer/api';

/**
 * Options for booting a WebContainer instance
 */
export interface WebContainerManagerOptions {
    /**
     * Cross-Origin-Embedder-Policy header value
     * @default 'require-corp'
     */
    coep?: 'require-corp' | 'credentialless' | 'none';

    /**
     * Working directory name inside the WebContainer
     * @default 'project'
     */
    workdirName?: string;

    /**
     * Forward errors from preview iframes
     * @default true
     */
    forwardPreviewErrors?: boolean | 'exceptions-only';
}

/**
 * Error thrown when WebContainer operations fail
 */
export class WebContainerError extends Error {
    constructor(
        message: string,
        public readonly code: 'NOT_BOOTED' | 'BOOT_FAILED' | 'MOUNT_FAILED' | 'SPAWN_FAILED'
    ) {
        super(message);
        this.name = 'WebContainerError';
    }
}
