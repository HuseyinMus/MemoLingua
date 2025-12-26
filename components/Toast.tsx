import { useState, useEffect } from 'react';

interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
}

let toastId = 0;

interface ToastItem extends ToastProps {
    id: number;
}

const toastListeners: Set<(toasts: ToastItem[]) => void> = new Set();
let toasts: ToastItem[] = [];

const notifyListeners = () => {
    toastListeners.forEach(listener => listener([...toasts]));
};

export const toast = {
    success: (message: string, duration = 3000) => {
        const id = toastId++;
        toasts.push({ id, message, type: 'success', duration });
        notifyListeners();
        setTimeout(() => {
            toasts = toasts.filter(t => t.id !== id);
            notifyListeners();
        }, duration);
    },
    error: (message: string, duration = 4000) => {
        const id = toastId++;
        toasts.push({ id, message, type: 'error', duration });
        notifyListeners();
        setTimeout(() => {
            toasts = toasts.filter(t => t.id !== id);
            notifyListeners();
        }, duration);
    },
    warning: (message: string, duration = 3500) => {
        const id = toastId++;
        toasts.push({ id, message, type: 'warning', duration });
        notifyListeners();
        setTimeout(() => {
            toasts = toasts.filter(t => t.id !== id);
            notifyListeners();
        }, duration);
    },
    info: (message: string, duration = 3000) => {
        const id = toastId++;
        toasts.push({ id, message, type: 'info', duration });
        notifyListeners();
        setTimeout(() => {
            toasts = toasts.filter(t => t.id !== id);
            notifyListeners();
        }, duration);
    },
};

export const ToastContainer = () => {
    const [toastList, setToastList] = useState<ToastItem[]>([]);

    useEffect(() => {
        const listener = (newToasts: ToastItem[]) => {
            setToastList(newToasts);
        };
        toastListeners.add(listener);
        return () => {
            toastListeners.delete(listener);
        };
    }, []);

    const getToastStyles = (type: ToastProps['type']) => {
        switch (type) {
            case 'success':
                return 'bg-green-500 text-white';
            case 'error':
                return 'bg-red-500 text-white';
            case 'warning':
                return 'bg-yellow-500 text-black';
            case 'info':
            default:
                return 'bg-blue-500 text-white';
        }
    };

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
            {toastList.map(toast => (
                <div
                    key={toast.id}
                    className={`${getToastStyles(toast.type)} px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm animate-slide-in-right`}
                >
                    {toast.message}
                </div>
            ))}
        </div>
    );
};
