export const Footer = ({ onContactClick }) => {
    return (
        <footer className="bg-white pt-16 pb-8 border-t border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    <div className="md:col-span-1">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-sm">
                                <span className="text-white font-bold text-lg">G</span>
                            </div>
                            <span className="font-bold text-xl text-primary tracking-tight">Gestion<span className="text-accent">Pro</span></span>
                        </div>
                        <p className="text-secondary text-sm leading-relaxed">
                            L'outil de gestion pensé pour les réalités de votre commerce au Sénégal. Simple, robuste, efficace.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold text-primary mb-4 text-sm uppercase tracking-wider">Produit</h4>
                        <ul className="space-y-3">
                            <li><a href="#features" className="text-secondary hover:text-accent transition-colors text-sm">Fonctionnalités</a></li>
                            <li><a href="#pricing" className="text-secondary hover:text-accent transition-colors text-sm">Tarifs</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-primary mb-4 text-sm uppercase tracking-wider">Légal</h4>
                        <ul className="space-y-3">
                            <li><a href="#" className="text-secondary hover:text-accent transition-colors text-sm">CGV</a></li>
                            <li><a href="#" className="text-secondary hover:text-accent transition-colors text-sm">Confidentialité</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-primary mb-4 text-sm uppercase tracking-wider">Contact</h4>
                        <ul className="space-y-3">
                            <li className="text-secondary text-sm">Dakar, Sénégal</li>
                            <li className="text-secondary font-medium text-sm">+221 76 846 57 86</li>
                            <li><a href="mailto:contact@gestionpro.sn" className="text-secondary hover:text-accent transition-colors text-sm">contact@gestionpro.sn</a></li>
                        </ul>
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 mb-8 shadow-sm">
                    <div>
                        <h4 className="font-bold text-primary text-xl mb-1">Une question ? Un besoin spécifique ?</h4>
                        <p className="text-secondary text-sm">Notre équipe est là pour vous accompagner dans votre digitalisation.</p>
                    </div>
                    <button 
                        onClick={onContactClick}
                        className="btn-primary px-8 py-3.5 w-full md:w-auto"
                    >
                        Nous Contacter
                    </button>
                </div>

                <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-secondary text-sm">
                        &copy; {new Date().getFullYear()} GestionPro. Tous droits réservés.
                    </p>
                </div>
            </div>
        </footer>
    );
};
