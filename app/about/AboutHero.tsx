
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AboutHero() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section 
      className="relative min-h-[70vh] flex items-center bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `linear-gradient(rgba(52, 199, 89, 0.1), rgba(52, 199, 89, 0.2)), url('https://readdy.ai/api/search-image?query=Fresh%20organic%20vegetables%20and%20fruits%20being%20delivered%20by%20a%20friendly%20delivery%20person%20to%20a%20modern%20Vancouver%20home%2C%20bright%20natural%20lighting%2C%20professional%20photography%20style%2C%20clean%20white%20background%20with%20green%20accents%2C%20warm%20and%20welcoming%20atmosphere%2C%20delivery%20bags%20filled%20with%20colorful%20produce&width=1920&height=800&seq=about-hero&orientation=landscape')`
      }}
    >
      <div className="container mx-auto px-4 w-full">
        <div className={`max-w-3xl transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center gap-4 mb-6">
            <h1 className="text-5xl md:text-7xl font-bold text-gray-800 leading-tight">
              We Bring Groceries to Life.
            </h1>
            <div className="w-16 h-16 flex items-center justify-center animate-bounce">
              <i className="ri-shopping-cart-2-line text-4xl text-green-600"></i>
            </div>
          </div>
          
          <p className="text-xl md:text-2xl text-gray-700 mb-8 leading-relaxed font-medium">
            At Groceree, we're redefining convenience with fresh, affordable groceries delivered to your door.
          </p>
          
          <Link 
            href="/products" 
            className="inline-block bg-green-600 text-white px-10 py-4 rounded-full font-semibold text-lg hover:bg-green-700 transition-all duration-300 transform hover:scale-105 shadow-lg cursor-pointer whitespace-nowrap"
          >
            Shop Now
          </Link>
        </div>
      </div>
    </section>
  );
}
