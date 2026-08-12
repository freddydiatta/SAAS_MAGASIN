import { useState } from 'react';
import { IconMenu, IconX } from './icons';

export const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="fixed w-full bg-surface border-b-4 border-primary z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-20">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer">
                            <div className="w-10 h-10 border-4 border-primary bg-accent flex items-center justify-center shadow-neo-sm">
                                <span className="text-primary font-black uppercase text-xl">G</span>
                            </div>
                            <span className="font-black text-2xl text-primary uppercase">Gestion<span className="bg-accent px-1 border-2 border-primary">Pro</span></span>
                        </div>
                    </div>
                    
                    {/* Desktop menu */}
                    <div className="hidden md:flex items-center space-x-8">
                        <a href="#features" className="font-bold text-primary hover:bg-accent hover:px-2 transition-all">Fonctionnalités</a>
                        <a href="#partner" className="font-bold text-primary hover:bg-accent hover:px-2 transition-all">Programme Partenaire</a>
                        <a href="#login" className="font-bold text-primary hover:bg-accent hover:px-2 transition-all">Connexion</a>
                        <a href="#signup" className="neo-button bg-accentHover text-primary px-6 py-2">Essai Gratuit</a>
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden flex items-center">
                        <button onClick={() => setIsOpen(!isOpen)} className="text-primary focus:outline-none p-2 border-4 border-primary bg-white shadow-neo-sm active:shadow-none active:translate-y-1 transition-all">
                            {isOpen ? <IconX /> : <IconMenu />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isOpen && (
                <div className="md:hidden border-t-4 border-primary bg-white">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <a href="#features" onClick={() => setIsOpen(false)} className="block px-3 py-3 font-bold text-primary border-b-4 border-transparent hover:border-primary hover:bg-accent transition-colors">Fonctionnalités</a>
                        <a href="#partner" onClick={() => setIsOpen(false)} className="block px-3 py-3 font-bold text-primary border-b-4 border-transparent hover:border-primary hover:bg-accent transition-colors">Programme Partenaire</a>
                        <a href="#login" onClick={() => setIsOpen(false)} className="block px-3 py-3 font-bold text-primary border-b-4 border-transparent hover:border-primary hover:bg-accent transition-colors">Connexion</a>
                        <div className="p-3">
                            <a href="#signup" onClick={() => setIsOpen(false)} className="block w-full text-center neo-button bg-accentHover text-primary px-5 py-3">
                                Essai Gratuit
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
};
