
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setSubmitMessage('Please enter your email address');
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      const formData = new URLSearchParams();
      formData.append('email', email);

      const response = await fetch('https://readdy.ai/api/form/d3mvvuitokgsj2i80rsg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (response.ok) {
        setSubmitMessage('Successfully subscribed to newsletter!');
        setEmail('');
      } else {
        setSubmitMessage('Failed to subscribe. Please try again.');
      }
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      setSubmitMessage('Failed to subscribe. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="bg-gray-50 border-t border-gray-100">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <Image
              src="/images/full-logo.jfif"
              alt="Groceree"
              width={180}
              height={68}
              className="h-14 w-auto object-contain mb-4"
            />
            <p className="text-gray-600 mb-4">Fresh groceries delivered to your door in Vancouver, BC</p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-green-600 transition-colors cursor-pointer">
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className="ri-facebook-fill text-xl"></i>
                </div>
              </a>
              <a href="#" className="text-gray-400 hover:text-green-600 transition-colors cursor-pointer">
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className="ri-instagram-fill text-xl"></i>
                </div>
              </a>
              <a href="#" className="text-gray-400 hover:text-green-600 transition-colors cursor-pointer">
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className="ri-twitter-fill text-xl"></i>
                </div>
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-gray-600 hover:text-green-600 transition-colors cursor-pointer">About Us</Link></li>
              <li><Link href="/contact" className="text-gray-600 hover:text-green-600 transition-colors cursor-pointer">Contact</Link></li>
              <li><Link href="/faq" className="text-gray-600 hover:text-green-600 transition-colors cursor-pointer">FAQ</Link></li>
              <li><Link href="/delivery" className="text-gray-600 hover:text-green-600 transition-colors cursor-pointer">Delivery Info</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Categories</h3>
            <ul className="space-y-2">
              <li><Link href="/products?category=fruits" className="text-gray-600 hover:text-green-600 transition-colors cursor-pointer">Fruits</Link></li>
              <li><Link href="/products?category=vegetables" className="text-gray-600 hover:text-green-600 transition-colors cursor-pointer">Vegetables</Link></li>
              <li><Link href="/products?category=dairy" className="text-gray-600 hover:text-green-600 transition-colors cursor-pointer">Dairy</Link></li>
              <li><Link href="/products?category=meat" className="text-gray-600 hover:text-green-600 transition-colors cursor-pointer">Meat</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Newsletter</h3>
            <p className="text-gray-600 mb-4">Get weekly deals and fresh produce updates</p>
            <form 
              onSubmit={handleNewsletterSubmit} 
              className="space-y-2"
              data-readdy-form="newsletter-subscription"
              id="newsletter-subscription-form"
            >
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                required
                disabled={isSubmitting}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Subscribing...' : 'Subscribe'}
              </button>
              {submitMessage && (
                <p className={`text-sm ${submitMessage.includes('Successfully') ? 'text-green-600' : 'text-red-600'}`}>
                  {submitMessage}
                </p>
              )}
            </form>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-gray-600 text-sm">
              © 2024 Groceree. All rights reserved.
            </div>
            <div className="flex space-x-6 text-sm">
              <Link href="/terms" className="text-gray-600 hover:text-green-600 transition-colors cursor-pointer">Terms of Service</Link>
              <Link href="/privacy" className="text-gray-600 hover:text-green-600 transition-colors cursor-pointer">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
