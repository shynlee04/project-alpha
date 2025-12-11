/**
 * Toast notification component
 * @module components/ui/Toast
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToast, type ToastVariant, type ToastMessage } from './ToastContext';

interface ToastItemProps {
    toast: ToastMessage;
    onDismiss: (id: string) => void;
}

const variantStyles: Record<ToastVariant, string> = {
    success: 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100',
    error: 'bg-red-900/90 border-red-500/50 text-red-100',
    warning: 'bg-amber-900/90 border-amber-500/50 text-amber-100',
    info: 'bg-slate-800/90 border-slate-600/50 text-slate-100',
};

const variantIcons: Record<ToastVariant, typeof CheckCircle> = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

/**
 * Individual toast item with animation
 */
function ToastItem({ toast, onDismiss }: ToastItemProps) {
    const [isVisible, setIsVisible] = useState(false);
    const Icon = variantIcons[toast.variant];

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => {
            setIsVisible(true);
        });
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
        setTimeout(() => onDismiss(toast.id), 150);
    };

    return (
        <div
            className={`
                flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm
                transition-all duration-150 ease-out
                ${variantStyles[toast.variant]}
                ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}
            `}
        >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button
                onClick={handleDismiss}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                aria-label="Dismiss notification"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

/**
 * Toast container that renders via portal
 */
export function ToastContainer() {
    const { toasts, dismiss } = useToast();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return createPortal(
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
        </div>,
        document.body
    );
}

/**
 * Standalone Toast component for simpler usage
 */
export function Toast() {
    return <ToastContainer />;
}
