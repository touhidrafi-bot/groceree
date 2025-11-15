
'use client';

import { useEffect, useState } from 'react';

export default function OurValues() {
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

    const element = document.getElementById('values-section');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const values = [
    {
      icon: 'ri-team-line',
      title: 'Community First',
      description: 'We aim to support local people and local stores, building stronger connections within our Vancouver community.',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      icon: 'ri-leaf-line',
      title: 'Sustainability',
      description: 'We reduce waste through efficient sourcing and eco-friendly delivery methods that protect our environment.',
      color: 'bg-green-100 text-green-600'
    },
    {
      icon: 'ri-lightbulb-line',
      title: 'Innovation',
      description: 'We continuously improve how people shop and receive their groceries through smart technology and service.',
      color: 'bg-purple-100 text-purple-600'
    },
    {
      icon: 'ri-shield-check-line',
      title: 'Integrity',
      description: 'We believe in fairness, honesty, and doing what\'s right — always. Your trust is our most valuable asset.',
      color: 'bg-orange-100 text-orange-600'
    }
  ];

  return (
    <section id="values-section" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">What We Stand For</h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Our values guide every decision we make and every service we provide. 
            They're not just words on a page — they're the foundation of who we are.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {values.map((value, index) => (
            <div 
              key={index}
              className={`bg-white p-8 rounded-2xl border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-500 transform hover:-translate-y-2 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div className={`w-16 h-16 ${value.color} rounded-2xl flex items-center justify-center mb-6`}>
                <i className={`${value.icon} text-3xl`}></i>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">{value.title}</h3>
              <p className="text-gray-600 leading-relaxed">{value.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
