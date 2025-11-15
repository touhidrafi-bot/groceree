'use client';

import { useState } from 'react';
import AdminOrders from './AdminOrders';
import AdminProducts from './AdminProducts';
import AdminUsers from './AdminUsers';
import AdminReports from './AdminReports';
import AdminDeliverySchedule from './AdminDeliverySchedule';
import AdminPromoCodes from './AdminPromoCodes';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('orders');

  const tabs = [
    { id: 'orders', name: 'Orders', icon: 'ri-shopping-bag-line' },
    { id: 'products', name: 'Products', icon: 'ri-box-line' },
    { id: 'users', name: 'Users', icon: 'ri-user-line' },
    { id: 'promo', name: 'Promo Codes', icon: 'ri-coupon-2-line' },
    { id: 'delivery', name: 'Delivery Schedule', icon: 'ri-calendar-line' },
    { id: 'reports', name: 'Reports', icon: 'ri-bar-chart-line' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'orders':
        return <AdminOrders />;
      case 'products':
        return <AdminProducts />;
      case 'users':
        return <AdminUsers />;
      case 'promo':
        return <AdminPromoCodes />;
      case 'delivery':
        return <AdminDeliverySchedule />;
      case 'reports':
        return <AdminReports />;
      default:
        return <AdminOrders />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              tab.id === 'products' ? (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab('products')}
                  className={`flex items-center space-x-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'products'
                      ? 'border-green-600 text-green-600 bg-green-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-shopping-basket-line"></i>
                  </div>
                  <span>Products</span>
                </button>
              ) : (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-green-600 text-green-600 bg-green-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className={tab.icon}></i>
                  </div>
                  <span>{tab.name}</span>
                </button>
              )
            ))}
          </div>
        </div>

        {/* Content */}
        {renderContent()}
      </div>
    </div>
  );
}
