'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from './EnhancedCartProvider';
import { useAuth } from './AuthProvider';
import AuthModal from './AuthModal';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const { itemCount } = useCart();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  const openAuthModal = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  return (
    <>
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center">
              <Image
                src="/images/full-logo.jfif"
                alt="Groceree"
                width={200}
                height={75}
                className="h-16 w-auto object-contain"
                priority
              />
            </Link>

            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                Home
              </Link>
              <Link href="/products" className="text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                Products
              </Link>
              <Link href="/about" className="text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                About
              </Link>
              <Link href="/contact" className="text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                Contact
              </Link>
              {user && user.role === 'admin' && (
                <Link href="/admin" className="text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                  Admin
                </Link>
              )}
              {user && user.role === 'driver' && (
                <Link href="/driver" className="text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                  Driver
                </Link>
              )}
              {user && user.role === 'customer' && (
                <Link href="/orders" className="text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                  Orders
                </Link>
              )}
            </nav>

            <div className="flex items-center space-x-4">
              <Link href="/cart" className="relative p-2 text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className="ri-shopping-cart-line text-xl"></i>
                </div>
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </Link>

              {user ? (
                <div className="relative group">
                  <button className="flex items-center space-x-2 p-2 text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                    <div className="w-6 h-6 flex items-center justify-center">
                      <i className="ri-user-line text-xl"></i>
                    </div>
                    <span className="hidden md:block text-sm">{user.first_name}</span>
                  </button>

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="py-2">
                      <div className="px-4 py-2 text-sm text-gray-600 border-b border-gray-200">
                        {user.email}
                      </div>
                      <Link href="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                        My Profile
                      </Link>
                      <Link href="/orders" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                        Order History
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openAuthModal('signin')}
                    className="text-gray-700 hover:text-green-600 transition-colors cursor-pointer text-sm"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => openAuthModal('signup')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap text-sm"
                  >
                    Sign Up
                  </button>
                </div>
              )}

              <button 
                className="md:hidden p-2 text-gray-700 hover:text-green-600 transition-colors cursor-pointer"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className={`ri-${isMenuOpen ? 'close' : 'menu'}-line text-xl`}></i>
                </div>
              </button>
            </div>
          </div>

          {isMenuOpen && (
            <div className="md:hidden">
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                <Link href="/" className="block px-3 py-2 text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                  Home
                </Link>
                <Link href="/products" className="block px-3 py-2 text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                  Products
                </Link>
                <Link href="/about" className="block px-3 py-2 text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                  About
                </Link>
                <Link href="/contact" className="block px-3 py-2 text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                  Contact
                </Link>
                {user && user.role === 'admin' && (
                  <Link href="/admin" className="block px-3 py-2 text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                    Admin
                  </Link>
                )}
                {user && user.role === 'driver' && (
                  <Link href="/driver" className="block px-3 py-2 text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                    Driver
                  </Link>
                )}
                {user && user.role === 'customer' && (
                  <Link href="/orders" className="block px-3 py-2 text-gray-700 hover:text-green-600 transition-colors cursor-pointer">
                    Orders
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode={authMode}
      />
    </>
  );
}
