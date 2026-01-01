'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/auth';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  final_weight: number | null;
  final_price: number | null;
  bottle_price?: number;
  products: {
    id: string;
    name: string;
    unit: string;
    scalable: boolean;
    tax_type: string;
    stock_quantity: number;
    price: number;
    bottle_price?: number;
  };
}

interface EditHistory {
  id: string;
  edit_type: string;
  changes: Record<string, any>;
  edited_by: string;
  created_at: string;
  edited_user?: { first_name: string; last_name: string };
}

interface Product {
  id: string;
  name: string;
  price: number;
  bottle_price: number | null;
  unit: string;
  scalable: boolean | null;
  tax_type: string | null;
  stock_quantity: number | null;
  category: string;
}

interface OrderEditModalProps {
  order: {
    id: string;
    order_number: string;
    subtotal: number;
    gst: number;
    pst: number;
    tax: number;
    total: number;
    delivery_fee: number;
    tip_amount: number;
    discount: number;
    order_items: OrderItem[];
  };
  products: Product[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function OrderEditModal({ order, products, onClose: _onClose, onUpdate }: OrderEditModalProps) {
  const [editingItems, setEditingItems] = useState<OrderItem[]>(order.order_items);
  const [editHistory, setEditHistory] = useState<EditHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [_editingItemId, _setEditingItemId] = useState<string | null>(null);
  const [_editValues, _setEditValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'items' | 'history'>('items');

  useEffect(() => {
    loadEditHistory();
  }, []);

  const loadEditHistory = async () => {
    try {
      const { data, error: historyError } = await supabase
        .from('order_edit_history')
        .select('id, edit_type, changes, edited_by, created_at, edited_user:edited_by(first_name, last_name)')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false });

      if (historyError) throw historyError;
      const formattedData = (data || []).map((entry: any) => ({
        ...entry,
        edited_user: Array.isArray(entry.edited_user) ? entry.edited_user[0] : entry.edited_user
      }));
      setEditHistory(formattedData);
    } catch (err) {
      console.error('Error loading edit history:', err);
    }
  };

  const calculateTotals = (items: OrderItem[]) => {
    let subtotal = 0;
    let gst = 0;
    let pst = 0;

    items.forEach(item => {
      subtotal += parseFloat(item.total_price.toString());
      const product = Array.isArray(item.products) ? item.products[0] : item.products;

      if (product && product.tax_type) {
        if (product.tax_type === 'gst') {
          gst += parseFloat(item.total_price.toString()) * 0.05;
        } else if (product.tax_type === 'gst_pst') {
          gst += parseFloat(item.total_price.toString()) * 0.05;
          pst += parseFloat(item.total_price.toString()) * 0.07;
        }
      }
    });

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      gst: parseFloat(gst.toFixed(2)),
      pst: parseFloat(pst.toFixed(2)),
      tax: parseFloat((gst + pst).toFixed(2))
    };
  };

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    const item = editingItems.find(i => i.id === itemId);
    if (!item) return;

    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    if (!product) return;

    let quantity = newQuantity;

    if (product.scalable) {
      quantity = Math.max(0.01, parseFloat(newQuantity.toFixed(2)));
    } else {
      quantity = Math.max(1, Math.round(newQuantity));
    }

    const unitPrice = parseFloat(item.unit_price.toString());
    const bottlePrice = parseFloat((item.bottle_price || 0).toString());
    const totalPrice = parseFloat((quantity * (unitPrice + bottlePrice)).toFixed(2));

    const updated = editingItems.map(i => {
      if (i.id === itemId) {
        return {
          ...i,
          quantity,
          total_price: totalPrice,
          final_weight: product.scalable ? quantity : i.final_weight,
          final_price: totalPrice
        };
      }
      return i;
    });

