/**
 * Persistence module exports.
 *
 * Story 5-1: Unified IndexedDB schema facade.
 */

export {
    getPersistenceDB,
    _resetPersistenceDBForTesting,
    PERSISTENCE_DB_NAME,
    PERSISTENCE_DB_VERSION,
    type ViaGentPersistenceDB,
    type ConversationRecord,
    type IdeStateRecord,
} from './db';

