import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Folder, Plus, Clock, Trash2, AlertCircle, CheckCircle, HelpCircle, Loader2 } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import {
  listProjectsWithPermission,
  deleteProject,
  saveProject,
  generateProjectId,
  updateProjectLastOpened,
  type ProjectWithPermission,
} from '../lib/workspace'
import { ensureReadWritePermission } from '../lib/filesystem/permission-lifecycle'
import { LocalFSAdapter } from '../lib/filesystem'

export const Route = createFileRoute('/')({ component: Dashboard })

function Dashboard() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectWithPermission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openingProjectId, setOpeningProjectId] = useState<string | null>(null)
  const [openingPhase, setOpeningPhase] = useState<'authorizing' | 'opening' | null>(null)

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    const staleCount = projects.filter((p) => p.permissionState !== 'granted').length
    window.dispatchEvent(
      new CustomEvent('dashboard:loaded', {
        detail: {
          projectCount: projects.length,
          staleCount,
        },
      }),
    )
  }, [projects])

  const loadProjects = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const loadedProjects = await listProjectsWithPermission()
      setProjects(loadedProjects)
    } catch (err) {
      console.error('[Dashboard] Failed to load projects:', err)
      setError('Failed to load recent projects')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle project click with permission check
  const handleProjectClick = useCallback(async (project: ProjectWithPermission) => {
    setOpeningProjectId(project.id)
    setOpeningPhase('opening')

    if (project.permissionState === 'granted') {
      await updateProjectLastOpened(project.id)
      setProjects((prev) => {
        const updated = prev
          .map((p) => (p.id === project.id ? { ...p, lastOpened: new Date() } : p))
          .sort((a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime())
        return updated
      })

      // Permission already granted, navigate directly
      navigate({ to: '/workspace/$projectId', params: { projectId: project.id } })
      return
    }

    if (project.permissionState === 'prompt') {
      // Try to re-authorize
      try {
        setOpeningPhase('authorizing')
        const result = await ensureReadWritePermission(project.fsaHandle)
        if (result === 'granted') {
          setOpeningPhase('opening')

          await updateProjectLastOpened(project.id)
          setProjects((prev) => {
            const updated = prev
              .map((p) => (p.id === project.id ? { ...p, lastOpened: new Date() } : p))
              .sort((a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime())
            return updated
          })

          navigate({ to: '/workspace/$projectId', params: { projectId: project.id } })
        } else {
          setError(`Permission denied for "${project.name}". Please re-select the folder.`)
          setOpeningProjectId(null)
          setOpeningPhase(null)
        }
      } catch (err) {
        console.error('[Dashboard] Permission request failed:', err)
        setError(`Could not access "${project.name}". Please re-select the folder.`)
        setOpeningProjectId(null)
        setOpeningPhase(null)
      }
      return
    }

    // Permission denied - user needs to re-select folder
    setError(`Access to "${project.name}" was denied. Please open the folder again using "Open Local Folder".`)
    setOpeningProjectId(null)
    setOpeningPhase(null)
  }, [navigate])

  // Handle delete
  const handleDelete = useCallback(async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      await deleteProject(projectId)
      setProjects(prev => prev.filter(p => p.id !== projectId))
    } catch (err) {
      console.error('[Dashboard] Failed to delete project:', err)
      setError('Failed to remove project from recents')
    }
  }, [])

  // Handle open local folder
  const handleOpenFolder = useCallback(async () => {
    if (!LocalFSAdapter.isSupported()) {
      setError('File System Access API is not supported in this browser.')
      return
    }

    try {
      const adapter = new LocalFSAdapter()
      const handle = await adapter.requestDirectoryAccess()

      if (!handle) {
        return // User cancelled
      }

      // Generate new project ID and save
      const projectId = generateProjectId()
      await saveProject({
        id: projectId,
        name: handle.name,
        folderPath: handle.name,
        fsaHandle: handle,
        lastOpened: new Date(),
      })

      // Navigate to workspace
      navigate({ to: '/workspace/$projectId', params: { projectId } })
    } catch (err) {
      console.error('[Dashboard] Failed to open folder:', err)
      setError('Failed to open folder. Please try again.')
    }
  }, [navigate])

  // Permission state icon
  const PermissionIcon = ({ state }: { state: string }) => {
    switch (state) {
      case 'granted':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
      case 'prompt':
        return <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
      case 'denied':
        return <AlertCircle className="w-3.5 h-3.5 text-red-400" />
      default:
        return null
    }
  }

  // Permission state badge text
  const getPermissionBadge = (state: string) => {
    switch (state) {
      case 'granted':
        return null // No badge needed when access is granted
      case 'prompt':
        return (
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
            Click to re-authorize
          </span>
        )
      case 'denied':
        return (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
            Access denied
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-bold text-xl tracking-tight">via-gent</span>
            <span className="bg-slate-800 text-xs px-2 py-0.5 rounded text-slate-400">alpha</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-white">Recent Projects</h1>
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Open Local Folder
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-300 hover:text-white underline mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-slate-600 border-t-cyan-400"></div>
            <p className="text-slate-500 mt-4">Loading recent projects...</p>
          </div>
        )}

        {/* Projects list */}
        {!isLoading && (
          <div className="grid gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project)}
                className="group flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-cyan-500/50 hover:bg-slate-800/80 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-slate-800 group-hover:bg-slate-700 p-3 rounded-lg transition-colors">
                    <Folder className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white group-hover:text-cyan-300 transition-colors">
                        {project.name}
                      </h3>
                      <PermissionIcon state={project.permissionState} />
                      {getPermissionBadge(project.permissionState)}
                    </div>
                    <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                      Last opened {formatRelativeDate(project.lastOpened)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => handleDelete(e, project.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-2 opacity-0 group-hover:opacity-100"
                    title="Remove from recents"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {openingProjectId === project.id ? (
                    <div className="flex items-center gap-2 text-xs text-cyan-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>
                        {openingPhase === 'authorizing' ? 'Authorizing…' : 'Opening…'}
                      </span>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-sm group-hover:text-white transition-colors">
                      Open Workspace →
                    </div>
                  )}
                </div>
              </div>
            ))}

            {projects.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-xl">
                <Folder className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500 mb-2">No recent projects found</p>
                <p className="text-slate-600 text-sm">
                  Click "Open Local Folder" to get started
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

/**
 * Format date as relative string (e.g., "2 hours ago", "yesterday")
 */
function formatRelativeDate(date: Date): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return then.toLocaleDateString()
}
