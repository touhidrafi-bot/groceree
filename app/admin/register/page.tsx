
'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/auth';
import Link from 'next/link';

export default function AdminRegister() {
  const [formData, setFormData] = useState({
    adminCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const validateForm = () => {
    if (formData.adminCode !== 'GROCEREE_ADMIN_2024') {
      setError('Invalid admin registration code');
      return false;
    }

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            role: 'admin'
          }
        }
      });

      if (authError) {
        throw authError;
      }

      if (authData.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: formData.email,
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone || null,
            role: 'admin',
            password_hash: 'supabase_auth_managed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (profileError) {
          throw profileError;
        }

        // Submit form data to external endpoint
        await submitFormData();

        setSuccess('Admin account created successfully! Please check your email to verify your account.');
        setFormData({
          adminCode: '',
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          password: '',
          confirmPassword: ''
        });
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to create admin account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitFormData = async () => {
    setIsSubmitting(true);
    setSubmitStatus('Submitting form data...');

    try {
      // Prepare form data according to form-post-rule
      const formDataToSubmit = new URLSearchParams();
      formDataToSubmit.append('admin_code', formData.adminCode);
      formDataToSubmit.append('first_name', formData.firstName);
      formDataToSubmit.append('last_name', formData.lastName);
      formDataToSubmit.append('email', formData.email);
      formDataToSubmit.append('phone', formData.phone || '');
      formDataToSubmit.append('role', 'admin');
      formDataToSubmit.append('registration_date', new Date().toISOString());

      const response = await fetch('https://readdy.ai/api/form/d3i1v47uqofrij837kmg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formDataToSubmit.toString()
      });

      if (response.ok) {
        setSubmitStatus('Form data submitted successfully!');
      } else {
        setSubmitStatus('Form submitted to database, but external submission failed');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setSubmitStatus('Form submitted to database, but external submission failed');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmitStatus(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
            <div className="w-6 h-6 flex items-center justify-center">
              <i className="ri-shield-user-line text-green-600 text-xl"></i>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Admin Registration
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Create a secure admin account for Groceree
          </p>
        </div>

        {/* Security Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="w-5 h-5 flex items-center justify-center mr-3">
              <i className="ri-information-line text-blue-600"></i>
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-800">Security Requirements</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Valid admin registration code required</li>
                  <li>Password must be at least 8 characters</li>
                  <li>Email verification will be sent</li>
                  <li>Account will have full admin privileges</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <form 
          className="mt-8 space-y-6" 
          onSubmit={handleSubmit}
          data-readdy-form="admin-registration"
          id="admin-registration-form"
        >
          <div className="space-y-4">
            {/* Admin Code */}
            <div>
              <label htmlFor="adminCode" className="block text-sm font-medium text-gray-700">
                Admin Registration Code *
              </label>
              <input
                id="adminCode"
                name="adminCode"
                type="password"
                required
                value={formData.adminCode}
                onChange={handleInputChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="Enter admin registration code"
              />
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name *
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                  placeholder="First name"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name *
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                  placeholder="Last name"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="admin@groceree.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-5 00 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="(604) 555-0123"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500  text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="Minimum 8 characters"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-5  text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="Re-enter password"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <div className="w-5 h-5 flex items-center justify-center mr-3">
                  <i className="ri-error-warning-line text-red-600"></i>
                </div>
                <div className="text-sm text-red-700">{error}</div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex">
                <div className="w-5 h-5 flex items-center justify-center mr-3">
                  <i className="ri-check-line text-green-600"></i>
                </div>
                <div className="text-sm text-green-700">{success}</div>
              </div>
            </div>
          )}

          {/* Submit Status */}
          {submitStatus && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <div className="w-5 h-5 flex items-center justify-center mr-3">
                  {isSubmitting ? (
                    <i className="ri-loader-4-line text-blue-600 animate-spin"></i>
                  ) : (
                    <i className="ri-information-line text-blue-600"></i>
                  )}
                </div>
                <div className="text-sm text-blue-700">{submitStatus}</div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading || isSubmitting}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              {isLoading || isSubmitting ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 flex items-center justify-center mr-2">
                    <i className="ri-loader-4-line animate-spin"></i>
                  </div>
                  {isLoading ? 'Creating Account...' : 'Submitting Data...'}
                </div>
              ) : (
                <div className="flex items-center">
                  <div className="w-4 h-4 flex items-center justify-center mr-2">
                    <i className="ri-shield-check-line"></i>
                  </div>
                  Create Admin Account
                </div>
              )}
            </button>
          </div>

          {/* Back to Login */}
          <div className="text-center">
            <Link
              href="/admin"
              className="text-green-600 hover:text-green-500 text-sm font-medium cursor-pointer"
            >
              ← Back to Admin Login
            </Link>
          </div>
        </form>

        {/* Admin Permissions Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Admin Account Permissions</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <div className="flex items-center">
              <div className="w-3 h-3 flex items-center justify-center mr-2">
                <i className="ri-check-line text-green-600"></i>
              </div>
              Full dashboard access and analytics
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 flex items-center justify-center mr-2">
                <i className="ri-check-line text-green-600"></i>
              </div>
              Product management (add/edit/delete)
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 flex items-center justify-center mr-2">
                <i className="ri-check-line text-green-600"></i>
              </div>
              Order management and delivery assignment
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 flex items-center justify-center mr-2">
                <i className="ri-check-line text-green-600"></i>
              </div>
              User management (customers/drivers/admins)
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 flex items-center justify-center mr-2">
                <i className="ri-check-line text-green-600"></i>
              </div>
              Promo code and discount management
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
