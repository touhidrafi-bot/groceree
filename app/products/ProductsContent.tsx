'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductGrid from './ProductGrid';
import ProductQuickView from './ProductQuickView';
import FilterSidebar from './FilterSidebar';
import CartNotification from './CartNotification';
import { useCart } from '../../components/EnhancedCartProvider';
import { SUPABASE_CONFIGURED } from '../../lib/auth';

export interface Product {
  id: string;
  name: string;
  weight: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  category: string;
  description: string;
  nutritionFacts?: string;
  tags: string[];
  isOnSale: boolean;
  rating: number;
  reviews: number;
  sku?: string;
  stock_quantity?: number;
  scalable?: boolean;
  country_of_origin?: string;
  tax_type?: string;
  bottle_price?: number;
  subdepartment?: string;
}

function ProductsContentInner() {
  const searchParams = useSearchParams();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('popularity');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showOnSaleOnly, setShowOnSaleOnly] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [cartNotification, setCartNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const categories = ['All', 'Produce', 'Grocery (Non-Taxable)', 'Dairy, Dairy Alternatives & Eggs', 'Bakery', 'Grocery (Taxable GST)', 'Health & Beauty'];
  const allTags = ['organic', 'vegan', 'gluten-free', 'protein', 'heart-healthy', 'vitamin-c', 'omega-3', 'local', 'keto', 'whole-grain', 'probiotics', 'mediterranean', 'free-range'];

  // Normalize tags for tolerant comparisons (case/hyphen/space tolerant)
  const normalizeTag = (t: string | undefined) =>
    (t || '')
      .toString()
      .toLowerCase()
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const clearTags = () => setSelectedTags([]);

  // Initialize search and category from URL params
  useEffect(() => {
    const urlSearch = searchParams?.get('search');
    const urlCategory = searchParams?.get('category');
    
    if (urlSearch) {
      setSearchQuery(decodeURIComponent(urlSearch));
    }
    
    if (urlCategory) {
      const decodedCategory = decodeURIComponent(urlCategory);
      setSelectedCategory(decodedCategory);
    }
  }, [searchParams]);

  // Scroll to top on page load/refresh
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

 // Fetch products from Supabase (PUBLIC, anon only)
const fetchProducts = async () => {
  setLoading(true);

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('Supabase env vars missing');
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-products`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('get-products failed:', response.status, result);
      throw new Error(result?.error || `HTTP ${response.status}`);
    }

    setProducts(Array.isArray(result.products) ? result.products : []);
  } catch (error) {
    console.error('Error fetching products:', error);
    setProducts([]);
  } finally {
    setLoading(false);
  }
};

  // Fetch products only once on mount - removed auto-refresh
  useEffect(() => {
    fetchProducts();
  }, []);

  // Filter and sort products
  useEffect(() => {
    let filtered = [...products];

    // Apply category filter FIRST - this is the key change
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Apply search filter within the selected category
    if (searchQuery && searchQuery.trim()) {
      filtered = filtered.filter(product => {
        const name = product.name || '';
        const category = product.category || '';
        const description = product.description || '';
        
        return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
               category.toLowerCase().includes(searchQuery.toLowerCase()) ||
               description.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    // Apply tags filter (use normalized matching so tag format differences are tolerated)
    if (selectedTags.length > 0) {
      const normalizedSelected = selectedTags.map(normalizeTag);
      filtered = filtered.filter(product =>
        product.tags && product.tags.some(pt => normalizedSelected.includes(normalizeTag(pt)))
      );
    }

    // Apply sale filter
    if (showOnSaleOnly) {
      filtered = filtered.filter(product => product.isOnSale);
    }

    // Apply sorting
    const sortedFiltered = [...filtered];
    switch (sortBy) {
      case 'price-low':
        sortedFiltered.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-high':
        sortedFiltered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'name':
        sortedFiltered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'rating':
        sortedFiltered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'popularity':
      default:
        sortedFiltered.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
        break;
    }

    // Final sort: in-stock products first, then out-of-stock
    // Keep the existing sort order within each group
    const finalSorted = sortedFiltered.sort((a, b) => {
      const aInStock = (a.stock_quantity || 0) > 0.5;
      const bInStock = (b.stock_quantity || 0) > 0.5;
      
      // If both have same stock status, maintain current order (return 0)
      if (aInStock === bInStock) return 0;
      
      // In-stock products come first
      return bInStock ? 1 : -1;
    });

    setFilteredProducts(finalSorted);
  }, [products, searchQuery, selectedCategory, sortBy, selectedTags, showOnSaleOnly]);

  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy);
  };

  const handleAddToCart = (product: Product, quantity: number = 1) => {
    const taxType: 'none' | 'gst' | 'gst_pst' =
      product.tax_type === 'gst' || product.tax_type === 'gst_pst' ? product.tax_type : 'none';

    const success = addItem(
  {
    id: product.id,
    name: product.name || 'Unknown Product',
    image: product.image || '',
    price: product.price || 0,
    originalPrice: product.originalPrice,
    bottle_price: Number(product.bottle_price ?? 0), // ✅ FIXED
    unit: product.weight || '',
    category: product.category || '',
    isOrganic: product.tags ? product.tags.includes('organic') : false,
    inStock: product.stock_quantity || 50,
    sku: product.sku || `SKU${product.id.padStart(3, '0')}`,
    scalable: product.scalable || false,
    taxType,
  },
  quantity
);


    if (success) {
      setCartNotification(`${product.name || 'Product'} added to cart!`);
    } else {
      setCartNotification(`${product.name || 'Product'} is out of stock!`);
    }
    setTimeout(() => setCartNotification(null), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading fresh products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Fresh Groceries</h1>
          <p className="text-gray-600">
            {selectedCategory === 'All' 
              ? 'Discover quality products delivered fresh to your door'
              : `Browse ${selectedCategory} products`
            }
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-search-line text-gray-400"></i>
                </div>
              </div>
              <input
                type="text"
                placeholder={selectedCategory === 'All' ? "Search for groceries..." : `Search in ${selectedCategory}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              />
            </div>

            <div className="relative">
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-3 pr-8 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-arrow-down-s-line text-gray-400"></i>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-3 pr-8 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent cursor-pointer"
                >
                  <option value="popularity">Popularity</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">Name A-Z</option>
                  <option value="rating">Highest Rated</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-arrow-down-s-line text-gray-400"></i>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="lg:hidden flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-filter-line"></i>
              </div>
              Filters
            </button>
          </div>
        </div>

        <div className="flex gap-8">
          <FilterSidebar
            show={showSidebar}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            showOnSaleOnly={showOnSaleOnly}
            setShowOnSaleOnly={setShowOnSaleOnly}
            allTags={allTags}
            onClose={() => setShowSidebar(false)}
          />

          <div className="flex-1">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-gray-600">
                Showing {filteredProducts.length} of {selectedCategory === 'All' ? products.length : products.filter(p => p.category === selectedCategory).length} products
                {selectedCategory !== 'All' && (
                  <span className="ml-2 text-sm text-green-600">
                    • in {selectedCategory}
                  </span>
                )}
                {sortBy !== 'popularity' && (
                  <span className="ml-2 text-sm text-green-600">
                    • Sorted by {sortBy === 'price-low' ? 'Price: Low to High' : 
                                sortBy === 'price-high' ? 'Price: High to Low' :
                                sortBy === 'name' ? 'Name A-Z' : 'Highest Rated'}
                  </span>
                )}
              </p>
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="hidden lg:flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-filter-line"></i>
                </div>
                Filters
              </button>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 bg-gray-100 rounded-full">
                  <i className="ri-shopping-cart-line text-2xl text-gray-400"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600">
                  {selectedCategory === 'All' 
                    ? "Try adjusting your search or filters to find what you're looking for."
                    : `No products found in ${selectedCategory}. Try adjusting your filters or search terms.`
                  }
                </p>
              </div>
            ) : (
              <ProductGrid
                products={filteredProducts}
                onProductClick={setSelectedProduct}
                onAddToCart={handleAddToCart}
              />
            )}
          </div>
        </div>
      </div>

      {selectedProduct && (
        <ProductQuickView
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          relatedProducts={products.filter(p => 
            p.category === selectedProduct.category && 
            p.id !== selectedProduct.id &&
            (p.stock_quantity || 0) > 0
          ).slice(0, 4)}
        />
      )}

      {cartNotification && (
        <CartNotification
          message={cartNotification}
          onClose={() => setCartNotification(null)}
        />
      )}
    </div>
  );
}

export default function ProductsContent() {
  return <ProductsContentInner />;
}
