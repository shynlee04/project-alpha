/**
 * Persistence DB - Unified IndexedDB schema for Project Alpha spike.
 *
 * Story 5-1: Set Up IndexedDB Schema
 *
 * Centralizes persistence behind a small facade so higher-level stores
 * (projects, conversations, ideState) share one database and upgrade path.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ProjectMetadata } from '../workspace/project-store';

// ============================================================================
// Record Types (placeholder shapes, refined in Stories 5.2–5.4)
// ============================================================================

export interface ConversationRecord {
    id: string;
    projectId: string;
    messages: unknown[];
    toolResults?: unknown[];
    updatedAt: Date;
}

export interface IdeStateRecord {
    projectId: string;
    /**
     * Panel layouts keyed by panel-group identifier (e.g. "main", "center", "editor").
     * Use this for async persistence (IndexedDB) since react-resizable-panels storage is sync-only.
     */
    panelLayouts?: Record<string, number[]>;
    /**
     * Legacy single-layout field (kept for backward compatibility with early spikes).
     */
    panelSizes?: number[];
    openFiles?: string[];
    activeFile?: string | null;
    activeFileScrollTop?: number;
    terminalTab?: 'terminal' | 'output' | 'problems';
    chatVisible?: boolean;
    updatedAt: Date;
}

// ============================================================================
// IndexedDB Schema
// ============================================================================

export interface ViaGentPersistenceDB extends DBSchema {
    projects: {
        key: string;
        value: ProjectMetadata;
        indexes: {
            'by-last-opened': Date;
        };
    };
    conversations: {
        key: string;
        value: ConversationRecord;
        indexes: {
            'by-project-id': string;
            'by-updated-at': Date;
        };
    };
    ideState: {
        key: string;
        value: IdeStateRecord;
        indexes: {
            'by-project-id': string;
            'by-updated-at': Date;
        };
    };
}

const DB_NAME = 'via-gent-persistence';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<ViaGentPersistenceDB> | null = null;

/**
 * Get or open the unified persistence database.
 */
export async function getPersistenceDB(): Promise<IDBPDatabase<ViaGentPersistenceDB> | null> {
    if (typeof indexedDB === 'undefined') {
        console.warn('[PersistenceDB] IndexedDB is not available.');
        return null;
    }

    if (dbInstance) {
        return dbInstance;
    }

    try {
        dbInstance = await openDB<ViaGentPersistenceDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                if (oldVersion < 1) {
                    const projectsStore = db.createObjectStore('projects', { keyPath: 'id' });
                    projectsStore.createIndex('by-last-opened', 'lastOpened');

                    const conversationsStore = db.createObjectStore('conversations', { keyPath: 'id' });
                    conversationsStore.createIndex('by-project-id', 'projectId');
                    conversationsStore.createIndex('by-updated-at', 'updatedAt');

                    const ideStateStore = db.createObjectStore('ideState', { keyPath: 'projectId' });
                    ideStateStore.createIndex('by-project-id', 'projectId');
                    ideStateStore.createIndex('by-updated-at', 'updatedAt');
                }
            },
            blocked() {
                console.warn('[PersistenceDB] Upgrade blocked by another tab.');
            },
            blocking() {
                dbInstance?.close();
                dbInstance = null;
            },
            terminated() {
                dbInstance = null;
            },
        });

        return dbInstance;
    } catch (error) {
        console.error('[PersistenceDB] Failed to open database:', error);
        return null;
    }
}

/**
 * Close and delete the persistence database.
 * Testing-only helper.
 */
export async function _resetPersistenceDBForTesting(): Promise<void> {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }

    if (typeof indexedDB === 'undefined') return;

    await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
    });
}

export const PERSISTENCE_DB_NAME = DB_NAME;
export const PERSISTENCE_DB_VERSION = DB_VERSION;
