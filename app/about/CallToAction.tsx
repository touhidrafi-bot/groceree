
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CallToAction() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const element = document.getElementById('cta-section');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      id="cta-section"
      className="py-20 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #34c759 0%, #28a745 100%)'
      }}
    >
      <div className="absolute inset-0 bg-white/10"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className={`text-center max-w-4xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="mb-8">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-rocket-line text-4xl text-white"></i>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              We're Just Getting Started — Join the Groceree Journey!
            </h2>
          </div>
          
          <p className="text-xl md:text-2xl text-white/90 mb-12 leading-relaxed">
            We may be new, but our passion is strong. Together, we can build a grocery experience 
            that's faster, fairer, and fresher for everyone.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link 
              href="/products" 
              className="bg-white text-green-600 px-10 py-4 rounded-full font-bold text-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-xl cursor-pointer whitespace-nowrap"
            >
              Start Shopping
            </Link>
            <Link 
              href="/contact" 
              className="border-2 border-white text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-white hover:text-green-600 transition-all duration-300 transform hover:scale-105 cursor-pointer whitespace-nowrap"
            >
              Contact Us
            </Link>
          </div>
          
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">Fresh</div>
              <div className="text-white/80">Quality Guaranteed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">Fast</div>
              <div className="text-white/80">Same-Day Delivery</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">Fair</div>
              <div className="text-white/80">Honest Pricing</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white/10 to-transparent"></div>
    </section>
  );
}
