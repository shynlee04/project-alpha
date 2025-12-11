import { describe, it, expect, vi } from 'vitest'
import {
  getPermissionState,
  ensureReadWritePermission,
} from './permission-lifecycle'

function createMockHandle(states: {
  query?: 'granted' | 'prompt' | 'denied'
  request?: 'granted' | 'prompt' | 'denied'
}): FileSystemDirectoryHandle {
  const handle: any = {
    queryPermission: vi
      .fn()
      .mockResolvedValue(states.query ?? 'denied'),
    requestPermission: vi
      .fn()
      .mockResolvedValue(states.request ?? 'denied'),
  }
  return handle as FileSystemDirectoryHandle
}

describe('permission-lifecycle (spike)', () => {
  it('maps queryPermission state correctly', async () => {
    const granted = createMockHandle({ query: 'granted' })
    const prompt = createMockHandle({ query: 'prompt' })
    const denied = createMockHandle({ query: 'denied' })

    await expect(getPermissionState(granted, 'readwrite')).resolves.toBe('granted')
    await expect(getPermissionState(prompt, 'readwrite')).resolves.toBe('prompt')
    await expect(getPermissionState(denied, 'readwrite')).resolves.toBe('denied')
  })

  it('returns denied when queryPermission is missing or throws', async () => {
    const noApi = ({ } as any) as FileSystemDirectoryHandle
    await expect(getPermissionState(noApi, 'readwrite')).resolves.toBe('denied')

    const throwing = createMockHandle({ query: 'granted' }) as any
    throwing.queryPermission.mockRejectedValue(new Error('boom'))

    await expect(getPermissionState(throwing, 'readwrite')).resolves.toBe('denied')
  })

  it('ensureReadWritePermission returns granted when already granted', async () => {
    const handle = createMockHandle({ query: 'granted' })
    await expect(ensureReadWritePermission(handle)).resolves.toBe('granted')
  })

  it('ensureReadWritePermission requests permission when not yet granted', async () => {
    const handle = createMockHandle({ query: 'prompt', request: 'granted' })
    await expect(ensureReadWritePermission(handle)).resolves.toBe('granted')
  })

  it('ensureReadWritePermission falls back to denied when requestPermission fails or is missing', async () => {
    const handleNoApi = ({
      queryPermission: vi.fn().mockResolvedValue('prompt'),
    } as any) as FileSystemDirectoryHandle

    await expect(ensureReadWritePermission(handleNoApi)).resolves.toBe('denied')

    const handleDenied = createMockHandle({ query: 'prompt', request: 'denied' })
    await expect(ensureReadWritePermission(handleDenied)).resolves.toBe('denied')
  })
})
