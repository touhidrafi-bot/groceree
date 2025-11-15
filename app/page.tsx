
'use client';

import HeroSection from '../components/HeroSection';
import CategoriesSection from '../components/CategoriesSection';
import SpecialOffersSection from '../components/SpecialOffersSection';
import TestimonialsSection from '../components/TestimonialsSection';

export default function Home() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <CategoriesSection />
      <SpecialOffersSection />
      <TestimonialsSection />
    </div>
  );
}
