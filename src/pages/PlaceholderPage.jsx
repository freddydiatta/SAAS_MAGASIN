export const PlaceholderPage = ({ title }) => {
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-1 tracking-tight">{title}</h1>
                    <p className="text-secondary text-sm">
                        Page en cours de construction
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-3xl p-12 shadow-premium text-center border border-slate-100">
                <div className="text-6xl mb-6">🚧</div>
                <h2 className="text-2xl font-bold text-primary mb-3">Bientôt disponible</h2>
                <p className="text-secondary max-w-md mx-auto">
                    Cette fonctionnalité est en cours de développement et sera disponible dans une prochaine mise à jour.
                </p>
            </div>
        </div>
    );
};
