/**
 * Anastoli (summer suspension) calculation for civil court deadlines
 */

import { toISODateString, parseISODate, addDays } from './dateUtils';

/**
 * Returns anastoli dates for civil cases within a date range.
 *
 * Standard (dimosio=false): August 1–31 each year.
 * Dimosio (dimosio=true): July 1–31 + August 1–31 + September 1–15 each year.
 */
export function getCivilAnastoliForRange(
  startDate: string,
  endDate: string,
  dimosio?: boolean
): string[] {
  const anastoli: string[] = [];
  const startYear = parseInt(startDate.substring(0, 4), 10);
  const endYear = parseInt(endDate.substring(0, 4), 10);

  for (let year = startYear; year <= endYear; year++) {
    // const periods: Array<[string, string]> = dimosio
    //   ? [
    //       [`${year}-07-01`, `${year}-07-31`],
    //       [`${year}-08-01`, `${year}-08-31`],
    //       [`${year}-09-01`, `${year}-09-15`],
    //     ]
    //   : [[`${year}-08-01`, `${year}-08-31`]];
      const periods = [[`${year}-08-01`, `${year}-08-31`]]

    for (const [periodStart, periodEnd] of periods) {
      let current = parseISODate(periodStart);
      const end = parseISODate(periodEnd);

      while (current <= end) {
        const dateStr = toISODateString(current);
        if (dateStr >= startDate && dateStr <= endDate) {
          anastoli.push(dateStr);
        }
        current = addDays(current, 1);
      }
    }
  }

  return anastoli;
}
