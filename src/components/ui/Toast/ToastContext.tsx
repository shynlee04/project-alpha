/**
 * Toast notification context and hook
 * @module components/ui/Toast
 */

import {
    createContext,
    useContext,
    useState,
    useCallback,
    type ReactNode,
} from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
    id: string;
    message: string;
    variant: ToastVariant;
    duration?: number;
}

interface ToastContextValue {
    toasts: ToastMessage[];
    toast: (message: string, variant?: ToastVariant, duration?: number) => void;
    dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Generate unique ID for toast messages
 */
let toastIdCounter = 0;
function generateToastId(): string {
    return `toast-${Date.now()}-${++toastIdCounter}`;
}

/**
 * Toast provider wraps the app to enable toast notifications
 */
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const toast = useCallback(
        (message: string, variant: ToastVariant = 'info', duration = 4000) => {
            const id = generateToastId();
            const newToast: ToastMessage = { id, message, variant, duration };

            setToasts((prev) => [...prev, newToast]);

            // Auto-dismiss after duration
            if (duration > 0) {
                setTimeout(() => {
                    setToasts((prev) => prev.filter((t) => t.id !== id));
                }, duration);
            }
        },
        []
    );

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, toast, dismiss }}>
            {children}
        </ToastContext.Provider>
    );
}

/**
 * Hook to access toast functionality
 */
export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
