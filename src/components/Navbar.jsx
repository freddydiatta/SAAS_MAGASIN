import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

export const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <motion.nav 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`fixed w-full z-50 transition-all duration-300 ${
                scrolled 
                    ? 'bg-white/80 dark:bg-panel/80 backdrop-blur-lg shadow-sm border-b border-slate-200 dark:border-border-theme py-2' 
                    : 'bg-transparent py-4'
            }`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center">
                        <Link to="/" className="flex-shrink-0 flex items-center gap-3 cursor-pointer group">
                            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20 group-hover:scale-105 transition-transform">
                                <span className="text-white font-black text-xl">G</span>
                            </div>
                            <span className="font-extrabold text-2xl text-primary tracking-tight">Gestion<span className="text-accent">Pro</span></span>
                        </Link>
                    </div>
                    
                    {/* Desktop menu */}
                    <div className="hidden md:flex items-center space-x-8">
                        <a href="#features" className="font-semibold text-secondary hover:text-primary transition-colors">Fonctionnalités</a>
                        <a href="#partner" className="font-semibold text-secondary hover:text-primary transition-colors">Programme Partenaire</a>
                        <Link to="/login" className="font-semibold text-primary hover:text-accent transition-colors">Connexion</Link>
                        <Link to="/register" className="btn-primary px-6 py-2.5 shadow-md shadow-accent/20 hover:-translate-y-0.5 transition-transform">
                            Essai Gratuit
                        </Link>
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden flex items-center">
                        <button 
                            onClick={() => setIsOpen(!isOpen)} 
                            className="text-primary hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none p-2 rounded-xl transition-colors"
                        >
                            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden border-t border-slate-100 dark:border-border-theme bg-white dark:bg-panel shadow-xl overflow-hidden"
                    >
                        <div className="px-4 pt-4 pb-6 space-y-2 sm:px-6">
                            <a href="#features" onClick={() => setIsOpen(false)} className="block px-4 py-3 font-semibold text-secondary hover:text-primary hover:bg-surface rounded-xl transition-colors">Fonctionnalités</a>
                            <a href="#partner" onClick={() => setIsOpen(false)} className="block px-4 py-3 font-semibold text-secondary hover:text-primary hover:bg-surface rounded-xl transition-colors">Programme Partenaire</a>
                            <Link to="/login" onClick={() => setIsOpen(false)} className="block px-4 py-3 font-semibold text-secondary hover:text-primary hover:bg-surface rounded-xl transition-colors">Connexion</Link>
                            <div className="pt-2">
                                <Link to="/register" onClick={() => setIsOpen(false)} className="block w-full text-center btn-primary py-4 rounded-xl font-bold shadow-md shadow-accent/20">
                                    Essai Gratuit
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.nav>
    );
};
