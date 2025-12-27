'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase, SUPABASE_CONFIGURED } from '@/lib/auth';
import { WeeklyDeal } from '@/lib/weekly-deals';

interface WeeklyDealsFormProps {
  deal: WeeklyDeal | null;
  onClose: (saved: boolean) => void;
}

export default function WeeklyDealsForm({ deal, onClose }: WeeklyDealsFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    original_price: '',
    sale_price: '',
    tag: 'Special Offer',
    image_url: '',
    valid_from: '',
    valid_to: '',
    is_active: true,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Initialize form with existing deal data
  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title,
        description: deal.description || '',
        original_price: deal.original_price.toString(),
        sale_price: deal.sale_price.toString(),
        tag: deal.tag || 'Special Offer',
        image_url: deal.image_url || '',
        valid_from: deal.valid_from,
        valid_to: deal.valid_to,
        is_active: deal.is_active ?? false,
      });
      if (deal.image_url) {
        setImagePreview(deal.image_url);
      }
    }
  }, [deal]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    if (!SUPABASE_CONFIGURED) {
      throw new Error('Supabase not configured');
    }

    setUploadingImage(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `deals/${fileName}`;

      // Create bucket if it doesn't exist
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === 'weekly-deals-images');

      if (!bucketExists) {
        // Note: Regular users can't create buckets. This should be done by admin via dashboard.
        // For now, we'll try to upload and it will fail gracefully if bucket doesn't exist
      }

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('weekly-deals-images')
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('weekly-deals-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setLoading(true);

      // Validate required fields
      if (!formData.title || !formData.original_price || !formData.sale_price || !formData.valid_from || !formData.valid_to) {
        throw new Error('Please fill in all required fields');
      }

      const originalPrice = parseFloat(formData.original_price);
      const salePrice = parseFloat(formData.sale_price);

      if (isNaN(originalPrice) || isNaN(salePrice)) {
        throw new Error('Prices must be valid numbers');
      }

      if (salePrice > originalPrice) {
        throw new Error('Sale price must be less than or equal to original price');
      }

      if (formData.valid_from > formData.valid_to) {
        throw new Error('Start date must be before end date');
      }

      let imageUrl = formData.image_url;

      // Upload image if a new one was selected
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const dealData = {
        title: formData.title,
        description: formData.description,
        original_price: originalPrice,
        sale_price: salePrice,
        tag: formData.tag,
        image_url: imageUrl,
        valid_from: formData.valid_from,
        valid_to: formData.valid_to,
        is_active: formData.is_active,
      };

      if (deal) {
        // Update existing deal
        const { error: updateError } = await supabase
          .from('weekly_deals')
          .update(dealData)
          .eq('id', deal.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        setSuccess('Deal updated successfully!');
      } else {
        // Create new deal
        const { error: insertError } = await supabase
          .from('weekly_deals')
          .insert([dealData]);

        if (insertError) {
          throw new Error(insertError.message);
        }

        setSuccess('Deal created successfully!');
      }

      // Close form after 1 second
      setTimeout(() => {
        onClose(true);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          {deal ? 'Edit Weekly Deal' : 'Create New Weekly Deal'}
        </h2>
        <button
          onClick={() => onClose(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
        >
          <i className="ri-close-line text-2xl"></i>
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            <div className="flex items-center gap-3">
              <i className="ri-error-warning-line text-xl"></i>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
            <div className="flex items-center gap-3">
              <i className="ri-check-line text-xl"></i>
              <p>{success}</p>
            </div>
          </div>
        )}

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Product Image *
          </label>
          <div className="flex gap-4">
            {imagePreview && (
              <div className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              <label className="block w-full">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-green-500 transition-colors cursor-pointer text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                  <i className="ri-image-add-line text-3xl text-gray-400 mb-2 inline-block"></i>
                  <p className="text-sm text-gray-600 font-semibold">
                    {uploadingImage ? 'Uploading...' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Deal Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., 50% Off Organic Fruits"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of the deal"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Tag */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Tag
          </label>
          <input
            type="text"
            value={formData.tag}
            onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
            placeholder="e.g., Special Offer, Limited Time"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Original Price *
            </label>
            <div className="flex items-center">
              <span className="text-gray-600 mr-2">$</span>
              <input
                type="number"
                step="0.01"
                value={formData.original_price}
                onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                placeholder="0.00"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Sale Price *
            </label>
            <div className="flex items-center">
              <span className="text-gray-600 mr-2">$</span>
              <input
                type="number"
                step="0.01"
                value={formData.sale_price}
                onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                placeholder="0.00"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Valid From *
            </label>
            <input
              type="date"
              value={formData.valid_from}
              onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Valid To *
            </label>
            <input
              type="date"
              value={formData.valid_to}
              onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Active Status */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
          />
          <label htmlFor="is_active" className="text-sm font-semibold text-gray-900 cursor-pointer">
            Active
          </label>
        </div>

        {/* Submit Button */}
        <div className="flex items-center gap-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => onClose(false)}
            disabled={loading}
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer font-semibold text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || uploadingImage}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {deal ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <i className="ri-check-line"></i>
                {deal ? 'Update Deal' : 'Create Deal'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
