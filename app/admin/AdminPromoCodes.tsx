'use client';

import { useEffect, useState } from 'react';
import { PromocodeService, PromoCode } from '../../lib/promo-code';
import { useAuth } from '../../components/AuthProvider';

export default function AdminPromoCodes() {
  const { user } = useAuth();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPromo, setSelectedPromo] = useState<PromoCode | null>(null);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageStats, setUsageStats] = useState<any>(null);

  const [formData, setFormData] = useState<PromoCode>({
    code: '',
    description: '',
    discount_type: 'fixed',
    discount_value: 0,
    min_order_amount: 0,
    max_uses: undefined,
    uses_per_user_limit: undefined,
    is_active: true,
    is_public: false,
    start_date: undefined,
    end_date: undefined
  });

  // Load promo codes on mount
  useEffect(() => {
    loadPromoCodes();
  }, [user?.id]);

  const loadPromoCodes = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📥 Loading promo codes for user:', user?.id);
      const codes = await PromocodeService.getAllPromoCodes(user?.id);
      console.log('✅ Loaded promo codes:', codes);
      setPromoCodes(codes);
    } catch (err: any) {
      console.error('❌ Error loading promo codes:', {
        message: err?.message,
        name: err?.name,
        fullError: JSON.stringify(err, null, 2)
      });
      const errorMessage = err?.message || JSON.stringify(err) || 'Failed to load promo codes';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (promo?: PromoCode) => {
    if (promo) {
      setFormData(promo);
      setEditingId(promo.id || null);
    } else {
      setFormData({
        code: '',
        description: '',
        discount_type: 'fixed',
        discount_value: 0,
        min_order_amount: 0,
        max_uses: undefined,
        uses_per_user_limit: undefined,
        is_active: true,
        is_public: false,
        start_date: undefined,
        end_date: undefined
      });
      setEditingId(null);
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => {
      let newValue: any = value;

      if (type === 'checkbox') {
        newValue = checked;
      } else if (name === 'discount_value' || name === 'min_order_amount') {
        newValue = value ? parseFloat(value) : 0;
      } else if (name === 'max_uses' || name === 'uses_per_user_limit') {
        newValue = value ? parseFloat(value) : undefined;
      } else if (name === 'start_date' || name === 'end_date') {
        newValue = value || undefined;
      }

      return {
        ...prev,
        [name]: newValue
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.code.trim()) {
      setError('Promo code is required');
      return;
    }
    if (formData.discount_value <= 0) {
      setError('Discount value must be greater than 0');
      return;
    }
    if (formData.discount_type === 'percentage' && formData.discount_value > 100) {
      setError('Percentage discount cannot exceed 100%');
      return;
    }

    try {
      console.log('📝 Submitting promo code form:', { editingId, formData });
      let result;
      if (editingId) {
        console.log('🔄 Updating existing promo code');
        result = await PromocodeService.updatePromoCode(editingId, formData);
      } else {
        console.log('➕ Creating new promo code');
        result = await PromocodeService.createPromoCode(formData, user?.id);
      }

      console.log('📋 Result:', result);

      if (result.success) {
        console.log('✅ Promo code saved successfully');
        await loadPromoCodes();
        handleCloseForm();
        setError(null);
      } else {
        console.warn('⚠️ Promo code save failed:', result.message);
        setError(result.message);
      }
    } catch (err: any) {
      console.error('❌ Error saving promo code:', {
        message: err?.message,
        name: err?.name,
        fullError: JSON.stringify(err, null, 2)
      });
      setError(err.message || 'Failed to save promo code');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promo code?')) return;

    try {
      const result = await PromocodeService.deletePromoCode(id);
      if (result.success) {
        await loadPromoCodes();
        setError(null);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete promo code');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const result = await PromocodeService.updatePromoCode(id, {
        is_active: !currentStatus
      });
      if (result.success) {
        await loadPromoCodes();
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update promo code');
    }
  };

  const handleViewUsage = async (promo: PromoCode) => {
    try {
      setSelectedPromo(promo);
      const stats = await PromocodeService.getPromoCodeUsageStats(promo.id || '');
      setUsageStats(stats);
      setShowUsageModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load usage stats');
    }
  };

  const filteredPromoCodes = promoCodes.filter(code =>
    code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    code.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && promoCodes.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading promo codes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Promo Codes</h2>
          <p className="text-gray-600 mt-1">Manage promotional codes and discounts</p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
        >
          <i className="ri-add-line"></i>
          <span>New Promo Code</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <input
          type="text"
          placeholder="Search promo codes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Promo Code' : 'Create Promo Code'}
              </h3>
              <button
                onClick={handleCloseForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Promo Code *
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code ?? ''}
                    onChange={handleInputChange}
                    placeholder="e.g., SUMMER20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Type *
                  </label>
                  <select
                    name="discount_type"
                    value={formData.discount_type || 'fixed'}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  >
                    <option value="fixed">Fixed Amount ($)</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="free_delivery">Free Delivery</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Value *
                  </label>
                  <input
                    type="number"
                    name="discount_value"
                    value={formData.discount_value ?? 0}
                    onChange={handleInputChange}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Order Amount
                  </label>
                  <input
                    type="number"
                    name="min_order_amount"
                    value={formData.min_order_amount ?? 0}
                    onChange={handleInputChange}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Uses
                  </label>
                  <input
                    type="number"
                    name="max_uses"
                    value={formData.max_uses || ''}
                    onChange={handleInputChange}
                    placeholder="Unlimited"
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Uses Per User Limit
                  </label>
                  <input
                    type="number"
                    name="uses_per_user_limit"
                    value={formData.uses_per_user_limit || ''}
                    onChange={handleInputChange}
                    placeholder="Unlimited"
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="datetime-local"
                    name="start_date"
                    value={(formData.start_date as string) || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="datetime-local"
                    name="end_date"
                    value={(formData.end_date as string) || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description ?? ''}
                  onChange={handleInputChange}
                  placeholder="Enter promo code description"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                ></textarea>
              </div>

              <div className="flex space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active !== false}
                    onChange={handleInputChange}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-600"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_public"
                    checked={formData.is_public || false}
                    onChange={handleInputChange}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-600"
                  />
                  <span className="text-sm text-gray-700">Public</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {editingId ? 'Update' : 'Create'} Promo Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Usage Stats Modal */}
      {showUsageModal && selectedPromo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Usage Statistics: {selectedPromo.code}
              </h3>
              <button
                onClick={() => setShowUsageModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {usageStats && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600 font-medium">Total Uses</p>
                      <p className="text-2xl font-bold text-blue-900">{usageStats.total}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-purple-600 font-medium">Unique Users</p>
                      <p className="text-2xl font-bold text-purple-900">{usageStats.users}</p>
                    </div>
                  </div>

                  {usageStats.recentUsage && usageStats.recentUsage.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Recent Usage</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {usageStats.recentUsage.map((usage: any) => (
                          <div key={usage.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg text-sm">
                            <div>
                              <p className="text-gray-900 font-medium">Discount: ${usage.discount_amount}</p>
                              <p className="text-gray-500 text-xs">
                                {new Date(usage.used_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Promo Codes Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredPromoCodes.length === 0 ? (
          <div className="p-12 text-center">
            <i className="ri-coupon-2-line text-4xl text-gray-300 mb-3 block"></i>
            <p className="text-gray-600 text-lg">
              {searchTerm ? 'No promo codes found matching your search' : 'No promo codes yet'}
            </p>
            <button
              onClick={() => handleOpenForm()}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors inline-flex items-center space-x-2"
            >
              <i className="ri-add-line"></i>
              <span>Create First Promo Code</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Code</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Discount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Uses</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Expires</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPromoCodes.map((promo) => (
                  <tr key={promo.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{promo.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {promo.discount_type === 'percentage' ? 'Percentage' : promo.discount_type === 'fixed' ? 'Fixed' : 'Free Delivery'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : promo.discount_type === 'fixed' ? `$${promo.discount_value}` : 'Free'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {promo.current_uses || 0}
                      {promo.max_uses ? ` / ${promo.max_uses}` : ''}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleToggleActive(promo.id || '', promo.is_active !== false)}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          promo.is_active !== false
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        } hover:opacity-80 transition-opacity`}
                      >
                        <span className={`w-2 h-2 rounded-full mr-2 ${promo.is_active !== false ? 'bg-green-600' : 'bg-gray-600'}`}></span>
                        {promo.is_active !== false ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {promo.end_date ? new Date(promo.end_date).toLocaleDateString() : 'No expiry'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewUsage(promo)}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                          title="View Usage"
                        >
                          <i className="ri-bar-chart-2-line"></i>
                        </button>
                        <button
                          onClick={() => handleOpenForm(promo)}
                          className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                          title="Edit"
                        >
                          <i className="ri-edit-line"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(promo.id || '')}
                          className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                          title="Delete"
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
