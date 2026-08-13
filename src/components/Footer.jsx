import { Globe, MessageCircle, Share2, ArrowRight, Mail, Phone, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer = ({ onContactClick }) => {
    return (
        <footer className="bg-slate-950 pt-24 pb-8 border-t border-white/5 text-slate-300 relative overflow-hidden">
            {/* Decoration */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent"></div>
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
                    
                    {/* Brand */}
                    <div className="lg:col-span-4">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-[#e66c4a] flex items-center justify-center shadow-lg shadow-accent/20">
                                <span className="text-white font-black text-xl tracking-tighter">G</span>
                            </div>
                            <span className="font-black text-2xl text-white tracking-tight">Gestion<span className="text-accent">Pro</span></span>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm">
                            L'outil de gestion nouvelle génération pensé pour les réalités de votre commerce au Sénégal. Simple, robuste, et redoutablement efficace.
                        </p>
                        <div className="flex items-center gap-4">
                            {[Globe, MessageCircle, Share2].map((Icon, i) => (
                                <a key={i} href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-accent hover:text-white hover:border-accent transition-all">
                                    <Icon className="w-4 h-4" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Links */}
                    <div className="lg:col-span-2">
                        <h4 className="font-bold text-white mb-6 text-sm uppercase tracking-wider">Produit</h4>
                        <ul className="space-y-4">
                            <li><a href="#features" className="text-slate-400 hover:text-accent transition-colors text-sm font-medium">Fonctionnalités</a></li>
                            <li><a href="#pricing" className="text-slate-400 hover:text-accent transition-colors text-sm font-medium">Tarifs</a></li>
                            <li><a href="#partner" className="text-slate-400 hover:text-accent transition-colors text-sm font-medium">Programme Partenaire</a></li>
                        </ul>
                    </div>

                    <div className="lg:col-span-2">
                        <h4 className="font-bold text-white mb-6 text-sm uppercase tracking-wider">Légal</h4>
                        <ul className="space-y-4">
                            <li><a href="#" className="text-slate-400 hover:text-accent transition-colors text-sm font-medium">Conditions d'utilisation</a></li>
                            <li><a href="#" className="text-slate-400 hover:text-accent transition-colors text-sm font-medium">Confidentialité</a></li>
                            <li><a href="#" className="text-slate-400 hover:text-accent transition-colors text-sm font-medium">Mentions légales</a></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="lg:col-span-4">
                        <h4 className="font-bold text-white mb-6 text-sm uppercase tracking-wider">Contact</h4>
                        <ul className="space-y-5">
                            <li className="flex items-start gap-4 text-slate-400 text-sm">
                                <div className="mt-0.5 text-accent"><MapPin className="w-5 h-5" /></div>
                                <span>Dakar, Sénégal<br/>Ouakam, Cité Comico</span>
                            </li>
                            <li className="flex items-center gap-4 text-slate-400 text-sm">
                                <div className="text-accent"><Phone className="w-5 h-5" /></div>
                                <span className="font-medium">+221 76 846 57 86</span>
                            </li>
                            <li className="flex items-center gap-4 text-slate-400 text-sm">
                                <div className="text-accent"><Mail className="w-5 h-5" /></div>
                                <a href="mailto:contact@gestionpro.sn" className="hover:text-accent transition-colors">contact@gestionpro.sn</a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* CTA Card */}
                <div className="bg-gradient-to-r from-accent to-[#e66c4a] rounded-[2rem] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 mb-12 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div className="relative z-10 max-w-lg text-center md:text-left">
                        <h4 className="font-black text-white text-2xl md:text-3xl mb-3 tracking-tight">Prêt à digitaliser votre commerce ?</h4>
                        <p className="text-white/80 font-medium text-lg">Rejoignez des centaines de commerçants qui ont déjà franchi le pas avec succès.</p>
                    </div>
                    <Link to="/register" className="relative z-10 bg-white text-primary px-8 py-4 rounded-xl font-black transition-all hover:scale-105 hover:shadow-xl flex items-center gap-2 whitespace-nowrap">
                        Démarrer gratuitement
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>

                {/* Bottom */}
                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-slate-500 text-sm font-medium">
                        &copy; {new Date().getFullYear()} GestionPro. Tous droits réservés.
                    </p>
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                        Fait avec <span className="text-red-500 text-lg">♥</span> au Sénégal
                    </div>
                </div>
            </div>
        </footer>
    );
};
