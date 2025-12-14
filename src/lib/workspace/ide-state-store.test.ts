import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { _resetPersistenceDBForTesting } from '../persistence'
import {
  clearIdeState,
  getIdeState,
  listRecentIdeStates,
  saveIdeState,
  updateIdeState,
  type TerminalTab,
} from './ide-state-store'

describe('IdeStateStore', () => {
  beforeEach(async () => {
    await _resetPersistenceDBForTesting()
  })

  afterEach(async () => {
    await _resetPersistenceDBForTesting()
  })

  it('returns null when no ide state exists', async () => {
    const state = await getIdeState('p1')
    expect(state).toBeNull()
  })

  it('saves and retrieves ide state', async () => {
    const now = new Date('2025-01-01T00:00:00Z')

    const ok = await saveIdeState({
      projectId: 'p1',
      panelLayouts: {
        main: [20, 55, 25],
        center: [70, 30],
        editor: [60, 40],
      },
      openFiles: ['src/main.ts', 'README.md'],
      activeFile: 'src/main.ts',
      activeFileScrollTop: 123,
      terminalTab: 'output' satisfies TerminalTab,
      chatVisible: false,
      updatedAt: now,
    })

    expect(ok).toBe(true)

    const loaded = await getIdeState('p1')
    expect(loaded?.projectId).toBe('p1')
    expect(loaded?.panelLayouts).toEqual({
      main: [20, 55, 25],
      center: [70, 30],
      editor: [60, 40],
    })
    expect(loaded?.openFiles).toEqual(['src/main.ts', 'README.md'])
    expect(loaded?.activeFile).toBe('src/main.ts')
    expect(loaded?.activeFileScrollTop).toBe(123)
    expect(loaded?.terminalTab).toBe('output')
    expect(loaded?.chatVisible).toBe(false)
    expect(loaded?.updatedAt.getTime()).toBe(now.getTime())
  })

  it('updates ide state by merging patches', async () => {
    await saveIdeState({
      projectId: 'p2',
      panelLayouts: { main: [20, 80] },
      openFiles: ['a.ts'],
      activeFile: 'a.ts',
      terminalTab: 'terminal',
      chatVisible: true,
    })

    const ok = await updateIdeState('p2', {
      activeFile: 'b.ts',
      openFiles: ['a.ts', 'b.ts'],
      terminalTab: 'problems',
    })
    expect(ok).toBe(true)

    const loaded = await getIdeState('p2')
    expect(loaded?.panelLayouts).toEqual({ main: [20, 80] })
    expect(loaded?.openFiles).toEqual(['a.ts', 'b.ts'])
    expect(loaded?.activeFile).toBe('b.ts')
    expect(loaded?.terminalTab).toBe('problems')
  })

  it('clears ide state', async () => {
    await saveIdeState({
      projectId: 'p3',
      panelLayouts: { main: [50, 50] },
      openFiles: [],
      activeFile: null,
      terminalTab: 'terminal',
      chatVisible: true,
    })

    const cleared = await clearIdeState('p3')
    expect(cleared).toBe(true)

    const loaded = await getIdeState('p3')
    expect(loaded).toBeNull()
  })

  it('lists recent ide states by updatedAt descending', async () => {
    await saveIdeState({
      projectId: 'a',
      panelLayouts: {},
      openFiles: [],
      activeFile: null,
      terminalTab: 'terminal',
      chatVisible: true,
      updatedAt: new Date('2025-01-01T00:00:02Z'),
    })
    await saveIdeState({
      projectId: 'b',
      panelLayouts: {},
      openFiles: [],
      activeFile: null,
      terminalTab: 'terminal',
      chatVisible: true,
      updatedAt: new Date('2025-01-01T00:00:03Z'),
    })
    await saveIdeState({
      projectId: 'c',
      panelLayouts: {},
      openFiles: [],
      activeFile: null,
      terminalTab: 'terminal',
      chatVisible: true,
      updatedAt: new Date('2025-01-01T00:00:01Z'),
    })

    const recent = await listRecentIdeStates(2)
    expect(recent.map((s) => s.projectId)).toEqual(['b', 'a'])
  })
})

