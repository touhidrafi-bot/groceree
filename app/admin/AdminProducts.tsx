'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase, SUPABASE_URL, SUPABASE_CONFIGURED } from '../../lib/auth';
import { useAuth } from '../../components/AuthProvider';

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  regular_price?: number;
  bottle_price?: number;
  department: string;
  subdepartment: string;
  scalable: boolean;
  tax_type: string;
  country_of_origin: string;
  unit: string;
  stock_quantity: number;
  low_stock_threshold: number;
  images: string[];
  is_active: boolean;
  dietary_tags?: string[];
  created_at: string;
}

interface StockAlert {
  id: string;
  product_id: string;
  alert_type: string;
  current_stock: number;
  threshold: number;
  is_read: boolean;
  created_at: string;
  products: {
    name: string;
    sku: string;
    stock_quantity: number;
  };
}

interface StockAdjustment {
  id: string;
  product_id: string | null;
  adjustment_type: string;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  created_at: string | null;
  adjusted_by: string | null;
  order_id: string | null;
  products: {
    name: string;
    sku: string | null;
  } | null;
  users: {
    email: string;
  } | null;
}

const departments = [
  'Produce',
  'Grocery (Non-Taxable)',
  'Grocery',
  'Dairy, Dairy Alternatives & Eggs',
  'Bakery',
  'Grocery (Taxable GST)',
  'Health & Beauty',
];

const dietaryTags = [
  'organic',
  'vegan',
  'gluten free',
  'protein',
  'heart healthy',
  'vitamin enriched',
  'dairy free',
  'non-gmo',
  'locally sourced',
  'fair trade',
  'mediterranean',
  'free range'
];

const countries = [
  'Canada', 'USA', 'Mexico', 'Ecuador', 'Chile', 'Peru', 'Colombia',
  'Spain', 'Italy', 'France', 'Netherlands', 'Belgium', 'Germany',
  'New Zealand', 'Australia', 'South Africa', 'Morocco', 'Turkey', 'China', 'Costa Rica', 'Vietnam', 'South Korea'
];

const departmentSubdepartments: { [key: string]: string[] } = {
  'Produce': ['Fresh Fruits', 'Fresh Vegetables', 'Organic Produce', 'Herbs & Seasonings'],
  'Grocery (Non-Taxable)': ['Canned Goods', 'Dry Goods', 'Condiments', 'Baking Supplies'],
  'Grocery': ['Pantry Staples', 'Cooking Essentials', 'International Foods', 'Specialty Items'],
  'Dairy, Dairy Alternatives & Eggs': ['Milk & Cream', 'Cheese', 'Yogurt', 'Plant-Based Alternatives', 'Eggs'],
  'Bakery': ['Fresh Bread', 'Pastries', 'Cakes & Desserts', 'Bagels & Muffins'],
  'Grocery (Taxable GST)': ['Snacks', 'Beverages', 'Candy & Chocolate', 'Ice Cream'],
  'Health & Beauty': ['Personal Care', 'Vitamins & Supplements', 'First Aid', 'Beauty Products']
};

