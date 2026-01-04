'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface WeeklyDeal {
  id: string;
  title: string;
  description: string;
  original_price: number;
  sale_price: number;
  tag: string;
  image_url: string;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
}

export default function SpecialOffersSection() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [offers, setOffers] = useState<WeeklyDeal[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch deals from API
  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn('Weekly deals request timing out after 30 seconds');
          controller.abort();
        }, 30000); // 30 second timeout

        try {
          console.log('Fetching weekly deals from /api/weekly-deals...');
          const response = await fetch('/api/weekly-deals', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          console.log(`API response status: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            console.error(`HTTP ${response.status}: ${response.statusText}`);
            // Even if response isn't ok, try to parse JSON in case there's error info
            try {
              const errorData = await response.json();
              console.error('API error response:', errorData);
            } catch {
              console.error('Could not parse error response');
            }
            // Continue to loading false to show no deals message
            setLoading(false);
            return;
          }

          const data = await response.json();
          console.log('Successfully fetched weekly deals:', data);

          if (data.error) {
            console.error('API returned error:', data.error);
          }

          if (data.deals && data.deals.length > 0) {
            console.log(`Loaded ${data.deals.length} weekly deals`);
            setOffers(data.deals);
          } else {
            console.info('No weekly deals available');
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);

          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            console.error('Weekly deals request timed out after 30 seconds');
          } else {
            const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
            console.error('Error fetching weekly deals:', errorMessage);
            console.error('Error type:', fetchError instanceof Error ? fetchError.constructor.name : typeof fetchError);
          }
          // Show empty state gracefully
        } finally {
          setLoading(false);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Unexpected error in weekly deals fetch:', errorMessage);
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  // Auto-rotate slides
  useEffect(() => {
    if (offers.length === 0) return;

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

  // Format date display
  const getDateDisplay = (validFrom: string, validTo: string): string => {
    const today = new Date().toISOString().split('T')[0];
    const toDate = new Date(validTo);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (validTo === today) {
      return 'Ends today';
    } else if (validTo === tomorrow.toISOString().split('T')[0]) {
      return 'Ends tomorrow';
    }

    const daysLeft = Math.ceil((toDate.getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    return `${daysLeft} days left`;
  };

  if (loading) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Weekly Deals</h2>
            <p className="text-xl text-gray-600">Don't miss out on these amazing offers</p>
          </div>
          <div className="relative max-w-4xl mx-auto">
            <div className="overflow-hidden rounded-2xl shadow-lg bg-white">
              <div className="h-80 animate-pulse flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading special offers...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (offers.length === 0) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Weekly Deals</h2>
            <p className="text-xl text-gray-600">Don't miss out on these amazing offers</p>
          </div>
          <div className="relative max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <i className="ri-gift-line text-5xl text-gray-300 mb-4 inline-block"></i>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No deals available right now</h3>
              <p className="text-gray-600 mb-6">Check back soon for amazing offers!</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

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
              {offers.map((offer) => (
                <div key={offer.id} className="w-full flex-shrink-0">
                  <div className="bg-white p-8 md:p-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                      <div>
                        <div className="inline-block bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold mb-4">
                          {offer.tag}
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                          {offer.title}
                        </h3>
                        <p className="text-gray-600 mb-6 text-lg">
                          {offer.description}
                        </p>
                        <div className="flex items-center space-x-4 mb-6">
                          <span className="text-3xl font-bold text-green-600">
                            ${offer.sale_price.toFixed(2)}
                          </span>
                          <span className="text-xl text-gray-400 line-through">
                            ${offer.original_price.toFixed(2)}
                          </span>
                          <span className="text-sm font-semibold text-red-600 bg-red-50 px-3 py-1 rounded">
                            {Math.round(((offer.original_price - offer.sale_price) / offer.original_price) * 100)}% OFF
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">
                          <i className="ri-time-line mr-2"></i>
                          Limited time - {getDateDisplay(offer.valid_from, offer.valid_to)}
                        </p>
                        <Link
                          href="/products"
                          className="bg-orange-500 text-white px-8 py-3 rounded-full font-semibold hover:bg-orange-600 transition-colors cursor-pointer whitespace-nowrap inline-block"
                        >
                          Shop This Deal
                        </Link>
                      </div>
                      {offer.image_url && (
                        <div className="relative w-full h-64 md:h-80 overflow-hidden rounded-xl bg-gray-100">
                          <Image
                            src={offer.image_url}
                            alt={offer.title}
                            fill
                            className="object-cover object-center"
                          />
                        </div>
                      )}
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
