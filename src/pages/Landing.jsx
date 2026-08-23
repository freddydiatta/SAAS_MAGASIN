import React from 'react';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { ProblemSolution } from '../components/ProblemSolution';
import { Features } from '../components/Features';
import { Pricing } from '../components/Pricing';
import { PartnerProgram } from '../components/PartnerProgram';
import { FAQContact } from '../components/FAQContact';
import { Footer } from '../components/Footer';

export function Landing() {
    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Navbar />
            <main className="flex-grow">
                <Hero />
                <ProblemSolution />
                <Features />
                <Pricing />
                <PartnerProgram />
                <FAQContact />
            </main>
            <Footer />
        </div>
    );
}
