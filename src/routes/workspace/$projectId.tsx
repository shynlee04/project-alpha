import { createFileRoute } from '@tanstack/react-router'
import { IDELayout } from '../../components/layout/IDELayout'
import { ToastProvider, Toast } from '../../components/ui/Toast'
import { WorkspaceProvider } from '../../lib/workspace'
import { getProject } from '../../lib/workspace'

export const Route = createFileRoute('/workspace/$projectId')({
    ssr: false, // CRITICAL: Disable SSR for WebContainers compatibility
    component: Workspace,
    loader: async ({ params }) => {
        // Load project from ProjectStore if it exists
        const project = await getProject(params.projectId)
        return { project }
    },
})

function Workspace() {
    const { projectId } = Route.useParams()
    const { project } = Route.useLoaderData()

    return (
        <ToastProvider>
            <WorkspaceProvider projectId={projectId} initialProject={project}>
                <IDELayout />
            </WorkspaceProvider>
            <Toast />
        </ToastProvider>
    )
}
