/**
 * Lower Mainland BC Postal Code Validator
 * Validates postal codes and checks if they belong to Lower Mainland BC
 */

// Valid postal code prefixes for Lower Mainland BC
const LOWER_MAINLAND_PREFIXES = [
  'V5C', 'V5G', 'V5H', 'V5K', 'V5L', 'V5M', 'V5N', 'V5P', 'V5R', 'V5S', 'V5T', 'V5V', 'V5W', 'V5X', 'V5Y', 'V5Z', // Vancouver area
  'V6A', 'V6B', 'V6C', 'V6E', 'V6G', 'V6H', 'V6J', 'V6K', 'V6L', 'V6M', 'V6N', 'V6P', 'V6R', 'V6S', 'V6T', 'V6X', 'V6Z', // Greater Vancouver area
  'V7X', 'V7Y', // North Shore/Burnaby area
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
 * @param cutoffTimeStr Cutoff time in HH:MM:SS format (e.g., "13:00:00"). Defaults to "13:00:00" (1:00 PM)
 * @returns Next available delivery time string
 */
export function getNextAvailableDeliveryTime(cutoffTimeStr: string = '13:00:00'): {
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

  // Parse cutoff time
  const [cutoffHour, cutoffMinute] = cutoffTimeStr.split(':').map(Number);
  const CUTOFF_TIME = cutoffHour * 60 + cutoffMinute;
  
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
