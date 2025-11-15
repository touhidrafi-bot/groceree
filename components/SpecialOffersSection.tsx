'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function SpecialOffersSection() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const offers = [
    {
      title: '50% Off Organic Fruits',
      description: 'Fresh organic apples, oranges, and berries',
      originalPrice: '$24.99',
      salePrice: '$12.49',
      image: 'https://readdy.ai/api/search-image?query=Special%20sale%20banner%20featuring%20fresh%20organic%20fruits%20with%20discount%20tags%2C%20bright%20colorful%20display%20of%20apples%20oranges%20berries%20in%20shopping%20baskets%2C%20promotional%20style%20with%20clean%20white%20background%20and%20vibrant%20colors&width=400&height=300&seq=fruit-offer&orientation=landscape',
      validUntil: 'Valid until Sunday'
    },
    {
      title: 'Buy 2 Get 1 Free',
      description: 'All dairy products including milk and cheese',
      originalPrice: '$18.99',
      salePrice: 'Buy 2 Get 1',
      image: 'https://readdy.ai/api/search-image?query=Dairy%20products%20promotional%20display%20with%20milk%20bottles%20cheese%20yogurt%20arranged%20for%20buy%202%20get%201%20free%20offer%2C%20clean%20modern%20grocery%20setting%20with%20promotional%20tags%20and%20bright%20lighting&width=400&height=300&seq=dairy-offer&orientation=landscape',
      validUntil: 'Valid this week'
    },
    {
      title: 'Fresh Vegetable Bundle',
      description: 'Mixed seasonal vegetables - perfect for families',
      originalPrice: '$19.99',
      salePrice: '$14.99',
      image: 'https://readdy.ai/api/search-image?query=Fresh%20vegetable%20bundle%20featuring%20seasonal%20vegetables%20like%20carrots%20broccoli%20lettuce%20tomatoes%20arranged%20in%20promotional%20display%20with%20sale%20tags%2C%20clean%20grocery%20store%20aesthetic&width=400&height=300&seq=veggie-bundle&orientation=landscape',
      validUntil: 'Limited time'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % offers.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [offers.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % offers.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + offers.length) % offers.length);
  };

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Weekly Deals</h2>
          <p className="text-xl text-gray-600">Don't miss out on these amazing offers</p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="overflow-hidden rounded-2xl shadow-lg">
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {offers.map((offer, index) => (
                <div key={index} className="w-full flex-shrink-0">
                  <div className="bg-white p-8 md:p-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                      <div>
                        <div className="inline-block bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold mb-4">
                          Special Offer
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                          {offer.title}
                        </h3>
                        <p className="text-gray-600 mb-6 text-lg">
                          {offer.description}
                        </p>
                        <div className="flex items-center space-x-4 mb-6">
                          <span className="text-3xl font-bold text-green-600">
                            {offer.salePrice}
                          </span>
                          <span className="text-xl text-gray-400 line-through">
                            {offer.originalPrice}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">
                          {offer.validUntil}
                        </p>
                        <Link 
                          href="/products"
                          className="bg-orange-500 text-white px-8 py-3 rounded-full font-semibold hover:bg-orange-600 transition-colors cursor-pointer whitespace-nowrap inline-block"
                        >
                          Shop This Deal
                        </Link>
                      </div>
                      <div className="relative w-full h-64 md:h-80 overflow-hidden rounded-xl">
                        <Image
                          src={offer.image}
                          alt={offer.title}
                          fill
                          className="object-cover object-top"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/90 backdrop-blur-sm text-gray-800 p-3 rounded-full shadow-lg hover:bg-white transition-all cursor-pointer"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-arrow-left-line text-xl"></i>
            </div>
          </button>

          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/90 backdrop-blur-sm text-gray-800 p-3 rounded-full shadow-lg hover:bg-white transition-all cursor-pointer"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-arrow-right-line text-xl"></i>
            </div>
          </button>

          <div className="flex justify-center space-x-2 mt-6">
            {offers.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-colors cursor-pointer ${
                  index === currentSlide ? 'bg-green-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
