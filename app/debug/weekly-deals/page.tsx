'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function WeeklyDealsDebugPage() {
  const [status, setStatus] = useState<any>({
    supabaseUrl: '...',
    supabaseKey: '...',
    apiResponse: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    const diagnose = async () => {
      try {
        // Check environment variables
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        setStatus((prev: any) => ({
          ...prev,
          supabaseUrl: supabaseUrl ? '✓ Set' : '✗ Missing',
          supabaseKey: supabaseKey ? '✓ Set' : '✗ Missing',
        }));

        // Try to fetch from API
        const response = await fetch('/api/weekly-deals');
        const data = await response.json();

        setStatus((prev: any) => ({
          ...prev,
          apiResponse: data,
          error: null,
          loading: false,
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setStatus((prev: any) => ({
          ...prev,
          error: errorMessage,
          loading: false,
        }));
      }
    };

    diagnose();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <Link href="/admin" className="text-green-600 hover:text-green-700 text-sm font-semibold mb-4 inline-flex items-center gap-2">
          <i className="ri-arrow-left-line"></i>
          Back to Admin
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Weekly Deals Debug</h1>

          {/* Environment Variables */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Environment Variables</h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">NEXT_PUBLIC_SUPABASE_URL</span>
                <span className={`font-semibold ${status.supabaseUrl === '✓ Set' ? 'text-green-600' : 'text-red-600'}`}>
                  {status.supabaseUrl}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
                <span className={`font-semibold ${status.supabaseKey === '✓ Set' ? 'text-green-600' : 'text-red-600'}`}>
                  {status.supabaseKey}
                </span>
              </div>
            </div>
            {status.supabaseUrl === '✗ Missing' || status.supabaseKey === '✗ Missing' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                <p className="text-red-800 font-semibold mb-2">❌ Missing Environment Variables</p>
                <p className="text-red-700 text-sm">Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.</p>
              </div>
            )}
          </div>

          {/* API Response */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">API Response (/api/weekly-deals)</h2>
            {status.loading ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
                <p className="text-gray-600">Testing connection...</p>
              </div>
            ) : status.error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-semibold mb-2">❌ API Error</p>
                <pre className="text-red-700 text-sm bg-white p-3 rounded border border-red-200 overflow-auto">
                  {status.error}
                </pre>
              </div>
            ) : status.apiResponse?.error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-semibold mb-2">❌ API Error Response</p>
                <pre className="text-red-700 text-sm bg-white p-3 rounded border border-red-200 overflow-auto">
                  {status.apiResponse.error}
                </pre>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                  <p className="text-yellow-800 text-sm"><strong>Troubleshooting:</strong></p>
                  <ul className="list-disc list-inside text-yellow-700 text-sm mt-2 space-y-1">
                    <li>Check if the <code>weekly_deals</code> table exists in Supabase</li>
                    <li>Verify RLS policies are configured correctly</li>
                    <li>Check Supabase logs for permission errors</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-semibold mb-2">✅ API Connection Working</p>
                <div className="bg-white p-3 rounded border border-green-200 overflow-auto">
                  <p className="text-gray-700 text-sm">
                    <strong>Deals found:</strong> {status.apiResponse?.deals?.length || 0}
                  </p>
                  {status.apiResponse?.deals && status.apiResponse.deals.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {status.apiResponse.deals.map((deal: any, idx: number) => (
                        <div key={idx} className="text-sm bg-gray-50 p-2 rounded">
                          <strong>{deal.title}</strong> (Active: {deal.is_active ? 'Yes' : 'No'})
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-yellow-700 text-sm mt-2">
                      ⚠️ No deals found. Create one from the admin dashboard.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Checklist */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Setup Checklist</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <input type="checkbox" id="check1" className="mt-1" defaultChecked={status.supabaseUrl === '✓ Set'} disabled />
                <label htmlFor="check1" className="text-gray-700">Environment variables set</label>
              </div>
              <div className="flex items-start gap-3">
                <input type="checkbox" id="check2" className="mt-1" defaultChecked={!status.loading && !status.error} disabled />
                <label htmlFor="check2" className="text-gray-700">API endpoint responding</label>
              </div>
              <div className="flex items-start gap-3">
                <input type="checkbox" id="check3" className="mt-1" defaultChecked={status.apiResponse?.deals?.length > 0} disabled />
                <label htmlFor="check3" className="text-gray-700">Weekly deals table exists</label>
              </div>
              <div className="flex items-start gap-3">
                <input type="checkbox" id="check4" className="mt-1" disabled />
                <label htmlFor="check4" className="text-gray-700">At least one deal created</label>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Next Steps</h3>
            <ol className="list-decimal list-inside space-y-2 text-blue-800 text-sm">
              <li>If environment variables are missing, set them and restart the dev server</li>
              <li>If API is failing, check that the <code>weekly_deals</code> table exists in Supabase</li>
              <li>If no deals found, go to <Link href="/admin/weekly-deals" className="font-semibold underline">/admin/weekly-deals</Link> to create one</li>
              <li>Once everything shows ✓, the homepage carousel should display active deals</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