    setEditingItems(updated);
  };

  const handleFinalWeightChange = (itemId: string, newWeight: number) => {
    const item = editingItems.find(i => i.id === itemId);
    if (!item) return;

    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    if (!product || !product.scalable) return;

    const unitPrice = parseFloat(item.unit_price.toString());
    const bottlePrice = parseFloat((item.bottle_price || 0).toString());
    const totalPrice = parseFloat((newWeight * (unitPrice + bottlePrice)).toFixed(2));

    const updated = editingItems.map(i => {
      if (i.id === itemId) {
        return {
          ...i,
          final_weight: newWeight,
          final_price: totalPrice,
          quantity: newWeight
        };
      }
      return i;
    });

    setEditingItems(updated);
  };

  const handleRemoveItem = (itemId: string) => {
    if (editingItems.length <= 1) {
      setError('Cannot remove the last item from an order');
      return;
    }

    setEditingItems(editingItems.filter(item => item.id !== itemId));
  };

  const handleAddProduct = (productId: string, qty: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) {
      setError('Product not found');
      return;
    }

    const existingItem = editingItems.find(item => item.product_id === productId);
    if (existingItem) {
      setError('Product already exists in this order');
      return;
    }

    let quantity = qty;
    if (product.scalable) {
      quantity = Math.max(0.01, parseFloat(qty.toFixed(2)));
    } else {
      quantity = Math.max(1, Math.round(qty));
    }

    const totalPrice = parseFloat((quantity * (product.price + (product.bottle_price || 0))).toFixed(2));

    const newItem: OrderItem = {
      id: `new_${Date.now()}`,
      product_id: productId,
      quantity,
      unit_price: product.price,
      total_price: totalPrice,
      final_weight: product.scalable ? quantity : null,
      final_price: totalPrice,
      bottle_price: product.bottle_price || 0,
      products: {
        id: product.id,
        name: product.name,
        unit: product.unit,
        scalable: product.scalable || false,
        tax_type: product.tax_type || 'none',
        stock_quantity: product.stock_quantity || 0,
        price: product.price,
        bottle_price: product.bottle_price || 0
      }
    };

    setEditingItems([...editingItems, newItem]);
    setShowAddProduct(false);
    setProductSearch('');
    setSuccess('Product added to order');
  };

  const handleSaveChanges = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('No valid session');
      }

      const response = await fetch('/api/admin/order-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'batch_update',
          orderId: order.id,
          newItems: editingItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            bottle_price: item.bottle_price,
            total_price: item.total_price,
            final_weight: item.final_weight,
            final_price: item.final_price
          }))
        })
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update order';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
          } else {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
        } catch {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const _result = await response.json();
      setSuccess('Order updated successfully');
      setTimeout(() => {
        onUpdate();
        loadEditHistory();
      }, 500);
    } catch (err) {
      console.error('Error saving changes:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    if (!productSearch) return true;
    const searchLower = productSearch.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchLower) ||
      product.category.toLowerCase().includes(searchLower)
    ) && !editingItems.some(item => item.product_id === product.id);
  });

  const totals = calculateTotals(editingItems);
  const deliveryFee = parseFloat((order.delivery_fee || 0).toString());
  const tipAmount = parseFloat((order.tip_amount || 0).toString());
  const discount = parseFloat((order.discount || 0).toString());
  const newTotal = parseFloat((totals.subtotal + totals.tax + deliveryFee + tipAmount - discount).toFixed(2));

  const isModified = JSON.stringify(editingItems) !== JSON.stringify(order.order_items);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'items'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Order Items
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === 'history'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Edit History ({editHistory.length})
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {success}
        </div>
      )}

      {activeTab === 'items' && (
        <div className="space-y-4">
          <div className="space-y-3">
            {editingItems.map((item, _index) => {
              const product = Array.isArray(item.products) ? item.products[0] : item.products;
              const _isEditing = _editingItemId === item.id;

              if (!product) {
                return (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Product not found</h4>
                        <p className="text-xs text-gray-500 mt-1">Product ID: {item.product_id}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-600 hover:text-red-900 font-medium text-sm whitespace-nowrap ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{product.name}</h4>
                      <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                        <p>
                          Unit: ${parseFloat(item.unit_price.toString()).toFixed(2)} {product.unit}
                          {(item.bottle_price ?? 0) > 0 && ` + $${parseFloat((item.bottle_price ?? 0).toString()).toFixed(2)} bottle`}
                        </p>
                        {(item.bottle_price ?? 0) > 0 && (
                          <p className="text-gray-500">
                            Total per unit: ${(parseFloat(item.unit_price.toString()) + parseFloat((item.bottle_price ?? 0).toString())).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-red-600 hover:text-red-900 font-medium text-sm whitespace-nowrap ml-2"
                    >
                      Remove
                    </button>
                  </div>

                  <div className={`grid gap-3 ${product.scalable ? 'grid-cols-2' : 'grid-cols-2'}`}>
                    {product.scalable ? (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 font-medium mb-1">
                            Final Weight ({product.unit})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={String(item.final_weight ?? item.quantity ?? 0).replace('NaN', '')}
                            onChange={(e) => handleFinalWeightChange(item.id, parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 font-medium mb-1">
                            Final Price
                          </label>
                          <div className="px-2 py-1 border border-gray-300 rounded text-sm bg-gray-50">
                            ${parseFloat(String(item.final_price ?? item.total_price)).toFixed(2)}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs text-gray-600 font-medium mb-1">
                            Quantity (whole units)
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={String(item.quantity ?? 0).replace('NaN', '')}
                            onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value) || 1)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 font-medium mb-1">
                            Total Price
                          </label>
                          <div className="px-2 py-1 border border-gray-300 rounded text-sm bg-gray-50">
                            ${parseFloat(item.total_price.toString()).toFixed(2)}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setShowAddProduct(!showAddProduct)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
          >
            {showAddProduct ? 'Cancel' : '+ Add Product'}
          </button>

          {showAddProduct && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <input
                type="text"
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <p className="text-xs text-gray-600 py-2">No products available</p>
                ) : (
                  filteredProducts.map(product => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-2 border border-gray-200 rounded hover:bg-gray-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-600">
                          ${parseFloat(product.price.toString()).toFixed(2)} {product.unit}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddProduct(product.id, product.scalable ? 1 : 1)}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">GST</span>
              <span className="font-medium">${totals.gst.toFixed(2)}</span>
            </div>
            {totals.pst > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">PST</span>
                <span className="font-medium">${totals.pst.toFixed(2)}</span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="font-medium">${deliveryFee.toFixed(2)}</span>
              </div>
            )}
            {tipAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tip</span>
                <span className="font-medium">${tipAmount.toFixed(2)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount</span>
                <span className="font-medium">-${discount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between text-base font-bold">
              <span>Total</span>
              <span>${newTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSaveChanges}
              disabled={loading || !isModified}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => {
                setEditingItems(order.order_items);
                setError(null);
                setSuccess(null);
              }}
              disabled={!isModified}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          {editHistory.length === 0 ? (
            <p className="text-sm text-gray-600 py-4 text-center">No edit history</p>
          ) : (
            editHistory.map((entry) => (
              <div key={entry.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      {entry.edit_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      By: {entry.edited_user?.first_name} {entry.edited_user?.last_name}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                  <pre className="whitespace-pre-wrap break-words">
                    {JSON.stringify(entry.changes, null, 2)}
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
