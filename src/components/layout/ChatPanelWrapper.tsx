/**
 * @fileoverview Chat Panel Wrapper Component
 * @module components/layout/ChatPanelWrapper
 * 
 * Right sidebar containing the agent chat panel with close button.
 * Part of the IDE layout refactoring to reduce IDELayout.tsx complexity.
 * 
 * @example
 * ```tsx
 * <ChatPanelWrapper
 *   projectId="my-project"
 *   projectName="My Project"
 *   onClose={() => setIsChatVisible(false)}
 * />
 * ```
 */

import { X } from 'lucide-react';
import { AgentChatPanel } from '../ide/AgentChatPanel';

/**
 * Props for the ChatPanelWrapper component.
 * 
 * @interface ChatPanelWrapperProps
 */
export interface ChatPanelWrapperProps {
    /** Current project ID */
    projectId: string | null;
    /** Display name for the project */
    projectName: string;
    /** Callback to close the chat panel */
    onClose: () => void;
}

/**
 * ChatPanelWrapper - Right sidebar with agent chat.
 * 
 * Contains:
 * - Header with title and close button
 * - AgentChatPanel for AI interaction
 * 
 * @param props - Component props
 * @returns Chat panel wrapper JSX element
 */
export function ChatPanelWrapper({
    projectId,
    projectName,
    onClose,
}: ChatPanelWrapperProps): React.JSX.Element {
    return (
        <div className="h-full flex flex-col border-l border-slate-800">
            {/* Header */}
            <div className="h-9 px-4 flex items-center justify-between border-b border-slate-800/50">
                <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                    Agent Chat
                </span>
                <button
                    onClick={onClose}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                    title="Close chat panel"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Chat Content */}
            <div className="flex-1 min-h-0">
                <AgentChatPanel
                    projectId={projectId}
                    projectName={projectName}
                />
            </div>
        </div>
    );
}
