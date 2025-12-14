import 'fake-indexeddb/auto'

import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { _resetPersistenceDBForTesting } from '../persistence'
import {
  appendConversationMessage,
  appendToolResult,
  clearConversation,
  getConversation,
  listRecentConversations,
  saveConversation,
  type ConversationMessage,
  type ToolResultRecord,
} from './conversation-store'

describe('ConversationStore', () => {
  beforeEach(async () => {
    await _resetPersistenceDBForTesting()
  })

  afterEach(async () => {
    await _resetPersistenceDBForTesting()
  })

  it('returns null when no conversation exists', async () => {
    const convo = await getConversation('p1')
    expect(convo).toBeNull()
  })

  it('saves and retrieves a conversation', async () => {
    const now = new Date('2025-01-01T00:00:00Z')

    const message: ConversationMessage = {
      id: 'm1',
      role: 'user',
      content: 'hello',
      timestamp: 123,
    }

    const ok = await saveConversation({
      projectId: 'p1',
      messages: [message],
      toolResults: [],
      updatedAt: now,
    })

    expect(ok).toBe(true)

    const loaded = await getConversation('p1')
    expect(loaded?.projectId).toBe('p1')
    expect(loaded?.messages).toEqual([message])
    expect(loaded?.toolResults).toEqual([])
    expect(loaded?.updatedAt.getTime()).toBe(now.getTime())
  })

  it('appends messages and updates updatedAt', async () => {
    const m1: ConversationMessage = { id: 'm1', role: 'user', content: 'a', timestamp: 1 }
    const m2: ConversationMessage = { id: 'm2', role: 'assistant', content: 'b', timestamp: 2 }

    await appendConversationMessage('p2', m1)

    const before = await getConversation('p2')
    expect(before?.messages).toEqual([m1])

    await appendConversationMessage('p2', m2)

    const after = await getConversation('p2')
    expect(after?.messages).toEqual([m1, m2])
    expect(after?.updatedAt.getTime()).toBeGreaterThanOrEqual(before!.updatedAt.getTime())
  })

  it('preserves tool results', async () => {
    const tr: ToolResultRecord = {
      id: 't1',
      toolName: 'demo',
      input: { a: 1 },
      output: { ok: true },
      timestamp: 10,
    }

    await appendToolResult('p3', tr)

    const convo = await getConversation('p3')
    expect(convo?.toolResults).toEqual([tr])
  })

  it('clears a conversation', async () => {
    const m1: ConversationMessage = { id: 'm1', role: 'user', content: 'a', timestamp: 1 }
    await appendConversationMessage('p4', m1)

    const cleared = await clearConversation('p4')
    expect(cleared).toBe(true)

    const convo = await getConversation('p4')
    expect(convo).toBeNull()
  })

  it('lists recent conversations by updatedAt descending', async () => {
    await saveConversation({
      projectId: 'a',
      messages: [],
      toolResults: [],
      updatedAt: new Date('2025-01-01T00:00:02Z'),
    })
    await saveConversation({
      projectId: 'b',
      messages: [],
      toolResults: [],
      updatedAt: new Date('2025-01-01T00:00:03Z'),
    })
    await saveConversation({
      projectId: 'c',
      messages: [],
      toolResults: [],
      updatedAt: new Date('2025-01-01T00:00:01Z'),
    })

    const recent = await listRecentConversations(2)
    expect(recent.map((c) => c.projectId)).toEqual(['b', 'a'])
  })
})
