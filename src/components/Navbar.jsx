import { useState } from 'react';
import { IconMenu } from './icons';

export const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="fixed w-full z-50 transition-all duration-300 bg-white/90 backdrop-blur-md shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-20 items-center">
                    <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                            <span className="text-white font-bold text-xl">G</span>
                        </div>
                        <span className="font-bold text-2xl text-primary tracking-tight">Gestion<span className="text-accent">Pro</span></span>
                    </div>

                    <div className="hidden md:flex items-center space-x-8">
                        <a href="#features" className="text-gray-600 hover:text-primary font-medium transition-colors">Fonctionnalités</a>
                        <a href="#partner" className="text-gray-600 hover:text-primary font-medium transition-colors">Programme Partenaire</a>
                        <a href="#login" className="text-gray-600 hover:text-primary font-medium transition-colors">Connexion</a>
                        <a href="#signup" className="bg-accent hover:bg-accentHover text-white px-6 py-2.5 rounded-full font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-accent/30">
                            Essai gratuit
                        </a>
                    </div>

                    <div className="md:hidden flex items-center">
                        <button onClick={() => setIsOpen(!isOpen)} className="text-primary focus:outline-none">
                            <IconMenu />
                        </button>
                    </div>
                </div>
            </div>

            {isOpen && (
                <div className="md:hidden bg-white border-t border-gray-100 absolute w-full shadow-lg">
                    <div className="px-4 pt-2 pb-6 space-y-2">
                        <a href="#features" onClick={() => setIsOpen(false)} className="block px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50">Fonctionnalités</a>
                        <a href="#partner" onClick={() => setIsOpen(false)} className="block px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50">Programme Partenaire</a>
                        <a href="#login" onClick={() => setIsOpen(false)} className="block px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50">Connexion</a>
                        <div className="mt-4 px-3">
                            <a href="#signup" onClick={() => setIsOpen(false)} className="block w-full text-center bg-accent text-white px-5 py-3 rounded-xl font-semibold shadow-md">
                                Essai gratuit
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
};
