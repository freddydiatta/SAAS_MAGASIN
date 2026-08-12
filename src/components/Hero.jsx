import { useState, useEffect } from 'react';

export const Hero = () => {
    const [balance, setBalance] = useState(125000);
    const [transactions, setTransactions] = useState([
        { id: 2, title: "Location Villa (Avance)", price: "100 000", time: "09:30", icon: "🏠", color: "bg-blue-100" },
        { id: 3, title: "Huile Moteur 4T", price: "4 000", time: "Hier", icon: "🛢️", color: "bg-green-100" },
        { id: 4, title: "Casque Intégral", price: "35 000", time: "Hier", icon: "⛑️", color: "bg-red-100" }
    ]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setTransactions(prev => [
                { id: 1, title: "Pneu Moto 120/70", price: "25 000", time: "À l'instant", icon: "🏍️", color: "bg-orange-100", highlight: true },
                ...prev
            ]);
            setBalance(150000);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden bg-primary text-white">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-accent opacity-20 blur-3xl animate-[pulse_4s_ease-in-out_infinite]"></div>
                <div className="absolute top-40 -left-40 w-96 h-96 rounded-full bg-blue-500 opacity-20 blur-3xl animate-[pulse_6s_ease-in-out_infinite]"></div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="flex flex-col items-center justify-center pt-4 pb-12">
                    <div className="text-center fade-in-up max-w-4xl mx-auto mb-16">
                        <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold leading-tight mb-6">
                            Gérez tout votre business <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-yellow-300">au même endroit, simplement.</span>
                        </h1>
                        <p className="text-lg md:text-xl text-blue-100 mb-10 max-w-3xl mx-auto leading-relaxed">
                            Vente de motos, pièces détachées, ou location de villas : abandonnez les carnets de notes. Suivez vos ventes et vos stocks directement.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button className="bg-accent hover:bg-accentHover text-white px-10 py-5 rounded-full font-bold text-xl transition-all transform hover:scale-105 shadow-lg shadow-accent/40 flex items-center justify-center gap-2 group">
                                Démarrer mon mois gratuit
                                <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                            </button>
                        </div>
                    </div>

                    <div className="relative mx-auto w-full max-w-6xl fade-in-up delay-200 group px-2 sm:px-0">
                        <img src="./asset/section_hero.png" alt="Aperçu de l'application GestionPro" className="w-full h-auto object-contain drop-shadow-2xl rounded-2xl transition-transform duration-500 group-hover:scale-[1.01]" />
                    </div>
                </div>
            </div>

            <div className="absolute bottom-0 w-full leading-[0]">
                <svg className="block w-full h-[60px] lg:h-[100px]" viewBox="0 0 1200 120" preserveAspectRatio="none">
                    <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C59.71,118,137.47,117.81,200.7,96.33,243.68,81.72,284.5,70.1,321.39,56.44Z" fill="#F8FAFC"></path>
                </svg>
            </div>
        </section>
    );
};
