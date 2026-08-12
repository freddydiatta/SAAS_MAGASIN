import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconMenu, IconX } from './icons';

export const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="fixed w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50 transition-all">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-20">
                    <div className="flex items-center">
                        <Link to="/" className="flex-shrink-0 flex items-center gap-3 cursor-pointer">
                            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shadow-sm">
                                <span className="text-white font-bold text-xl">G</span>
                            </div>
                            <span className="font-bold text-2xl text-primary tracking-tight">Gestion<span className="text-accent">Pro</span></span>
                        </Link>
                    </div>
                    
                    {/* Desktop menu */}
                    <div className="hidden md:flex items-center space-x-8">
                        <a href="#features" className="font-semibold text-secondary hover:text-accent transition-colors">Fonctionnalités</a>
                        <a href="#partner" className="font-semibold text-secondary hover:text-accent transition-colors">Programme Partenaire</a>
                        <Link to="/login" className="font-semibold text-secondary hover:text-accent transition-colors">Connexion</Link>
                        <Link to="/register" className="btn-primary px-6 py-2.5">Essai Gratuit</Link>
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden flex items-center">
                        <button onClick={() => setIsOpen(!isOpen)} className="text-secondary hover:text-primary focus:outline-none p-2 transition-colors">
                            {isOpen ? <IconX /> : <IconMenu />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isOpen && (
                <div className="md:hidden border-t border-slate-100 bg-white shadow-lg absolute w-full">
                    <div className="px-4 pt-2 pb-4 space-y-1 sm:px-3">
                        <a href="#features" onClick={() => setIsOpen(false)} className="block px-3 py-3 font-medium text-secondary hover:text-primary hover:bg-slate-50 rounded-lg transition-colors">Fonctionnalités</a>
                        <a href="#partner" onClick={() => setIsOpen(false)} className="block px-3 py-3 font-medium text-secondary hover:text-primary hover:bg-slate-50 rounded-lg transition-colors">Programme Partenaire</a>
                        <Link to="/login" onClick={() => setIsOpen(false)} className="block px-3 py-3 font-medium text-secondary hover:text-primary hover:bg-slate-50 rounded-lg transition-colors">Connexion</Link>
                        <div className="p-3 mt-2">
                            <Link to="/register" onClick={() => setIsOpen(false)} className="block w-full text-center btn-primary px-5 py-3">
                                Essai Gratuit
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
};
