/**
 * Anastoli (summer suspension) calculation for administrative court deadlines
 */

import { toISODateString, parseISODate, addDays } from './dateUtils.js';

/**
 * Returns all dates in the anastoli (summer suspension) period within a date range.
 * Anastoli runs from July 1 to September 15 (inclusive) of each year.
 *
 * @param startDate - Start of range in ISO format (YYYY-MM-DD), inclusive
 * @param endDate - End of range in ISO format (YYYY-MM-DD), inclusive
 * @returns Array of anastoli dates in ISO format
 */
export function getAnastoliForRange(startDate: string, endDate: string): string[] {
  const anastoli: string[] = [];
  const startYear = parseInt(startDate.substring(0, 4), 10);
  const endYear = parseInt(endDate.substring(0, 4), 10);

  for (let year = startYear; year <= endYear; year++) {
    let current = parseISODate(`${year}-07-01`);
    const end = parseISODate(`${year}-09-15`);

    while (current <= end) {
      const dateStr = toISODateString(current);
      // Only include if within the requested range
      if (dateStr >= startDate && dateStr <= endDate) {
        anastoli.push(dateStr);
      }
      current = addDays(current, 1);
    }
  }

  return anastoli;
}
