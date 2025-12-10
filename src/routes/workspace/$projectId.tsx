import { createFileRoute } from '@tanstack/react-router'
import { IDELayout } from '../../components/layout/IDELayout'

export const Route = createFileRoute('/workspace/$projectId')({
    ssr: false, // CRITICAL: Disable SSR for WebContainers compatibility
    component: Workspace,
})

function Workspace() {
    const { projectId } = Route.useParams()
    return <IDELayout projectId={projectId} />
}
