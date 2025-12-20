'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/auth';
import { clearPaymentSettingsCache } from '../../lib/payment-settings';
import { RiCloseLine, RiLoader4Line } from 'react-icons/ri';

interface PaymentSettings {
  id: number;
  stripe_enabled: boolean;
  interac_enabled: boolean;
  updated_at: string;
}

interface AdminSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSettings({ isOpen, onClose }: AdminSettingsProps) {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('payment_settings')
        .select('*')
        .single();

      if (fetchError) {
        throw fetchError;
      }

      setSettings(data);
    } catch (err: any) {
      console.error('Error fetching payment settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (field: 'stripe_enabled' | 'interac_enabled') => {
    if (!settings) return;

    const newValue = !settings[field];

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const { error: updateError } = await supabase
        .from('payment_settings')
        .update({
          [field]: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);

      if (updateError) {
        throw updateError;
      }

      const updatedSettings = {
        ...settings,
        [field]: newValue,
      };

      setSettings(updatedSettings);
      setSuccess(`${field === 'stripe_enabled' ? 'Stripe' : 'Interac'} payment method ${newValue ? 'enabled' : 'disabled'}`);

      // Clear cache so checkout page gets updated settings immediately
      clearPaymentSettingsCache();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error updating payment settings:', err);
      setError(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Close settings"
          >
            <RiCloseLine size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <i className="ri-error-warning-line text-red-600"></i>
                </div>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <i className="ri-check-line text-green-600"></i>
                </div>
                <p className="text-sm text-green-800">{success}</p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <RiLoader4Line className="animate-spin text-green-600 mx-auto mb-2" size={32} />
                <p className="text-gray-600 text-sm">Loading settings...</p>
              </div>
            </div>
          ) : settings ? (
            <div className="space-y-4">
              {/* Stripe Payment Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-gray-200">
                      <i className="ri-bank-card-line text-blue-600 text-lg"></i>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Stripe Payment</h3>
                      <p className="text-xs text-gray-500">Credit/Debit Card</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleToggle('stripe_enabled')}
                  disabled={isSaving}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    settings.stripe_enabled ? 'bg-green-600' : 'bg-gray-300'
                  } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  aria-label="Toggle Stripe payment"
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      settings.stripe_enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Interac Payment Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-gray-200">
                      <i className="ri-bank-line text-green-600 text-lg"></i>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Interac e-Transfer</h3>
                      <p className="text-xs text-gray-500">Online Bank Transfer</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleToggle('interac_enabled')}
                  disabled={isSaving}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    settings.interac_enabled ? 'bg-green-600' : 'bg-gray-300'
                  } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  aria-label="Toggle Interac payment"
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      settings.interac_enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Info box */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="w-5 h-5 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <i className="ri-information-line text-blue-600"></i>
                  </div>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Payment Method Status</p>
                    <div className="space-y-1">
                      <p>
                        • Stripe: <span className={settings.stripe_enabled ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {settings.stripe_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </p>
                      <p>
                        • Interac: <span className={settings.interac_enabled ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {settings.interac_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </p>
                    </div>
                    <p className="mt-2 text-xs opacity-75">Changes apply immediately to the checkout page.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
