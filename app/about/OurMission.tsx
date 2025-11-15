
'use client';

import { useEffect, useState } from 'react';

export default function OurMission() {
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

    const element = document.getElementById('mission-section');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const features = [
    {
      icon: 'ri-leaf-line',
      title: 'Fresh & Local Produce',
      description: 'Sourced from local farms and trusted suppliers for maximum freshness and quality.'
    },
    {
      icon: 'ri-money-dollar-circle-line',
      title: 'Affordable Everyday Essentials',
      description: 'Fair pricing on all your grocery needs without compromising on quality.'
    },
    {
      icon: 'ri-truck-line',
      title: 'Fast, Friendly Delivery',
      description: 'Quick and reliable delivery service that brings groceries right to your door.'
    }
  ];

  return (
    <section id="mission-section" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">Our Mission</h2>
          <div className="max-w-4xl mx-auto">
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
              Our mission is to make healthy and affordable groceries accessible for everyone. 
              Groceree was built to help reduce the cost of living by sourcing smarter, minimizing waste, 
              and supporting our local community. We believe everyone deserves fresh food without the high price tag.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div 
              key={index}
              className={`bg-gray-50 p-8 rounded-2xl text-center shadow-lg hover:shadow-xl transition-all duration-500 transform hover:-translate-y-2 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${index * 200}ms` }}
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className={`${feature.icon} text-3xl text-green-600`}></i>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
