'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import WeeklyDealsForm from '@/components/admin/WeeklyDealsForm';
import { supabase, SUPABASE_CONFIGURED } from '@/lib/auth';

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
  created_at: string;
}

export default function WeeklyDealsAdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [deals, setDeals] = useState<WeeklyDeal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState<WeeklyDeal | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // --------------------------------------------------------------
  // Authorize Admin
  // --------------------------------------------------------------
  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [loading, user]);

  // --------------------------------------------------------------
  // Fetch Deals
  // --------------------------------------------------------------
  const fetchDeals = async () => {
    try {
      if (!SUPABASE_CONFIGURED) throw new Error('Supabase not configured');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      const { data, error } = await supabase
        .from('weekly_deals')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) setDeals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDeals(false);
    }
  };

  useEffect(() => {
    if (!loading && user?.role === 'admin') fetchDeals();
  }, [loading, user]);

  // --------------------------------------------------------------
  // Toggle Active
  // --------------------------------------------------------------
  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('weekly_deals')
      .update({ is_active: !isActive })
      .eq('id', id);

    if (!error) {
      setDeals(prev =>
        prev.map(d => d.id === id ? { ...d, is_active: !isActive } : d)
      );
    }
  };

  // --------------------------------------------------------------
  // Delete Deal
  // --------------------------------------------------------------
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('weekly_deals').delete().eq('id', id);

    if (!error) {
      setDeals(prev => prev.filter(d => d.id !== id));
      setDeleteConfirm(null);
    }
  };

  // --------------------------------------------------------------
  // Close Form
  // --------------------------------------------------------------
  const handleFormClose = (saved: boolean) => {
    setShowForm(false);
    setEditingDeal(null);
    if (saved) fetchDeals();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <div className="animate-spin h-10 w-10 border-b-2 border-green-600 rounded-full"></div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') return null;

  // --------------------------------------------------------------
  // UI Starts Here
  // --------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 pb-16 animate-fadeIn">
      <div className="container mx-auto px-4 py-10">

        {/* Page Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <Link
              href="/admin"
              className="text-green-600 hover:text-green-700 text-sm font-semibold inline-flex items-center gap-2"
            >
              <i className="ri-arrow-left-line"></i> Back to Admin
            </Link>

            <h1 className="text-4xl font-bold mt-3 text-gray-900">Weekly Deals</h1>
            <p className="text-gray-600 mt-1">Create & manage your special offers</p>
          </div>

          <button
            onClick={() => {
              setEditingDeal(null);
              setShowForm(true);
            }}
            className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition shadow-md flex items-center gap-2 font-semibold"
          >
            <i className="ri-add-line"></i> New Deal
          </button>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto p-4">
              <WeeklyDealsForm deal={editingDeal} onClose={handleFormClose} />
            </div>
          </div>
        )}

        {/* Loading State */}
        {loadingDeals ? (
          <div className="text-center py-20 text-gray-600">
            <div className="animate-spin h-12 w-12 border-b-2 border-green-600 rounded-full mx-auto mb-4"></div>
            Loading deals...
          </div>
        ) : deals.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-12 text-center border border-gray-200">
            <i className="ri-price-tag-3-line text-6xl text-gray-300 mb-4"></i>
            <h3 className="text-xl font-semibold text-gray-800">No Deals Yet</h3>
            <p className="text-gray-600 mt-1 mb-6">Create your first weekly promotion</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition shadow font-semibold"
            >
              Create New Deal
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {deals.map(deal => (
              <div
                key={deal.id}
                className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition p-6 group"
              >
                <div className="flex gap-6">

                  {/* Image */}
                  {deal.image_url && (
                    <div className="w-32 h-32 bg-gray-100 rounded-xl overflow-hidden shadow-sm">
                      <Image
                        src={deal.image_url}
                        alt={deal.title}
                        width={128}
                        height={128}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}

                  {/* Details */}
                  <div className="flex-1">

                    {/* Title & Active Toggle */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-2xl font-bold text-gray-900">{deal.title}</h3>

                          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                            {deal.tag}
                          </span>
                        </div>
                        <p className="text-gray-600 mt-1">{deal.description}</p>
                      </div>

                      <button
                        onClick={() => handleToggleActive(deal.id, deal.is_active)}
                        className={`px-4 py-2 rounded-xl font-semibold transition shadow text-sm
                          ${deal.is_active
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                      >
                        {deal.is_active ? "Active" : "Inactive"}
                      </button>
                    </div>

                    {/* Prices */}
                    <div className="flex gap-10 mt-6">
                      <div>
                        <p className="text-xs text-gray-500">Original</p>
                        <p className="text-xl font-bold text-gray-800">
                          ${deal.original_price.toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Sale Price</p>
                        <p className="text-xl font-bold text-green-600">
                          ${deal.sale_price.toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Discount</p>
                        <p className="text-xl font-bold text-blue-600">
                          {Math.round(((deal.original_price - deal.sale_price) / deal.original_price) * 100)}%
                        </p>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="flex gap-10 text-sm text-gray-600 mt-6">
                      <div className="flex items-center gap-2">
                        <i className="ri-calendar-line"></i>
                        <span>
                          <span className="font-semibold text-gray-900">From:</span> {deal.valid_from}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <i className="ri-calendar-line"></i>
                        <span>
                          <span className="font-semibold text-gray-900">To:</span> {deal.valid_to}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-6">
                      <button
                        onClick={() => {
                          setEditingDeal(deal);
                          setShowForm(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow flex items-center gap-1 font-semibold"
                      >
                        <i className="ri-edit-line"></i> Edit
                      </button>

                      <button
                        onClick={() => setDeleteConfirm(deal.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition shadow flex items-center gap-1 font-semibold"
                      >
                        <i className="ri-delete-bin-line"></i> Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Delete Confirm */}
                {deleteConfirm === deal.id && (
                  <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
                    <p className="text-red-700 font-semibold">Are you sure?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(deal.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
