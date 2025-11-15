
'use client';

import { useEffect } from 'react';

interface CartNotificationProps {
  message: string;
  onClose: () => void;
}

export default function CartNotification({ message, onClose }: CartNotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-20 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in">
      <div className="w-5 h-5 flex items-center justify-center">
        <i className="ri-check-line text-lg"></i>
      </div>
      <span className="font-medium">{message}</span>
      <button
        onClick={onClose}
        className="p-1 hover:bg-green-700 rounded cursor-pointer"
      >
        <div className="w-4 h-4 flex items-center justify-center">
          <i className="ri-close-line"></i>
        </div>
      </button>
    </div>
  );
}
