import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { ProblemSolution } from '../components/ProblemSolution';
import { Features } from '../components/Features';
import { Pricing } from '../components/Pricing';
import { PartnerProgram } from '../components/PartnerProgram';
import { Footer } from '../components/Footer';
import { ContactModal } from '../components/ContactModal';

export function Landing() {
    const [isContactOpen, setIsContactOpen] = useState(false);

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Navbar />
            <main className="flex-grow">
                <Hero />
                <ProblemSolution />
                <Features />
                <Pricing />
                <PartnerProgram />
            </main>
            <Footer onContactClick={() => setIsContactOpen(true)} />
            <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
        </div>
    );
}
