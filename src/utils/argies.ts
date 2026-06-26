/**
 * Greek holiday (argies) calculation for legal deadlines
 *
 * Includes:
 * - Kinites Argies (Movable holidays based on Orthodox Easter)
 * - Statheres Argies (Fixed date holidays)
 * - Weekends (Saturdays and Sundays)
 */

import { toISODateString, parseISODate, addDays } from './dateUtils.js';

/**
 * Calculates Orthodox Easter date for a given year using the Meeus Julian algorithm.
 * Returns the date in Gregorian calendar.
 *
 * The algorithm calculates Easter according to the Julian calendar,
 * then converts to Gregorian by adding the calendar offset (13 days for 1900-2099).
 */
export function getOrthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // 3 = March, 4 = April
  const day = ((d + e + 114) % 31) + 1;

  // Create Julian calendar date
  const julianDate = new Date(Date.UTC(year, month - 1, day));

  // Convert from Julian to Gregorian calendar
  // For years 1900-2099, the offset is 13 days
  const gregorianOffset = 13;
  julianDate.setUTCDate(julianDate.getUTCDate() + gregorianOffset);

  return julianDate;
}

/**
 * Returns movable holidays (Kinites Argies) for a given year.
 * These are calculated relative to Orthodox Easter:
 * - Kathara Deftera (Clean Monday): 48 days before Easter
 * - Megali Paraskevi (Good Friday): 2 days before Easter
 * - Deftera tou Pascha (Easter Monday): 1 day after Easter
 * - Agiou Pnefmatos (Pentecost Monday): 50 days after Easter
 */
export function getKinitesArgies(year: number): string[] {
  const easter = getOrthodoxEaster(year);

  return [
    toISODateString(addDays(easter, -48)), // Kathara Deftera
    toISODateString(addDays(easter, -2)), // Megali Paraskevi
    toISODateString(addDays(easter, 1)), // Deftera tou Pascha
    toISODateString(addDays(easter, 50)), // Agiou Pnefmatos
  ];
}

/**
 * Returns fixed holidays (Statheres Argies) for a given year.
 * These occur on the same date every year:
 * - 01-01: New Year's Day (Πρωτοχρονιά)
 * - 01-06: Epiphany (Θεοφάνεια)
 * - 03-25: Greek Independence Day (Εθνική Επέτειος)
 * - 05-01: Labor Day (Εργατική Πρωτομαγιά)
 * - 08-15: Assumption of Mary (Κοίμηση της Θεοτόκου)
 * - 10-03: St. Dionysios - local patron saint (Άγιος Διονύσιος)
 * - 10-28: Ochi Day (Επέτειος του Όχι)
 * - 12-25: Christmas (Χριστούγεννα)
 * - 12-26: Second day of Christmas (Σύναξη Θεοτόκου)
 */
export function getStatheresArgies(year: number): string[] {
  return [
    `${year}-01-01`, // New Year's Day
    `${year}-01-06`, // Epiphany
    `${year}-03-25`, // Greek Independence Day
    `${year}-05-01`, // Labor Day
    `${year}-08-15`, // Assumption of Mary
    `${year}-10-03`, // St. Dionysios (local)
    `${year}-10-28`, // Ochi Day
    `${year}-12-25`, // Christmas
    `${year}-12-26`, // Second day of Christmas
  ];
}

/**
 * Returns all weekend dates (Saturdays and Sundays) in a date range.
 * Both start and end dates are inclusive.
 */
export function getWeekends(startDate: string, endDate: string): string[] {
  const weekends: string[] = [];
  let current = parseISODate(startDate);
  const end = parseISODate(endDate);

  while (current <= end) {
    const dayOfWeek = current.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Sunday = 0, Saturday = 6
      weekends.push(toISODateString(current));
    }
    current = addDays(current, 1);
  }

  return weekends;
}

/**
 * Returns all unique years that fall within a date range.
 */
function getYearsInRange(startDate: string, endDate: string): number[] {
  const startYear = parseInt(startDate.substring(0, 4), 10);
  const endYear = parseInt(endDate.substring(0, 4), 10);

  const years: number[] = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }
  return years;
}

/**
 * Checks if a date string falls within a range (inclusive).
 */
function isInRange(dateStr: string, startDate: string, endDate: string): boolean {
  return dateStr >= startDate && dateStr <= endDate;
}

/**
 * Returns all argies (holidays + weekends) for a date range.
 * Combines:
 * - Kinites Argies (movable holidays based on Orthodox Easter)
 * - Statheres Argies (fixed date holidays)
 * - Weekends (Saturdays and Sundays)
 *
 * @param startDate - Start of range in ISO format (YYYY-MM-DD), inclusive
 * @param endDate - End of range in ISO format (YYYY-MM-DD), inclusive
 * @returns Sorted array of unique holiday dates in ISO format
 */
export function getArgiesForRange(startDate: string, endDate: string): string[] {
  const argiesSet = new Set<string>();

  // Get all years that might have holidays affecting this range
  // Add buffer years for movable holidays that might cross year boundaries
  const years = getYearsInRange(startDate, endDate);

  // Also check adjacent years for movable holidays (Easter can be in March/April)
  const startYear = years[0];
  const endYear = years[years.length - 1];
  const yearsToCheck = [startYear - 1, ...years, endYear + 1];

  // Collect all holidays from relevant years
  for (const year of yearsToCheck) {
    getKinitesArgies(year).forEach((d) => argiesSet.add(d));
    getStatheresArgies(year).forEach((d) => argiesSet.add(d));
  }

  // Add weekends
  getWeekends(startDate, endDate).forEach((d) => argiesSet.add(d));

  // Filter to range and sort
  return [...argiesSet].filter((d) => isInRange(d, startDate, endDate)).sort();
}

/**
 * Calculates the date range needed for a deadline calculation.
 * Includes a buffer to account for potential holiday skipping at the final date.
 *
 * @param start - Reference date in ISO format (YYYY-MM-DD)
 * @param maxDays - Maximum number of days to count
 * @param direction - Whether counting forward or backward
 * @param buffer - Extra days to include for safety (default: 60)
 * @returns Object with startDate and endDate for the range
 */
export function getDateRangeForCalculation(
  start: string,
  maxDays: number,
  direction: 'forward' | 'backward',
  buffer: number = 60
): { startDate: string; endDate: string } {
  const startDateObj = parseISODate(start);
  const totalDays = maxDays + buffer;

  if (direction === 'forward') {
    return {
      startDate: start,
      endDate: toISODateString(addDays(startDateObj, totalDays)),
    };
  } else {
    return {
      startDate: toISODateString(addDays(startDateObj, -totalDays)),
      endDate: start,
    };
  }
}
