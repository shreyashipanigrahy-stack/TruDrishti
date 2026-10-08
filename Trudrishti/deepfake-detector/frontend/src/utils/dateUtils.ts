/**
 * Utility functions for handling and formatting dates in Indian Standard Time (IST).
 */

/**
 * Parses an ISO-like timestamp from the backend (which is in UTC but may lack the 'Z' suffix)
 * and returns a Date object.
 */
export const parseUTC = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  let s = dateStr;
  // If it doesn't end with Z or a timezone offset like +05:30 or -00:00, and is ISO-like, append 'Z'
  if (!/[zZ]$/.test(s) && !/[-+]\d{2}:\d{2}$/.test(s)) {
    s = s + 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Formats a date string or Date object to a user-friendly IST string.
 * Example output: "Jun 17, 2026, 11:29 AM"
 */
export const formatToIST = (dateOrStr: Date | string | null | undefined): string => {
  if (!dateOrStr) return 'N/A';
  const date = typeof dateOrStr === 'string' ? parseUTC(dateOrStr) : dateOrStr;
  if (!date) return 'N/A';

  try {
    return date.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    // Fallback if Intl timeZone is not supported
    return date.toLocaleString();
  }
};

/**
 * Formats a Date object or string as a 'YYYY-MM-DD' date string in the IST timezone.
 * Used for date filtering.
 */
export const getLocalDateStringIST = (dateOrStr: Date | string | null | undefined): string => {
  if (!dateOrStr) return '';
  const date = typeof dateOrStr === 'string' ? parseUTC(dateOrStr) : dateOrStr;
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch (e) {
    // Fallback if en-CA or timezone option is not supported
    return date.toISOString().split('T')[0];
  }
};
