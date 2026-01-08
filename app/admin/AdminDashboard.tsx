"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  RiShoppingBagLine,
  RiTBoxLine,
  RiUserLine,
  RiCoupon2Line,
  RiGiftLine,
  RiCalendarLine,
  RiBarChartLine,
  RiMenu3Line,
  RiCloseLine,
} from "react-icons/ri";
import AdminSettings from "../../components/admin/AdminSettings";

// Dynamic imports for heavy admin pages (lazy)
const AdminOrders = lazy(() => import("./AdminOrders"));
const AdminProducts = lazy(() => import("./AdminProducts"));
const AdminUsers = lazy(() => import("./AdminUsers"));
const AdminReports = lazy(() => import("./AdminReports"));
const AdminDeliverySchedule = lazy(() => import("./AdminDeliverySchedule"));
const AdminPromoCodes = lazy(() => import("./AdminPromoCodes"));

type Tab = {
  id: string;
  name: string;
  icon: JSX.Element;
};

const tabs: Tab[] = [
  { id: "orders", name: "Orders", icon: <RiShoppingBagLine /> },
  { id: "products", name: "Products", icon: <RiTBoxLine /> },
  { id: "users", name: "Users", icon: <RiUserLine /> },
  { id: "promo", name: "Promo Codes", icon: <RiCoupon2Line /> },
  { id: "deals", name: "Weekly Deals", icon: <RiGiftLine /> },
  { id: "delivery", name: "Delivery Schedule", icon: <RiCalendarLine /> },
  { id: "reports", name: "Reports", icon: <RiBarChartLine /> },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<string>("orders");
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Preload lazy admin modules to reduce Suspense/loading flicker when switching tabs
  useEffect(() => {
    const preloads = [
      import("./AdminOrders"),
      import("./AdminProducts"),
      import("./AdminUsers"),
      import("./AdminReports"),
      import("./AdminDeliverySchedule"),
      import("./AdminPromoCodes"),
    ];

    preloads.forEach((p) => p.catch(() => {}));
  }, []);

  useEffect(() => {
  if (typeof document === "undefined") return;

  const el = document.scrollingElement || document.documentElement;

  setTimeout(() => {
    el.scrollTo({ top: 0, behavior: "auto" });
  }, 5);
}, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case "orders":
        return <AdminOrders />;
      case "products":
        return <AdminProducts />;
      case "users":
        return <AdminUsers />;
      case "promo":
        return <AdminPromoCodes />;
      case "deals":
        return (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <div className="flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Weekly Deals Manager
                </h3>
                <p className="text-gray-600 mb-4">
                  Create, edit, and schedule weekly deals. Upload images, set
                  prices, and control active dates.
                </p>
                <div className="flex gap-3">
                  <Link
                    href="/admin/weekly-deals"
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition"
                  >
                    Manage Weekly Deals
                  </Link>
                  <Link
                    href="/admin/weekly-deals?create=true"
                    className="inline-flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    New Deal
                  </Link>
                </div>
              </div>

              <div className="w-48 h-32 rounded-lg overflow-hidden shadow-inner bg-gray-50">
                {/* Using your uploaded file path as the image URL in dev */}
                <Image
                  src="/mnt/data/2e0f5069-bfcc-4ae3-9edd-b76a8258f85c.png"
                  alt="Weekly deals"
                  width={320}
                  height={200}
                  className="object-cover w-full h-full"
                />
              </div>
            </div>
          </div>
        );
      case "delivery":
        return <AdminDeliverySchedule />;
      case "reports":
        return <AdminReports />;
      default:
        return <AdminOrders />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              className="lg:hidden p-2 rounded-md bg-white shadow-sm flex-shrink-0"
              onClick={() => setMobileOpen((s) => !s)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <RiCloseLine /> : <RiMenu3Line />}
            </button>

            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 truncate">
                Admin Dashboard
              </h1>
              <span className="hidden sm:inline text-xs sm:text-sm text-gray-500">Groceree</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="hidden sm:block text-xs sm:text-sm text-gray-600 whitespace-nowrap">Signed in as Admin</div>
            <Link
              href="/"
              className="text-xs sm:text-sm bg-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-md border border-gray-200 hover:shadow-sm whitespace-nowrap"
            >
              View Store
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 lg:gap-6">
          {/* Sidebar */}
          <aside
            className={`hidden lg:block ${
              collapsed ? "w-20" : "w-[260px]"
            } transition-all duration-300`}
          >
            <div
              className={`h-full bg-gradient-to-br from-white/60 to-green-50/30 border border-gray-100 rounded-2xl p-3 shadow-sm sticky top-6`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow">
                    <Image
                      src="images/logo-favicon.jfif"
                        alt="Groceree Logo"
                          width={160}
                            height={40}
                              priority
                              />
                  </div>
                  {!collapsed && (
                    <div>
                      <div className="text-sm font-bold text-gray-900">
                        Groceree Admin
                      </div>
                      <div className="text-xs text-gray-500">Management</div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setCollapsed((s) => !s)}
                  className="p-2 rounded-md hover:bg-gray-100"
                  aria-label="Collapse sidebar"
                >
                  {collapsed ? "»" : "‹"}
                </button>
              </div>

              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`group w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        active
                          ? "bg-white text-green-600 shadow-sm"
                          : "text-gray-600 hover:bg-white/60"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          active ? "bg-green-50" : "bg-transparent"
                        }`}
                      >
                        <span className="text-xl">{tab.icon}</span>
                      </div>

                      {!collapsed && (
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">
                            {tab.name}
                          </div>
                        </div>
                      )}

                      {!collapsed && (
                        <div className="text-xs text-gray-400">
                          {active ? "Active" : ""}
                        </div>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-6 pt-4 border-t border-gray-100">
                {!collapsed && (
                  <div className="text-xs text-gray-500">
                    Tip: Use keyboard shortcuts to move faster
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Mobile drawer */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.aside
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white p-4 rounded-r-xl shadow-xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Image
                    src="/images/logo-favicon.jfif"
                    alt="icon"
                    width={24}   // must provide width
                    height={24}  // must provide height
                    className="w-6 h-6"
                    />
                    <div>
                      <div className="text-sm font-bold">Groceree</div>
                      <div className="text-xs text-gray-500">
                        Admin Panel
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close"
                    className="p-2 rounded-md hover:bg-gray-100"
                  >
                    <RiCloseLine />
                  </button>
                </div>

                <nav className="space-y-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setMobileOpen(false);
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-100"
                    >
                      <span className="text-xl">{tab.icon}</span>
                      <span className="text-sm font-medium">{tab.name}</span>
                    </button>
                  ))}
                </nav>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Main content */}
          <main>
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 truncate">
                    {tabs.find((t) => t.id === activeTab)?.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    Manage {tabs.find((t) => t.id === activeTab)?.name.toLowerCase()} and settings
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <button className="bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md border border-gray-200 hover:shadow-sm text-xs sm:text-sm whitespace-nowrap">
                    Export CSV
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md border border-gray-200 hover:shadow-sm text-xs sm:text-sm whitespace-nowrap"
                  >
                    Settings
                  </button>
                </div>
              </div>
            </div>

            <div>
              <Suspense fallback={
                <div className="bg-white rounded-lg p-6 border border-gray-100 shadow">
                  <div className="flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                    Loading {tabs.find((t) => t.id === activeTab)?.name}...
                  </div>
                </div>
              }>
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {renderContent()}
                </motion.div>
              </Suspense>
            </div>
          </main>
        </div>
      </div>

      <AdminSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
