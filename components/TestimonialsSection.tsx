'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase, SUPABASE_CONFIGURED } from '../lib/auth';

export default function TestimonialsSection() {
  const [cutoffTime, setCutoffTime] = useState('2PM');

  useEffect(() => {
    const loadCutoffTime = async () => {
      if (!SUPABASE_CONFIGURED) {
        console.warn('Supabase not configured; skipping cutoff time load.');
        return;
      }
      try {
        const { data, error } = await supabase
          .from('delivery_settings')
          .select('cutoff_time')
          .single();

        if (error) {
          console.error('Supabase error loading cutoff time:', JSON.stringify(error));
          return;
        }

        if (data && data.cutoff_time) {
          const [hour, minute] = data.cutoff_time.split(':').map(Number);
          const period = hour >= 12 ? 'PM' : 'AM';
          const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
          const formattedTime = minute === 0 ? `${displayHour}${period}` : `${displayHour}:${minute.toString().padStart(2, '0')}${period}`;
          setCutoffTime(formattedTime);
        }
      } catch (err) {
        console.error('Error loading cutoff time:', err);
      }
    };

    loadCutoffTime();
  }, []);

  const testimonials = [
    {
      name: 'Sarah Johnson',
      location: 'West End, Vancouver',
      rating: 5,
      text: 'Groceree has been a game-changer for our family! Fresh produce delivered right to our door, and the quality is always amazing.',
      avatar: 'https://readdy.ai/api/search-image?query=Professional%20headshot%20of%20happy%20middle-aged%20woman%20with%20brown%20hair%20smiling%20warmly%2C%20clean%20white%20background%2C%20portrait%20photography%20style%2C%20friendly%20expression&width=80&height=80&seq=sarah-avatar&orientation=squarish'
    },
    {
      name: 'Michael Chen',
      location: 'Kitsilano, Vancouver',
      rating: 5,
      text: 'The convenience is unmatched. I can order groceries during my lunch break and have them delivered before dinner. Highly recommend!',
      avatar: 'https://readdy.ai/api/search-image?query=Professional%20headshot%20of%20young%20Asian%20businessman%20in%20casual%20shirt%20smiling%20confidently%2C%20clean%20white%20background%2C%20portrait%20photography%20style%2C%20professional%20look&width=80&height=80&seq=michael-avatar&orientation=squarish'
    },
    {
      name: 'Emily Rodriguez',
      location: 'Commercial Drive, Vancouver',
      rating: 5,
      text: 'As a busy mom, Groceree saves me so much time. The organic selection is fantastic and my kids love the fresh fruit quality.',
      avatar: 'https://readdy.ai/api/search-image?query=Professional%20headshot%20of%20young%20Hispanic%20woman%20with%20dark%20hair%20smiling%20warmly%2C%20clean%20white%20background%2C%20portrait%20photography%20style%2C%20motherly%20expression&width=80&height=80&seq=emily-avatar&orientation=squarish'
    }
  ];

  const trustBadges = [
    { icon: 'ri-secure-payment-line', title: 'Secure Payment', desc: 'SSL encrypted checkout' },
    { icon: 'ri-truck-line', title: 'Same Day Delivery', desc: `Order by ${cutoffTime}` },
    { icon: 'ri-shield-check-line', title: 'Quality Guarantee', desc: '100% fresh promise' },
    { icon: 'ri-customer-service-2-line', title: '24/7 Support', desc: 'We\'re here to help' }
  ];

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Trusted by Vancouver Families
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Join thousands of satisfied customers who choose Groceree for their grocery needs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
              <div className="flex items-center mb-4">
                <Image
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover object-top mr-4"
                />
                <div>
                  <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                  <p className="text-sm text-gray-600">{testimonial.location}</p>
                </div>
              </div>

              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <div key={i} className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-star-fill text-yellow-400"></i>
                  </div>
                ))}
              </div>

              <p className="text-gray-700 leading-relaxed">{testimonial.text}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {trustBadges.map((badge, index) => (
            <div key={index} className="text-center p-6 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="w-12 h-12 flex items-center justify-center mx-auto mb-4 bg-green-100 rounded-full">
                <i className={`${badge.icon} text-2xl text-green-600`}></i>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{badge.title}</h4>
              <p className="text-sm text-gray-600">{badge.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