const _taxTypeLabels: { [key: string]: string } = {
  'none': 'Tax-Free',
  'gst': 'GST Only',
  'gst_pst': 'GST + PST'
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showAdjustmentsModal, setShowAdjustmentsModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockEditProduct, setStockEditProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableSubdepartments, setAvailableSubdepartments] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    department: '',
    subdepartment: '',
    price: '',
    regular_price: '',
    bottle_price: '',
    unit: '',
    stock_quantity: '',
    low_stock_threshold: '5',
    tax_type: 'none',
    country_of_origin: 'Canada',
    description: '',
    images: [] as string[],
    dietary_tags: [] as string[],
    scalable: false,
    is_active: true
  });
  const [stockFormData, setStockFormData] = useState({
    new_stock: '',
    reason: ''
  });

  const { isRehydrated, loading: authLoading } = useAuth();
  const authReady = isRehydrated && !authLoading;

  useEffect(() => {
    if (!authReady) return;

    fetchProducts();
    fetchStockAlerts();
    fetchStockAdjustments();

    // Refresh stock data every 60 seconds to reflect order changes
    const interval = setInterval(() => {
      fetchProducts();
      fetchStockAlerts();
    }, 60000);

    return () => clearInterval(interval);
  }, [authReady]);

  // Filter products based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product => {
        const query = searchQuery.toLowerCase();
        const name = (product.name || '').toLowerCase();
        const department = (product.department || '').toLowerCase();
        const subdepartment = (product.subdepartment || '').toLowerCase();
        const sku = (product.sku || '').toLowerCase();

        // Determine stock status
        const stockStatus = product.stock_quantity <= 0 ? 'out of stock' :
                           product.stock_quantity <= (product.low_stock_threshold || 5) ? 'low stock' :
                           'in stock';

        return name.includes(query) ||
               department.includes(query) ||
               subdepartment.includes(query) ||
               sku.includes(query) ||
               stockStatus.includes(query);
      });
      setFilteredProducts(filtered);
    }
  }, [products, searchQuery]);

  const fetchProducts = async () => {
    if (!authReady) return;

    try {
      const response = await fetch('/api/admin/products');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const fetchedProducts = await response.json();
      setProducts(fetchedProducts);

      // Update stockEditProduct if it's open with fresh data
      if (stockEditProduct && fetchedProducts.length > 0) {
        const updatedProduct = fetchedProducts.find((p: Product) => p.id === stockEditProduct.id);
        if (updatedProduct) {
          setStockEditProduct(updatedProduct);
          setStockFormData({
            new_stock: updatedProduct.stock_quantity.toString(),
            reason: ''
          });
        }
      }
    } catch (error: any) {
      console.error('Error fetching products:', {
        message: error?.message || 'Unknown error',
        code: error?.code || 'UNKNOWN'
      });
      showNotification('error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchStockAlerts = async () => {
    if (!authReady) return;

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stock-management`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getStockAlerts'
        }),
      });

      const result = await response.json();
      if (!result.error) {
        setStockAlerts(result.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching stock alerts:', error);
    }
  };

  const fetchStockAdjustments = async () => {
    if (!authReady) return;

    try {
      const response = await fetch('/api/admin/stock-adjustments');
      if (!response.ok) {
        throw new Error('Failed to fetch stock adjustments');
      }
      const adjustments = await response.json();
      setStockAdjustments(adjustments);
    } catch (error) {
      console.error('Error fetching stock adjustments:', error);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleDepartmentChange = (department: string) => {
    setFormData(prev => ({
      ...prev,
      department,
      subdepartment: ''
    }));
    setAvailableSubdepartments(departmentSubdepartments[department] || []);
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Not authenticated');
      }

      if (!SUPABASE_URL) {
        console.warn('Skipping deleteProduct: NEXT_PUBLIC_SUPABASE_URL not configured');
        showNotification('error', 'Not configured to call server functions');
      } else {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-products-management`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            method: 'DELETE',
            action: 'deleteProduct',
            productId
          }),
        });

        const result = await response.json();
        if (result.error) throw new Error(result.error);

        showNotification('success', 'Product deleted successfully');
        fetchProducts();
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      showNotification('error', 'Failed to delete product');
    }
  };

  const processImageFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    // Validate file count
    if (fileArray.length + formData.images.length > 6) {
      showNotification('error', `Maximum 6 images allowed. You have ${formData.images.length} image(s) already.`);
      return;
    }

    // Validate file types
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const invalidFiles = fileArray.filter(file => !validTypes.includes(file.type));
    if (invalidFiles.length > 0) {
      showNotification('error', 'Only JPG, PNG, and WebP images are allowed');
      return;
    }

    // Validate file sizes (5MB max)
    const maxSize = 5 * 1024 * 1024;
    const oversizedFiles = fileArray.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      showNotification('error', 'Images must be smaller than 5MB each');
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Not authenticated');
      }

      const uploadedImages: string[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${i}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { data: _uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        uploadedImages.push(publicUrl);
      }

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedImages]
      }));

      showNotification('success', `${uploadedImages.length} image(s) uploaded successfully`);
    } catch (error) {
      console.error('Error uploading images:', error);
      showNotification('error', `Failed to upload images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await processImageFiles(e.target.files || []);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    await processImageFiles(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const markAlertAsRead = async (alertId: string) => {
    try {
      if (!SUPABASE_CONFIGURED) {
        throw new Error('Supabase not configured');
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) return;

      await fetch(`${SUPABASE_URL}/functions/v1/stock-management`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'markAlertAsRead',
          orderItems: { alertId }
        }),
      });

      fetchStockAlerts();
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stockEditProduct) return;

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stock-management`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'manualStockAdjustment',
          orderItems: [{
            product_id: stockEditProduct.id,
            new_stock: parseInt(stockFormData.new_stock)
          }],
          userId: session.user.id,
          reason: stockFormData.reason || 'Manual stock adjustment'
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      showNotification('success', 'Stock updated successfully');
      setShowStockModal(false);
      setStockFormData({ new_stock: '', reason: '' });
      setStockEditProduct(null);
      await fetchProducts();
      fetchStockAlerts();
      fetchStockAdjustments();
    } catch (error) {
      console.error('Error updating stock:', error);
      showNotification('error', `Failed to update stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Not authenticated');
      }

      const productData: any = {
        name: formData.name,
        department: formData.department,
        subdepartment: formData.subdepartment,
        price: parseFloat(formData.price),
        unit: formData.unit,
        stock_quantity: parseInt(formData.stock_quantity),
        low_stock_threshold: parseInt(formData.low_stock_threshold),
        country_of_origin: formData.country_of_origin,
        description: formData.description,
        images: formData.images,
        scalable: formData.scalable,
        is_active: formData.is_active,
        dietary_tags: formData.dietary_tags
      };

      if (
  formData.bottle_price !== undefined &&
  String(formData.bottle_price).trim() !== ''
) {
  const parsed = parseFloat(formData.bottle_price as unknown as string);
  if (!isNaN(parsed)) {
    productData.bottle_price = parsed;
  }
}

      if (
  formData.regular_price !== undefined &&
  String(formData.regular_price).trim() !== ''
) {
  const parsed = parseFloat(formData.regular_price as unknown as string);
  if (!isNaN(parsed)) {
    productData.regular_price = parsed;
  }
}

      const isEditing = editingProduct !== null;
      const action = isEditing ? 'updateProduct' : 'createProduct';
      const method = isEditing ? 'PUT' : 'POST';

      const requestBody: any = {
        method,
        action,
        productData
      };

      if (isEditing) {
        requestBody.productId = editingProduct.id;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-products-management`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        throw new Error('Invalid response from server - could not parse JSON');
      }

      if (!response.ok) {
        const errorMessage = result?.error || `HTTP ${response.status}: Failed to save product`;
        const details = result?.details ? ` - ${result.details}` : '';
        console.error(`HTTP ${response.status}:`, result);
        throw new Error(errorMessage + details);
      }

      if (result.error) throw new Error(result.error);

      showNotification('success', result.message);
      setShowModal(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      showNotification('error', `Failed to ${editingProduct ? 'update' : 'create'} product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      department: product.department,
      subdepartment: product.subdepartment || '',
      price: product.price.toString(),
      regular_price: product.regular_price !== null && product.regular_price !== undefined
        ? product.regular_price.toString()
        : '',
      bottle_price: product.bottle_price !== null && product.bottle_price !== undefined
        ? product.bottle_price.toString()
        : '',
      unit: product.unit,
      stock_quantity: product.stock_quantity.toString(),
      low_stock_threshold: (product.low_stock_threshold || 5).toString(),
      tax_type: product.tax_type || 'none',
      country_of_origin: product.country_of_origin || 'Canada',
      description: product.description || '',
      images: product.images || [],
      dietary_tags: product.dietary_tags || [],
      scalable: product.scalable || false,
      is_active: product.is_active !== undefined ? product.is_active : true
    });
    setAvailableSubdepartments(departmentSubdepartments[product.department] || []);
    setShowModal(true);
  };

  const handleStockEdit = (product: Product) => {
    setStockEditProduct(product);
    setStockFormData({
      new_stock: product.stock_quantity.toString(),
      reason: ''
    });
    setShowStockModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      department: '',
      subdepartment: '',
      price: '',
      regular_price: '',
      bottle_price: '',
      unit: '',
      stock_quantity: '',
      low_stock_threshold: '5',
      tax_type: 'none',
      country_of_origin: 'Canada',
      description: '',
      images: [],
      dietary_tags: [],
      scalable: false,
      is_active: true
    });
    setEditingProduct(null);
    setAvailableSubdepartments([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Header with Stock Alerts */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">Product Management</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Manage your grocery inventory</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 flex-shrink-0">
          {stockAlerts.length > 0 && (
            <button
              onClick={() => setShowAlertsModal(true)}
              className="relative bg-red-100 text-red-800 px-3 sm:px-4 py-2 rounded-lg hover:bg-red-200 transition-colors cursor-pointer whitespace-nowrap text-xs sm:text-sm w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <i className="ri-alert-line"></i>
              <span className="hidden sm:inline">{stockAlerts.length} Alert{stockAlerts.length > 1 ? 's' : ''}</span>
              <span className="sm:hidden">{stockAlerts.length}</span>
              <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {stockAlerts.length}
              </span>
            </button>
          )}
          <button
            onClick={() => setShowAdjustmentsModal(true)}
            className="bg-blue-100 text-blue-800 px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors cursor-pointer whitespace-nowrap text-xs sm:text-sm w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <i className="ri-history-line"></i>
            <span className="hidden sm:inline">Stock History</span>
            <span className="sm:hidden">History</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap text-xs sm:text-sm w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <i className="ri-add-line"></i>
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg lg:rounded-xl shadow-sm p-3 sm:p-4 border border-gray-200">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="ri-search-line text-gray-400 text-lg"></i>
          </div>
          <input
            type="text"
            placeholder="Search by name, SKU, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-20 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs sm:text-sm"
          />
          <button
            onClick={() => {
              fetchProducts();
              fetchStockAlerts();
              fetchStockAdjustments();
            }}
            className="absolute inset-y-0 right-10 flex items-center cursor-pointer hover:opacity-70 transition-opacity"
            title="Refresh"
          >
            <i className="ri-refresh-line text-gray-400 hover:text-gray-600 text-lg"></i>
          </button>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
            >
              <i className="ri-close-line text-gray-400 hover:text-gray-600 text-lg"></i>
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs sm:text-sm text-gray-600 mt-2">
            Showing {filteredProducts.length} of {products.length} products
          </p>
        )}
        {!searchQuery && products.length > 0 && (
          <p className="text-xs sm:text-sm text-gray-600 mt-2">
            Showing all {products.length} products
          </p>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg lg:rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredProducts.length === 0 && searchQuery ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 bg-gray-100 rounded-full">
              <i className="ri-search-line text-2xl text-gray-400"></i>
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-4">Try adjusting your search terms or clear the search.</p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap text-sm"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const isLowStock = product.stock_quantity <= (product.low_stock_threshold || 5);
                const isOutOfStock = product.stock_quantity <= 0;

                return (
                  <div key={product.id} className={`p-4 hover:bg-gray-50 transition ${
                    isOutOfStock ? 'bg-red-50' : isLowStock ? 'bg-yellow-50' : ''
                  }`}>
                    <div className="flex items-start gap-3 mb-3">
                      <Image
                        className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                        src={product.images?.[0] || '/placeholder-product.jpg'}
                        alt={product.name}
                        width={48}
                        height={48}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 truncate">{product.name}</h4>
                        <p className="text-xs text-gray-500">{product.unit}</p>
                        <p className="text-xs text-gray-600 font-mono mt-0.5">{product.sku}</p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap flex-shrink-0 ${
                        product.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <div className="text-xs text-gray-600">Department</div>
                        <p className="text-xs font-medium text-gray-900">{product.department}</p>
                        <p className="text-xs text-gray-500">{product.subdepartment}</p>
                      </div>

                      <div>
                        <div className="text-xs text-gray-600">Price</div>
                        <p className="text-sm font-bold text-gray-900">${product.price.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mb-3 p-2 bg-white rounded border border-gray-100">
                      <div className="text-xs text-gray-600 mb-1">Stock</div>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${
                          isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-gray-900'
                        }`}>
                          {product.stock_quantity} {product.unit}
                        </span>
                        {isOutOfStock && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Out
                          </span>
                        )}
                        {!isOutOfStock && isLowStock && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Low
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Threshold: {product.low_stock_threshold || 5}</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStockEdit(product)}
                        className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-xs font-medium cursor-pointer transition"
                      >
                        <i className="ri-shopping-cart-line mr-1"></i>Stock
                      </button>
                      <button
                        onClick={() => handleEdit(product)}
                        className="flex-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-xs font-medium cursor-pointer transition"
                      >
                        <i className="ri-edit-line mr-1"></i>Edit
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-xs font-medium cursor-pointer transition"
                      >
                        <i className="ri-delete-bin-line mr-1"></i>Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProducts.map((product) => {
                    const isLowStock = product.stock_quantity <= (product.low_stock_threshold || 5);
                    const isOutOfStock = product.stock_quantity <= 0;

                    return (
                      <tr key={product.id} className={`hover:bg-gray-50 transition ${
                        isOutOfStock ? 'bg-red-50' : isLowStock ? 'bg-yellow-50' : ''
                      }`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Image
                              className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                              src={product.images?.[0] || '/placeholder-product.jpg'}
                              alt={product.name}
                              width={40}
                              height={40}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{product.name}</div>
                              <div className="text-xs text-gray-500">{product.unit}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">
                          {product.sku}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{product.department}</div>
                          <div className="text-xs text-gray-500">{product.subdepartment}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          ${product.price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${
                              isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-gray-900'
                            }`}>
                              {product.stock_quantity}
                            </span>
                            {isOutOfStock && (
                              <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                Out of Stock
                              </span>
                            )}
                            {!isOutOfStock && isLowStock && (
                              <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                Low Stock
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            Threshold: {product.low_stock_threshold || 5}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            product.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          <button
                            onClick={() => handleStockEdit(product)}
                            className="text-blue-600 hover:text-blue-900 mr-4 cursor-pointer"
                          >
                            Stock
                          </button>
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-red-600 hover:text-red-900 cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {showStockModal && stockEditProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg sm:rounded-xl lg:rounded-2xl max-w-md w-full">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 lg:p-6 flex items-center justify-between">
              <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 truncate">
                Adjust Stock
              </h2>
              <button
                onClick={() => setShowStockModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-2 -mr-2"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleStockAdjustment} className="p-3 sm:p-4 lg:p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900">
                  {stockEditProduct.name}
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Current: <span className="font-bold">{stockEditProduct.stock_quantity}</span> {stockEditProduct.unit}
                </p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  New Stock Quantity *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={stockFormData.new_stock}
                  onChange={(e) => setStockFormData(prev => ({ ...prev, new_stock: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  placeholder="Enter new quantity"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Reason for Adjustment
                </label>
                <textarea
                  rows={3}
                  value={stockFormData.reason}
                  onChange={(e) => setStockFormData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  placeholder="Explain the adjustment..."
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2.5 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium"
                >
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Alerts Modal */}
      {showAlertsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg sm:rounded-xl lg:rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 lg:p-6 flex items-center justify-between">
              <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">Stock Alerts</h2>
              <button
                onClick={() => setShowAlertsModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-2 -mr-2"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-3 sm:p-4 lg:p-6 space-y-3">
              {stockAlerts.map((alert) => (
                <div key={alert.id} className={`p-3 sm:p-4 rounded-lg border ${
                  alert.alert_type === 'out_of_stock' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-medium text-gray-900 truncate">{alert.products.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-600">SKU: {alert.products.sku}</p>
                      <p className={`text-xs sm:text-sm font-medium mt-1 ${
                        alert.alert_type === 'out_of_stock' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {alert.alert_type === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
                      </p>
                      <div className="text-xs text-gray-500 mt-1">
                        Current: {alert.current_stock} | Threshold: {alert.threshold}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => markAlertAsRead(alert.id)}
                      className="w-full sm:w-auto px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg cursor-pointer text-xs sm:text-sm font-medium transition"
                    >
                      Mark as Read
                    </button>
                  </div>
                </div>
              ))}
              {stockAlerts.length === 0 && (
                <p className="text-gray-500 text-center py-8 text-sm">No active stock alerts</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustments History Modal */}
      {showAdjustmentsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg sm:rounded-xl lg:rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 lg:p-6 flex items-center justify-between">
              <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">Stock History</h2>
              <button
                onClick={() => setShowAdjustmentsModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-2 -mr-2"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-3 sm:p-4 lg:p-6 overflow-x-auto">
              <table className="w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Product</th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Change</th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Stock</th>
                    <th className="hidden sm:table-cell px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">User</th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stockAdjustments.map((adjustment) => (
                    <tr key={adjustment.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">{adjustment.products?.name}</div>
                        <div className="text-xs text-gray-500 font-mono truncate">{adjustment.products?.sku}</div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          adjustment.adjustment_type === 'order_placed' ? 'bg-blue-100 text-blue-800' :
                          adjustment.adjustment_type === 'order_cancelled' ? 'bg-green-100 text-green-800' :
                          adjustment.adjustment_type === 'manual_adjustment' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {adjustment.adjustment_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs sm:text-sm font-semibold ${
                          adjustment.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {adjustment.quantity_change > 0 ? '+' : ''}{adjustment.quantity_change}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {adjustment.previous_stock}→{adjustment.new_stock}
                      </td>
                      <td className="hidden sm:table-cell px-3 sm:px-4 py-3 whitespace-nowrap text-xs text-gray-500 truncate">
                        {adjustment.users?.email || 'System'}
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                        {adjustment.created_at ? new Date(adjustment.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg sm:rounded-xl lg:rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 lg:p-6 flex items-center justify-between">
              <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-2 -mr-2"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-3 sm:p-4 lg:p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Product Name and SKU */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., Organic Bananas"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SKU {editingProduct ? '' : '(Auto-generated)'}
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                        !editingProduct ? 'bg-gray-50' : ''
                      }`}
                      placeholder={editingProduct ? 'SKU' : 'Auto-generated'}
                      readOnly={!editingProduct}
                    />
                  </div>
                </div>

                {/* Department and Subdepartment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department *
                    </label>
                    <select
                      required
                      value={formData.department}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 pr-8"
                    >
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subdepartment
                    </label>
                    <select
                      value={formData.subdepartment}
                      onChange={(e) => setFormData(prev => ({ ...prev, subdepartment: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 pr-8"
                      disabled={!formData.department}
                    >
                      <option value="">Select Subdepartment</option>
                      {availableSubdepartments.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Price, Regular Price, Bottle Price, Unit, Stock, Threshold */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Regular Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.regular_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, regular_price: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty if not on sale</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bottle Sales/Deposit
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.bottle_price}
                      onChange={(e) => setFormData(prev => ({ ...prev, bottle_price: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.unit}
                      onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                      placeholder="each, lb, kg, pack, etc."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stock Quantity *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Low Stock Alert *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={formData.low_stock_threshold}
                      onChange={(e) => setFormData(prev => ({ ...prev, low_stock_threshold: e.target.value }))}
                      className="w-100 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="5"
                    />
                  </div>
                </div>

                {/* Tax Type and Country */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Type (Auto-assigned by Department)
                    </label>
                    <select
                      value={formData.tax_type || 'none'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 pr-8 bg-gray-50"
                      disabled
                    >
                      <option value="none">Tax-Free</option>
                      <option value="gst">GST Only</option>
                      <option value="gst_pst">GST + PST</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country of Origin *
                    </label>
                    <select
                      required
                      value={formData.country_of_origin || 'Canada'}
                      onChange={(e) => setFormData(prev => ({ ...prev, country_of_origin: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 pr-8"
                    >
                      {countries.map(country => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                    </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Describe the product features, benefits, and usage..."
                  />
                </div>

                {/* Dietary Preferences */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Dietary Preferences
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {dietaryTags.map((tag) => (
                      <label key={tag} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.dietary_tags.includes(tag)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                dietary_tags: [...prev.dietary_tags, tag]
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                dietary_tags: prev.dietary_tags.filter(t => t !== tag)
                              }));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                        />
                        <span className="ml-2 text-sm text-gray-700 capitalize">{tag}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Images (Max 6) {formData.images.length > 0 && <span className="text-gray-500">({formData.images.length}/6)</span>}
                  </label>
                  <div
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 transition-all hover:border-green-400 hover:bg-green-50 cursor-pointer"
                  >
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center justify-center py-4">
                      <i className="ri-upload-cloud-line text-3xl text-gray-400 mb-2"></i>
                      <span className="text-sm text-gray-600">Drag and drop images or click to upload</span>
                      <span className="text-xs text-gray-400">JPG, PNG, WebP up to 5MB each</span>
                    </label>
                  </div>
                  
                  {/* Image Preview */}
                  {formData.images.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-4">
                      {formData.images.map((image, index) => (
                        <div key={index} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image}
                            alt={`Product ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Checkboxes */}
                <div className="flex items-center space-x-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.scalable}
                      onChange={(e) => setFormData(prev => ({ ...prev, scalable: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Scalable Product (sold by weight)</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap flex items-center"
                  >
                    {editingProduct ? 'Update Product' : 'Create Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
