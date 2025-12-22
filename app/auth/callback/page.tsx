'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/auth';

export default function AuthCallback() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase automatically handles the callback when the component mounts
        // The session will be set via the auth state listener
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (session?.user) {
          // Email confirmed successfully
          setLoading(false);
          // Redirect to home or dashboard after a short delay
          setTimeout(() => {
            router.push('/');
          }, 1500);
        } else {
          // Still processing or error
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Auth callback error:', error);
        setError(error.message || 'Failed to confirm email');
        setLoading(false);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-sm p-8 w-full max-w-md">
        {loading ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Confirming your email...</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <i className="ri-error-warning-line text-4xl"></i>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Email Confirmation Failed</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <a
              href="/auth/reset-password"
              className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Request New Link
            </a>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-green-600 mb-4">
              <i className="ri-check-line text-4xl"></i>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Email Confirmed!</h1>
            <p className="text-gray-600">Redirecting you to the home page...</p>
          </div>
        )}
      </div>
    </div>
  );
}
