/**
 * Unit tests for unified persistence DB.
 *
 * Story 5-1: Set Up IndexedDB Schema
 */

// Import fake-indexeddb polyfill BEFORE any idb imports
import 'fake-indexeddb/auto';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    getPersistenceDB,
    _resetPersistenceDBForTesting,
    PERSISTENCE_DB_NAME,
    PERSISTENCE_DB_VERSION,
} from '../db';

describe('PersistenceDB', () => {
    beforeEach(async () => {
        await _resetPersistenceDBForTesting();
    });

    afterEach(async () => {
        await _resetPersistenceDBForTesting();
    });

    it('opens the database with required stores', async () => {
        const db = await getPersistenceDB();

        expect(db).not.toBeNull();
        expect(db!.name).toBe(PERSISTENCE_DB_NAME);
        expect(db!.version).toBe(PERSISTENCE_DB_VERSION);

        expect(db!.objectStoreNames.contains('projects')).toBe(true);
        expect(db!.objectStoreNames.contains('conversations')).toBe(true);
        expect(db!.objectStoreNames.contains('ideState')).toBe(true);
    });

    it('creates expected indexes', async () => {
        const db = await getPersistenceDB();
        expect(db).not.toBeNull();

        const projectsTx = db!.transaction('projects');
        expect(projectsTx.store.indexNames.contains('by-last-opened')).toBe(true);
        await projectsTx.done;

        const conversationsTx = db!.transaction('conversations');
        expect(conversationsTx.store.indexNames.contains('by-project-id')).toBe(true);
        expect(conversationsTx.store.indexNames.contains('by-updated-at')).toBe(true);
        await conversationsTx.done;

        const ideStateTx = db!.transaction('ideState');
        expect(ideStateTx.store.indexNames.contains('by-project-id')).toBe(true);
        expect(ideStateTx.store.indexNames.contains('by-updated-at')).toBe(true);
        await ideStateTx.done;
    });
});

