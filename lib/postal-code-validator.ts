/**
 * Lower Mainland BC Postal Code Validator
 * Validates postal codes and checks if they belong to Lower Mainland BC
 */

// Valid postal code prefixes for Lower Mainland BC
const LOWER_MAINLAND_PREFIXES = [
  'V0N', // Whistler area
  'V2S', 'V2T', 'V2U', 'V2V', 'V2W', 'V2X', 'V2Y', 'V2Z', // Chilliwack area
  'V3A', 'V3B', 'V3C', 'V3G', 'V3H', 'V3J', 'V3K', 'V3L', 'V3M', 'V3N', 'V3R', 'V3S', 'V3T', 'V3V', 'V3W', 'V3X', 'V3Y', 'V3Z', // Interior BC (expanded range)
  'V4A', 'V4B', 'V4C', 'V4E', 'V4G', 'V4H', 'V4J', 'V4K', 'V4L', 'V4M', 'V4N', 'V4P', 'V4R', 'V4S', 'V4T', 'V4V', 'V4W', 'V4X', 'V4Y', 'V4Z', // Abbotsford/Mission area
  'V5A', 'V5B', 'V5C', 'V5E', 'V5G', 'V5H', 'V5J', 'V5K', 'V5L', 'V5M', 'V5N', 'V5P', 'V5R', 'V5S', 'V5T', 'V5V', 'V5W', 'V5X', 'V5Y', 'V5Z', // Vancouver area
  'V6A', 'V6B', 'V6C', 'V6E', 'V6G', 'V6H', 'V6J', 'V6K', 'V6L', 'V6M', 'V6N', 'V6P', 'V6R', 'V6S', 'V6T', 'V6V', 'V6W', 'V6X', 'V6Y', 'V6Z', // Greater Vancouver area
  'V7A', 'V7G', 'V7H', 'V7J', 'V7K', 'V7L', 'V7M', 'V7N', 'V7P', 'V7R', 'V7S', 'V7T', 'V7V', 'V7W', 'V7X', 'V7Y', 'V7Z', // North Shore/Burnaby area
  'V8B', // Victoria area (limited service)
  'V9B', 'V9C', 'V9E', 'V9G', 'V9H', 'V9J', 'V9K', 'V9L', 'V9M', 'V9N', 'V9P', 'V9R' // Island area (limited service)
];

export interface PostalCodeValidation {
  isValid: boolean;
  normalized: string;
  isLowerMainland: boolean;
  message: string;
}

/**
 * Normalize postal code: remove spaces/hyphens, convert to uppercase
 * @param postalCode Raw postal code input
 * @returns Normalized postal code
 */
export function normalizePostalCode(postalCode: string): string {
  return postalCode.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Validate Canadian postal code format
 * Format: A1A 1A1 or A1A1A1 (letter, digit, letter, digit, letter, digit)
 * @param postalCode Postal code to validate
 * @returns true if format is valid
 */
export function isValidPostalCodeFormat(postalCode: string): boolean {
  const normalizedCode = normalizePostalCode(postalCode);
  const pattern = /^[A-Z]\d[A-Z]\d[A-Z]\d$/;
  return pattern.test(normalizedCode);
}

/**
 * Check if postal code belongs to Lower Mainland BC
 * @param postalCode Normalized postal code
 * @returns true if it's in Lower Mainland BC
 */
export function isLowerMainlandBC(postalCode: string): boolean {
  const normalized = normalizePostalCode(postalCode);
  const prefix = normalized.substring(0, 3);
  return LOWER_MAINLAND_PREFIXES.includes(prefix);
}

/**
 * Main validation function
 * @param postalCode User input postal code
 * @returns Validation result object
 */
export function validatePostalCode(postalCode: string): PostalCodeValidation {
  if (!postalCode || !postalCode.trim()) {
    return {
      isValid: false,
      normalized: '',
      isLowerMainland: false,
      message: 'Please enter a postal code'
    };
  }

  const normalized = normalizePostalCode(postalCode);

  if (!isValidPostalCodeFormat(normalized)) {
    return {
      isValid: false,
      normalized,
      isLowerMainland: false,
      message: 'Invalid postal code format.'
    };
  }

  const isLowerMainland = isLowerMainlandBC(normalized);

  return {
    isValid: true,
    normalized,
    isLowerMainland,
    message: isLowerMainland
      ? 'Delivery available to your area!'
      : 'Delivery is not available to this postal code.'
  };
}

/**
 * Get next available delivery time based on current time
 * @returns Next available delivery time string
 */
export function getNextAvailableDeliveryTime(): {
  isToday: boolean;
  timeSlot: string;
  date: string;
} {
  // Use Vancouver timezone
  const now = new Date();
  const vancouverTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
  
  const hour = vancouverTime.getHours();
  const minute = vancouverTime.getMinutes();
  const currentTimeInMinutes = hour * 60 + minute;
  
  // Cutoff time for same-day delivery: 1:00 PM (13:00)
  const CUTOFF_TIME = 13 * 60; // 13:00 in minutes
  
  const deliverySlots = [
    { name: '11:00 AM - 3:00 PM', startHour: 11 },
    { name: '3:00 PM - 7:00 PM', startHour: 15 },
    { name: '7:00 PM - 11:00 PM', startHour: 19 }
  ];
  
  // Check if we can still deliver today
  if (currentTimeInMinutes < CUTOFF_TIME) {
    // Find first available slot today that hasn't started yet
    for (const slot of deliverySlots) {
      if (hour < slot.startHour) {
        return {
          isToday: true,
          timeSlot: slot.name,
          date: 'Today'
        };
      }
    }
  }
  
  // If no slots available today, use first slot tomorrow
  const tomorrow = new Date(vancouverTime);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowFormatted = tomorrow.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
  
  return {
    isToday: false,
    timeSlot: deliverySlots[0].name, // First slot of the day
    date: tomorrowFormatted
  };
}
