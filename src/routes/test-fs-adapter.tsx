import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { LocalFSAdapter, FileSystemError, PermissionDeniedError } from '../lib/filesystem/local-fs-adapter'

export const Route = createFileRoute('/test-fs-adapter')({
  component: TestFSAdapter,
})

function TestFSAdapter() {
  const [status, setStatus] = useState<string>('Ready to test')
  const [isSupported] = useState<boolean>(LocalFSAdapter.isSupported())
  const [adapter] = useState(() => new LocalFSAdapter())
  const [hasAccess, setHasAccess] = useState<boolean>(false)
  const [files, setFiles] = useState<any[]>([])

  const testIsSupported = () => {
    setStatus(`API Support Check: ${isSupported ? '✅ Supported' : '❌ Not Supported'}`)
  }

  const requestDirectoryAccess = async () => {
    try {
      setStatus('Requesting directory access...')
      const handle = await adapter.requestDirectoryAccess()
      setHasAccess(true)
      setStatus(`✅ Directory access granted: ${handle.name}`)

      // List files in the directory
      const entries = await adapter.listDirectory()
      setFiles(entries)
      setStatus(`✅ Found ${entries.length} items in directory`)
    } catch (error: any) {
      if (error instanceof PermissionDeniedError) {
        setStatus(`❌ Permission denied: ${error.message}`)
      } else if (error instanceof FileSystemError) {
        setStatus(`❌ FileSystem error: ${error.message}`)
      } else {
        setStatus(`❌ Error: ${error.message}`)
      }
    }
  }

  const testReadFile = async () => {
    try {
      if (!hasAccess) {
        setStatus('❌ No directory access. Please request access first.')
        return
      }

      if (files.length === 0) {
        setStatus('❌ No files available. Please request directory access first.')
        return
      }

      const fileEntry = files.find(f => f.type === 'file')
      if (!fileEntry) {
        setStatus('❌ No files found in directory')
        return
      }

      setStatus(`Reading file: ${fileEntry.name}...`)
      const content = await adapter.readFile(fileEntry.name)

      setStatus(`✅ Successfully read ${fileEntry.name} (${content.content.length} characters)`)
      console.log('File content:', content)
    } catch (error: any) {
      setStatus(`❌ Error reading file: ${error.message}`)
    }
  }

  const testWriteFile = async () => {
    try {
      if (!hasAccess) {
        setStatus('❌ No directory access. Please request access first.')
        return
      }

      setStatus('Writing test file...')
      const testContent = `Test file created at ${new Date().toISOString()}`

      await adapter.writeFile('test-via-gent.txt', testContent)
      setStatus('✅ Successfully wrote test-via-gent.txt')

      // List files again to show the new file
      const entries = await adapter.listDirectory()
      setFiles(entries)
    } catch (error: any) {
      setStatus(`❌ Error writing file: ${error.message}`)
    }
  }

  const testPathValidation = async () => {
    try {
      setStatus('Testing path validation...')

      // This should fail
      try {
        await adapter.readFile('../../../etc/passwd')
        setStatus('❌ Path validation failed - security issue!')
      } catch (error: any) {
        if (error instanceof FileSystemError && error.code === 'PATH_TRAVERSAL') {
          setStatus('✅ Path validation working - traversal attack blocked')
        } else {
          setStatus(`❌ Unexpected error: ${error.message}`)
        }
      }
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Local FS Adapter Test</h1>
        <p className="text-slate-400 mb-8">Testing File System Access API implementation</p>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">API Support</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={testIsSupported}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Check API Support
            </button>
            <span className={`text-sm ${isSupported ? 'text-green-400' : 'text-red-400'}`}>
              {isSupported ? '✅ File System Access API is supported' : '❌ File System Access API not supported'}
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Permission Tests</h2>
          <button
            onClick={requestDirectoryAccess}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-medium transition-colors mr-4"
          >
            Request Directory Access
          </button>
          <p className="text-sm text-slate-400 mt-2">
            This will open a directory picker. Grant access to test file operations.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">File Operations</h2>
          <div className="flex gap-4">
            <button
              onClick={testReadFile}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Read File
            </button>
            <button
              onClick={testWriteFile}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Write Test File
            </button>
          </div>
          {files.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-400 mb-2">Directory Contents:</h3>
              <ul className="text-sm text-slate-300 space-y-1">
                {files.map((file, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span>{file.type === 'directory' ? '📁' : '📄'}</span>
                    <span>{file.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Security Tests</h2>
          <button
            onClick={testPathValidation}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Test Path Validation
          </button>
          <p className="text-sm text-slate-400 mt-2">
            This tests that path traversal attacks are blocked.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Status</h2>
          <div className="bg-slate-950 border border-slate-700 rounded-lg p-4">
            <code className="text-cyan-400">{status}</code>
          </div>
        </div>
      </div>
    </div>
  )
}
