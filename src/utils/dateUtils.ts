/**
 * Shared date utility functions for legal deadline calculations
 */

/**
 * Converts a Date object to ISO format string (YYYY-MM-DD) in UTC
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parses an ISO date string to a Date object at midnight UTC
 */
export function parseISODate(dateStr: string): Date {
  const date = new Date(dateStr + 'T00:00:00.000Z');
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD.`);
  }
  return date;
}

/**
 * Adds or subtracts days from a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setTime(result.getTime() + days * 24 * 60 * 60 * 1000);
  return result;
}
