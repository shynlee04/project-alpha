import { createFileRoute } from '@tanstack/react-router'
import { IDELayout } from '../../components/layout/IDELayout'
import { ToastProvider, Toast } from '../../components/ui/Toast'

export const Route = createFileRoute('/workspace/$projectId')({
    ssr: false, // CRITICAL: Disable SSR for WebContainers compatibility
    component: Workspace,
})

function Workspace() {
    const { projectId } = Route.useParams()
    return (
        <ToastProvider>
            <IDELayout projectId={projectId} />
            <Toast />
        </ToastProvider>
    )
}

