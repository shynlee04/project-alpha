import { getPersistenceDB, type IdeStateRecord } from '../persistence'

export type TerminalTab = 'terminal' | 'output' | 'problems'

export interface IdeState {
  projectId: string
  panelLayouts?: Record<string, number[]>
  panelSizes?: number[]
  openFiles: string[]
  activeFile: string | null
  activeFileScrollTop?: number
  terminalTab: TerminalTab
  chatVisible: boolean
  updatedAt: Date
}

export type IdeStatePatch = Partial<
  Omit<IdeState, 'projectId' | 'updatedAt'>
>

const DEFAULT_TERMINAL_TAB: TerminalTab = 'terminal'

function toIdeState(record: IdeStateRecord): IdeState {
  return {
    projectId: record.projectId,
    panelLayouts: record.panelLayouts,
    panelSizes: record.panelSizes,
    openFiles: (record.openFiles ?? []) as string[],
    activeFile: record.activeFile ?? null,
    activeFileScrollTop: record.activeFileScrollTop,
    terminalTab: (record.terminalTab ?? DEFAULT_TERMINAL_TAB) as TerminalTab,
    chatVisible: record.chatVisible ?? true,
    updatedAt: new Date(record.updatedAt),
  }
}

export async function getIdeState(projectId: string): Promise<IdeState | null> {
  const db = await getPersistenceDB()
  if (!db) return null

  const record = await db.get('ideState', projectId)
  if (!record) return null

  return toIdeState(record)
}

export async function saveIdeState(
  state: Omit<IdeState, 'updatedAt'> & { updatedAt?: Date },
): Promise<boolean> {
  const db = await getPersistenceDB()
  if (!db) return false

  const record: IdeStateRecord = {
    projectId: state.projectId,
    panelLayouts: state.panelLayouts,
    panelSizes: state.panelSizes,
    openFiles: state.openFiles,
    activeFile: state.activeFile,
    activeFileScrollTop: state.activeFileScrollTop,
    terminalTab: state.terminalTab,
    chatVisible: state.chatVisible,
    updatedAt: state.updatedAt ? new Date(state.updatedAt) : new Date(),
  }

  await db.put('ideState', record)
  return true
}

export async function updateIdeState(
  projectId: string,
  patch: IdeStatePatch,
): Promise<boolean> {
  const db = await getPersistenceDB()
  if (!db) return false

  const tx = db.transaction('ideState', 'readwrite')
  const store = tx.store

  const existing = await store.get(projectId)

  const next: IdeStateRecord = {
    ...(existing ?? { projectId, updatedAt: new Date() }),
    projectId,
    ...patch,
    updatedAt: new Date(),
  }

  await store.put(next)
  await tx.done
  return true
}

export async function clearIdeState(projectId: string): Promise<boolean> {
  const db = await getPersistenceDB()
  if (!db) return false

  await db.delete('ideState', projectId)
  return true
}

export async function listRecentIdeStates(limit = 20): Promise<IdeState[]> {
  const db = await getPersistenceDB()
  if (!db) return []

  const tx = db.transaction('ideState', 'readonly')
  const index = tx.store.index('by-updated-at')

  const out: IdeState[] = []
  for await (const cursor of index.iterate(null, 'prev')) {
    out.push(toIdeState(cursor.value))
    if (out.length >= limit) break
  }

  await tx.done
  return out
}

