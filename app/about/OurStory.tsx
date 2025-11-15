
'use client';

import { useEffect, useState } from 'react';

export default function OurStory() {
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

    const element = document.getElementById('story-section');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <section id="story-section" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
          <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-8">How Groceree Started</h2>
            <div className="space-y-6">
              <p className="text-lg text-gray-600 leading-relaxed">
                Groceree began with a small idea — to make grocery shopping easier for busy families and individuals. 
                We noticed how everyday essentials were becoming more expensive and time-consuming to find, especially 
                for people balancing work, school, and home life.
              </p>
              <p className="text-lg text-gray-600 leading-relaxed">
                That's when we decided to build a service focused on freshness, transparency, and fair pricing. 
                We're not just another delivery service — we're your neighbors who understand the challenges of 
                modern life and want to make it a little easier.
              </p>
              <div className="flex items-center gap-4 pt-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <i className="ri-heart-line text-2xl text-green-600"></i>
                </div>
                <p className="text-green-700 font-semibold">Built with love for the Vancouver community</p>
              </div>
            </div>
          </div>
          
          <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/images/delivery-banner.jpg"
                alt="Groceree delivery service in Vancouver"
                className="rounded-2xl shadow-2xl w-full h-auto object-cover"
              />
              <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-2xl shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <i className="ri-map-pin-line text-xl text-green-600"></i>
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">Vancouver, BC</p>
                    <p className="text-sm text-gray-600">Our home base</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
