'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function HeroSection() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <section 
      className="relative min-h-[600px] flex items-center bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url('/images/hero-background.jpg')`
      }}
    >
      <div className="container mx-auto px-4 w-full">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Fresh groceries, delivered to your door
          </h1>
          <p className="text-xl text-white/90 mb-8 leading-relaxed">
            Quality produce and everyday essentials delivered fresh to Vancouver families. Shop local, eat fresh, live better.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <Link href="/products" className="bg-green-600 text-white px-8 py-4 rounded-full font-semibold hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap text-center">
              Shop Now
            </Link>
            <Link href="/products" className="bg-orange-500 text-white px-8 py-4 rounded-full font-semibold hover:bg-orange-600 transition-colors cursor-pointer whitespace-nowrap text-center">
              Browse Categories
            </Link>
          </div>

          <form onSubmit={handleSearch} className="relative max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product or category..."
              className="w-full px-6 py-4 rounded-full border-0 shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm pr-16"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-green-600 text-white p-3 rounded-full hover:bg-green-700 transition-colors cursor-pointer"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-search-line text-sm"></i>
              </div>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}