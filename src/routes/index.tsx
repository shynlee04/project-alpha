import { createFileRoute, Link } from '@tanstack/react-router'
import { Folder, Plus, Clock } from 'lucide-react'

export const Route = createFileRoute('/')({ component: Dashboard })

function Dashboard() {
  const recentProjects = [
    { id: 'test-project', name: 'Test Project', lastOpened: new Date() },
    // Mock data for now, will be replaced by IndexedDB later
  ]

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
          <button className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            <Plus className="w-4 h-4" />
            Open Local Folder
          </button>
        </div>

        <div className="grid gap-4">
          {recentProjects.map((project) => (
            <Link
              key={project.id}
              to="/workspace/$projectId"
              params={{ projectId: project.id }}
              className="group flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-cyan-500/50 hover:bg-slate-800/80 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-slate-800 group-hover:bg-slate-700 p-3 rounded-lg transition-colors">
                  <Folder className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white group-hover:text-cyan-300 transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    Last opened {project.lastOpened.toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-slate-500 text-sm group-hover:text-white transition-colors">
                Open Workspace →
              </div>
            </Link>
          ))}

          {recentProjects.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-xl">
              <p className="text-slate-500">No recent projects found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
