export const Footer = () => {
    return (
        <footer className="bg-white pt-16 pb-8 border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold">G</span>
                            </div>
                            <span className="font-bold text-xl text-primary">Gestion<span className="text-accent">Pro</span></span>
                        </div>
                        <p className="text-gray-500 max-w-sm">
                            Simplifiez la gestion de votre commerce, suivez vos stocks et augmentez vos bénéfices sans jargon technique.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-900 mb-4 uppercase text-sm">Légal & Contact</h4>
                        <ul className="space-y-3">
                            <li><a href="#" className="text-gray-500 hover:text-accent">Mentions légales</a></li>
                            <li><a href="#" className="text-gray-500 hover:text-accent">Confidentialité</a></li>
                            <li><a href="#" className="text-gray-500 hover:text-accent">Contactez-nous</a></li>
                        </ul>
                    </div>
                </div>

                <div className="bg-surface rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 mb-8 border border-gray-100">
                    <div>
                        <h4 className="font-bold text-gray-900 text-lg">Prêt à abandonner vos carnets de notes ?</h4>
                    </div>
                    <button className="bg-accent hover:bg-accentHover text-white px-8 py-3 rounded-full font-bold shadow-md w-full md:w-auto">
                        Essai gratuit
                    </button>
                </div>

                <div className="text-center text-gray-400 text-sm">
                    &copy; {new Date().getFullYear()} GestionPro. Tous droits réservés.
                </div>
            </div>
        </footer>
    );
};
