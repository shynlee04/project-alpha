import { useEffect, useRef, useState } from 'react';
import { Bot, Send, User } from 'lucide-react';
import { appendConversationMessage, clearConversation, getConversation } from '../../lib/workspace';

type Message = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
};

interface AgentChatPanelProps {
    projectId: string | null;
    projectName?: string;
}

export function AgentChatPanel({ projectId, projectName = 'Project' }: AgentChatPanelProps) {
    const createWelcomeMessage = (): Message => ({
        id: 'welcome',
        role: 'assistant',
        content: `Hi! I'm your AI coding assistant for ${projectName}. What would you like to work on?`,
        timestamp: Date.now(),
    });

    const [messages, setMessages] = useState<Message[]>([createWelcomeMessage()]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        let isCancelled = false;

        const load = async () => {
            try {
                if (!projectId) {
                    setMessages([createWelcomeMessage()]);
                    return;
                }

                const convo = await getConversation(projectId);
                if (isCancelled) return;

                if (convo && convo.messages.length > 0) {
                    setMessages(convo.messages as Message[]);
                } else {
                    setMessages([createWelcomeMessage()]);
                }
            } catch {
                if (isCancelled) return;
                setMessages([createWelcomeMessage()]);
            }
        };

        load();

        return () => {
            isCancelled = true;
        };
    }, [projectId, projectName]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        const handleFocus = () => {
            inputRef.current?.focus();
        };

        window.addEventListener('ide.chat.focus', handleFocus);
        return () => window.removeEventListener('ide.chat.focus', handleFocus);
    }, []);

    const send = () => {
        const trimmed = input.trim();
        if (!trimmed) return;

        const userMessage: Message = {
            id: `msg_${Date.now()}`,
            role: 'user',
            content: trimmed,
            timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, userMessage]);
        if (projectId) {
            appendConversationMessage(projectId, userMessage).catch((err) => {
                console.warn('[AgentChatPanel] Failed to persist user message:', err);
            });
        }
        setInput('');

        const assistantMessage: Message = {
            id: `msg_${Date.now()}_assistant`,
            role: 'assistant',
            content: "I'm a demo assistant. Wire me to TanStack AI in Epic 6 for real streaming responses.",
            timestamp: Date.now(),
        };

        window.setTimeout(() => {
            setMessages((prev) => [...prev, assistantMessage]);
            if (projectId) {
                appendConversationMessage(projectId, assistantMessage).catch((err) => {
                    console.warn('[AgentChatPanel] Failed to persist assistant message:', err);
                });
            }
        }, 300);
    };

    const handleClear = async () => {
        if (projectId) {
            await clearConversation(projectId);
        }
        setMessages([createWelcomeMessage()]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        send();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900/30">
            <div className="h-9 px-4 flex items-center justify-between border-b border-slate-800/50">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                        Agent Chat
                    </span>
                </div>
                <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-slate-500 hover:text-slate-200 transition-colors"
                >
                    Clear
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        <div
                            className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${
                                message.role === 'assistant'
                                    ? 'bg-gradient-to-br from-cyan-500 to-fuchsia-500'
                                    : 'bg-slate-800'
                            }`}
                        >
                            {message.role === 'assistant' ? (
                                <Bot className="w-4 h-4 text-white" />
                            ) : (
                                <User className="w-4 h-4 text-slate-200" />
                            )}
                        </div>
                        <div
                            className={`flex-1 max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                                message.role === 'assistant'
                                    ? 'bg-slate-950 text-slate-200'
                                    : 'bg-cyan-500/10 text-slate-200'
                            }`}
                        >
                            {message.content}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800/50">
                <div className="relative">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask the agent… (⌘K)"
                        rows={1}
                        className="w-full px-3 py-2 pr-12 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none min-h-[44px] max-h-[120px]"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        aria-label="Send message"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-cyan-400 hover:text-cyan-200 disabled:text-slate-600 transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
}
