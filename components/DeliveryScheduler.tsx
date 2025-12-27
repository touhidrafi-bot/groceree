'use client';

import { useState, useEffect } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../lib/auth';

interface DeliverySlot {
  id: string;
  date: string;
  timeSlot: string;
  displayTime: string;
  available: boolean;
  capacity: number;
  used: number;
}

interface DeliverySchedulerProps {
  selectedSlot: DeliverySlot | null;
  onSlotSelect: (slot: DeliverySlot | null) => void;
}

interface DeliverySettings {
  cutoff_time: string | null;
  max_deliveries_per_slot: number | null;
}

interface DeliveryWindow {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  display_name: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  max_deliveries: number | null;
}

function getVancouverDate(offsetDays = 0): string {
  const now = new Date();

  const parts = Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parseInt(parts.find(p => p.type === "year")!.value);
  const month = parseInt(parts.find(p => p.type === "month")!.value);
  const day = parseInt(parts.find(p => p.type === "day")!.value);

  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + offsetDays);

  return base.toISOString().split("T")[0];
}

export default function DeliveryScheduler({ selectedSlot, onSlotSelect }: DeliverySchedulerProps) {
  const [availableSlots, setAvailableSlots] = useState<DeliverySlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [windows, setWindows] = useState<DeliveryWindow[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings && windows.length > 0) {
      generateAvailableSlots();
    }
  }, [settings, windows]);

  const loadSettings = async () => {
    try {
      if (!SUPABASE_CONFIGURED) {
        console.warn('Supabase not configured; using default delivery settings and windows.');
        // Provide sensible defaults and avoid running queries
        setSettings({ cutoff_time: '13:00:00', max_deliveries_per_slot: 15 });
        setWindows([
          { id: '1', name: 'morning', start_time: '11:00:00', end_time: '15:00:00', display_name: '11:00 AM - 3:00 PM', is_active: true, sort_order: 1, max_deliveries: 0 },
          { id: '2', name: 'afternoon', start_time: '15:00:00', end_time: '19:00:00', display_name: '3:00 PM - 7:00 PM', is_active: true, sort_order: 2, max_deliveries: 0 },
          { id: '3', name: 'evening', start_time: '19:00:00', end_time: '23:00:00', display_name: '7:00 PM - 11:00 PM', is_active: true, sort_order: 3, max_deliveries: 0 }
        ]);
        setLoading(false);
        return;
      }
      // Load delivery settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('delivery_settings')
        .select('*')
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error loading settings:', JSON.stringify(settingsError));
        // Use default settings if none exist
        setSettings({ cutoff_time: '13:00:00', max_deliveries_per_slot: 15 });
      } else if (settingsData) {
        setSettings(settingsData);
      }

      // Load delivery windows - Sort by start_time to match admin dashboard
      const { data: windowsData, error: windowsError } = await supabase
        .from('delivery_windows')
        .select('*')
        .eq('is_active', true)
        .order('start_time', { ascending: true });

      if (windowsError) {
        console.error('Error loading windows:', JSON.stringify(windowsError));
        // Use default windows if none exist - sorted by time
        setWindows([
          { id: '1', name: 'morning', start_time: '11:00:00', end_time: '15:00:00', display_name: '11:00 AM - 3:00 PM', is_active: true, sort_order: 1, max_deliveries: 0 },
          { id: '2', name: 'afternoon', start_time: '15:00:00', end_time: '19:00:00', display_name: '3:00 PM - 7:00 PM', is_active: true, sort_order: 2, max_deliveries: 0 },
          { id: '3', name: 'evening', start_time: '19:00:00', end_time: '23:00:00', display_name: '7:00 PM - 11:00 PM', is_active: true, sort_order: 3, max_deliveries: 0 }
        ]);
      } else {
        // Sort windows by start_time to ensure consistent ordering
        const sortedWindows = (windowsData || []).sort((a, b) => {
          return a.start_time.localeCompare(b.start_time);
        });
        setWindows(sortedWindows);
      }
    } catch (error) {
      console.error('Error loading delivery configuration:', error && typeof error === 'object' ? JSON.stringify(error) : String(error));
      // Set defaults
      setSettings({
        cutoff_time: '13:00:00',
        max_deliveries_per_slot: 15
      });
      setWindows([
        {
          id: '1',
          name: 'morning',
          start_time: '11:00:00',
          end_time: '15:00:00',
          display_name: '11:00 AM - 3:00 PM',
          is_active: true,
          sort_order: 1,
          max_deliveries: 0
        },
        {
          id: '2',
          name: 'afternoon',
          start_time: '15:00:00',
          end_time: '19:00:00',
          display_name: '3:00 PM - 7:00 PM',
          is_active: true,
          sort_order: 2,
          max_deliveries: 0
        },
        {
          id: '3',
          name: 'evening',
          start_time: '19:00:00',
          end_time: '23:00:00',
          display_name: '7:00 PM - 11:00 PM',
          is_active: true,
          sort_order: 3,
          max_deliveries: 0
        }
      ]);
    }
  };

  const checkSlotCapacity = async (date: string, timeSlot: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('delivery_date', date)
        .eq('delivery_time_slot', timeSlot)
        .not('status', 'eq', 'cancelled');

      if (error) {
        console.error('Error checking slot capacity:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Error checking slot capacity:', error);
      return 0;
    }
  };

  const generateAvailableSlots = async () => {
    if (!settings || windows.length === 0) return;

    setLoading(true);

    const now = new Date();
    const parts = Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Vancouver",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const hourStr = parts.find(p => p.type === "hour")?.value || "0";
    const minuteStr = parts.find(p => p.type === "minute")?.value || "0";
    const currentHour = parseInt(hourStr);
    const currentMinute = parseInt(minuteStr);

    const slots: DeliverySlot[] = [];

    // Parse cutoff time
    const [cutoffHour, cutoffMinute] = (settings.cutoff_time ?? '13:00:00').split(':').map(Number);
    const cutoffTimeInMinutes = cutoffHour * 60 + cutoffMinute;
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // Check if it's before cutoff time Vancouver time
    const canDeliverToday = currentTimeInMinutes < cutoffTimeInMinutes;

    // Same-day slots (if before cutoff time Vancouver time)
    if (canDeliverToday) {
      const todayStr = getVancouverDate(0);

      // Sort windows by start_time for consistent ordering
      const sortedWindows = [...windows].sort((a, b) => a.start_time.localeCompare(b.start_time));

      for (const window of sortedWindows) {
        const [startHour] = window.start_time.split(':').map(Number);

        // Only show slots that haven't started yet
        if (currentHour < startHour) {
          const timeSlot = `${window.start_time.slice(0,5)}-${window.end_time.slice(0,5)}`;
          const used = await checkSlotCapacity(todayStr, timeSlot);
          const maxCapacity = window.max_deliveries ?? settings.max_deliveries_per_slot ?? 15;

          slots.push({
            id: `${todayStr}-${window.id}`,
            date: todayStr,
            timeSlot: timeSlot,
            displayTime: window.display_name ?? window.name,
            available: used < maxCapacity,
            capacity: maxCapacity,
            used: used
          });
        }
      }
    }

    // Next-day slots
    const tomorrowStr = getVancouverDate(1);

    // Sort windows by start_time for consistent ordering
    const sortedWindows = [...windows].sort((a, b) => a.start_time.localeCompare(b.start_time));

    for (const window of sortedWindows) {
      const timeSlot = `${window.start_time.slice(0,5)}-${window.end_time.slice(0,5)}`;
      const used = await checkSlotCapacity(tomorrowStr, timeSlot);
      const maxCapacity = window.max_deliveries ?? settings.max_deliveries_per_slot ?? 15;

      slots.push({
        id: `${tomorrowStr}-${window.id}`,
        date: tomorrowStr,
        timeSlot: timeSlot,
        displayTime: window.display_name ?? window.name,
        available: used < maxCapacity,
        capacity: maxCapacity,
        used: used
      });
    }

    // Day after tomorrow slots
    const dayAfterStr = getVancouverDate(2);

    for (const window of sortedWindows) {
      const timeSlot = `${window.start_time.slice(0,5)}-${window.end_time.slice(0,5)}`;
      const used = await checkSlotCapacity(dayAfterStr, timeSlot);
      const maxCapacity = window.max_deliveries ?? settings.max_deliveries_per_slot ?? 15;

      slots.push({
        id: `${dayAfterStr}-${window.id}`,
        date: dayAfterStr,
        timeSlot: timeSlot,
        displayTime: window.display_name ?? window.name,
        available: used < maxCapacity,
        capacity: maxCapacity,
        used: used
      });
    }

    setAvailableSlots(slots);

    // Set default selected date
    if (slots.length > 0) {
      setSelectedDate(slots[0].date);
    }

    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const todayStr = getVancouverDate(0);
    const tomorrowStr = getVancouverDate(1);

    if (dateStr === todayStr) {
      return 'Today';
    } else if (dateStr === tomorrowStr) {
      return 'Tomorrow';
    } else {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        timeZone: 'America/Vancouver'
      });
    }
  };

  const uniqueDates = [...new Set(availableSlots.map(slot => slot.date))];
  const slotsForSelectedDate = availableSlots.filter(slot => slot.date === selectedDate);

  const handleSlotSelect = (slot: DeliverySlot) => {
    if (!slot.available) return;
    
    if (selectedSlot?.id === slot.id) {
      onSlotSelect(null);
    } else {
      onSlotSelect(slot);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center space-x-2 mb-6">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-calendar-line text-green-600"></i>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Delivery Schedule</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <span className="ml-3 text-gray-600">Loading available slots...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center space-x-2 mb-6">
        <div className="w-5 h-5 flex items-center justify-center">
          <i className="ri-calendar-line text-green-600"></i>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Delivery Schedule</h2>
      </div>

      {/* Date Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Delivery Date
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {uniqueDates.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => setSelectedDate(date)}
              className={`p-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                selectedDate === date
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-green-300'
              }`}
            >
              {formatDate(date)}
            </button>
          ))}
        </div>
      </div>

      {/* Time Slot Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Time Slot
        </label>
        <div className="space-y-2">
          {slotsForSelectedDate.map((slot) => (
            <button
              key={slot.id}
              type="button"
              onClick={() => handleSlotSelect(slot)}
              disabled={!slot.available}
              className={`w-full p-4 rounded-lg border text-left transition-colors ${
                selectedSlot?.id === slot.id
                  ? 'bg-green-50 border-green-600 text-green-900 cursor-pointer'
                  : slot.available
                  ? 'bg-white border-gray-300 hover:border-green-300 text-gray-700 cursor-pointer'
                  : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-time-line"></i>
                  </div>
                  <div>
                    <span className="font-medium">{slot.displayTime}</span>
                    <div className="text-xs text-gray-500 mt-1">
                      {slot.available 
                        ? `${slot.capacity - slot.used} deliveries available`
                        : 'No deliveries available'
                      }
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!slot.available && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">
                      Full
                    </span>
                  )}
                  {selectedSlot?.id === slot.id && (
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-check-line text-green-600"></i>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedSlot && (
        <div className="mt-6 p-4 bg-green-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-check-circle-line text-green-600"></i>
            </div>
            <span className="text-sm font-medium text-green-900">
              Delivery scheduled for {formatDate(selectedSlot.date)} at {selectedSlot.displayTime}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        <p>• Same-day delivery available for orders placed before {settings ? formatTime(settings.cutoff_time ?? '13:00:00') : '1:00 PM'} (Vancouver time)</p>
        <p>• Next-day delivery for orders placed after {settings ? formatTime(settings.cutoff_time ?? '13:00:00') : '1:00 PM'}</p>
        <p>• Each delivery slot has individual capacity limits set by the store</p>
        <p>• Delivery slots are subject to availability</p>
      </div>
    </div>
  );

  function formatTime(timeString: string) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  }
}
