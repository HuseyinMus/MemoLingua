import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });

        // You can also log the error to an error reporting service here
        // Example: logErrorToService(error, errorInfo);
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-2xl border border-zinc-100 dark:border-zinc-800">
                        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-600 mb-6 mx-auto">
                            <AlertTriangle size={32} />
                        </div>

                        <h2 className="text-2xl font-black text-center mb-3 text-black dark:text-white">
                            Bir Hata Oluştu
                        </h2>

                        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6">
                            Üzgünüz, beklenmeyen bir hata meydana geldi. Lütfen sayfayı yenileyin veya tekrar deneyin.
                        </p>

                        {this.state.error && (
                            <details className="mb-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-xs">
                                <summary className="cursor-pointer font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                                    Teknik Detaylar
                                </summary>
                                <pre className="text-red-600 dark:text-red-400 overflow-auto whitespace-pre-wrap break-words">
                                    {this.state.error.toString()}
                                    {this.state.errorInfo && (
                                        <>
                                            {'\n\n'}
                                            {this.state.errorInfo.componentStack}
                                        </>
                                    )}
                                </pre>
                            </details>
                        )}

                        <button
                            onClick={this.handleReset}
                            className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                        >
                            <RefreshCw size={18} />
                            Tekrar Dene
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
