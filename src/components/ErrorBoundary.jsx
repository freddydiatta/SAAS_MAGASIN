import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('Erreur non capturée par l\'interface :', error, info?.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className={`flex flex-col items-center justify-center text-center p-8 ${this.props.compact ? 'min-h-[60vh]' : 'min-h-screen bg-surface'}`}>
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 mb-6">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <h1 className="text-xl font-bold text-primary mb-2">Une erreur inattendue s'est produite</h1>
                    <p className="text-secondary max-w-md mb-6">
                        Quelque chose s'est mal passé sur cette page. Vos ventes et données déjà enregistrées ne sont pas affectées.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-accent hover:bg-accent-hover text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95 shadow-premium"
                    >
                        Recharger la page
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
