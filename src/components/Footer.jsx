export const Footer = ({ onContactClick }) => {
    return (
        <footer className="bg-white pt-16 pb-8 border-t-4 border-primary">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    <div className="md:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 border-4 border-primary bg-accent flex items-center justify-center shadow-neo-sm">
                                <span className="text-primary font-black uppercase text-lg">G</span>
                            </div>
                            <span className="font-black text-xl text-primary uppercase">Gestion<span className="bg-accent px-1 border-2 border-primary">Pro</span></span>
                        </div>
                        <p className="text-primary font-bold mb-6">
                            L'outil de gestion pensé pour les réalités de votre commerce au Sénégal. Simple, robuste, efficace.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-black text-primary uppercase mb-4 text-lg">Produit</h4>
                        <ul className="space-y-3">
                            <li><a href="#features" className="text-primary font-bold hover:bg-accent hover:px-2 transition-all inline-block">Fonctionnalités</a></li>
                            <li><a href="#pricing" className="text-primary font-bold hover:bg-accent hover:px-2 transition-all inline-block">Tarifs</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-black text-primary uppercase mb-4 text-lg">Légal</h4>
                        <ul className="space-y-3">
                            <li><a href="#" className="text-primary font-bold hover:bg-accent hover:px-2 transition-all inline-block">CGV</a></li>
                            <li><a href="#" className="text-primary font-bold hover:bg-accent hover:px-2 transition-all inline-block">Confidentialité</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-black text-primary uppercase mb-4 text-lg">Contact</h4>
                        <ul className="space-y-3">
                            <li className="text-primary font-bold">Dakar, Sénégal</li>
                            <li className="text-primary font-bold">+221 76 846 57 86</li>
                            <li><a href="mailto:contact@gestionpro.sn" className="text-primary font-bold hover:bg-accent hover:px-2 transition-all inline-block">contact@gestionpro.sn</a></li>
                        </ul>
                    </div>
                </div>

                <div className="border-4 border-primary bg-surface p-8 flex flex-col md:flex-row items-center justify-between gap-6 mb-8 shadow-neo">
                    <div>
                        <h4 className="font-black text-primary text-2xl uppercase">Une question ? Un besoin spécifique ?</h4>
                        <p className="text-primary font-bold mt-2">Notre équipe est là pour vous accompagner dans votre digitalisation.</p>
                    </div>
                    <button 
                        onClick={onContactClick}
                        className="neo-button bg-accentHover text-primary px-8 py-4 w-full md:w-auto"
                    >
                        Nous Contacter
                    </button>
                </div>

                <div className="pt-8 border-t-4 border-primary flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-primary font-bold">
                        &copy; {new Date().getFullYear()} GestionPro. Tous droits réservés.
                    </p>
                </div>
            </div>
        </footer>
    );
};
