/**
 * Date calculation for legal deadlines with holidays and suspension periods
 */

export interface ArgiesAndAnastoli {
  argies: string[];
  anastoli: string[];
}

export interface DateCalculationOptions {
  direction: 'forward' | 'backward';
  countBehavior: 'standard' | 'workingDaysOnly';
  argiesAndAnastoli: ArgiesAndAnastoli;
}

export interface DateCalculationResult {
  date: string;
  paused: string[];
  skipped: string[];
}

/**
 * Converts a Date object to ISO format string (YYYY-MM-DD) in UTC
 */
function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parses an ISO date string to a Date object at midnight UTC
 */
function parseISODate(dateStr: string): Date {
  const date = new Date(dateStr + 'T00:00:00.000Z');
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD.`);
  }
  return date;
}

/**
 * Adds or subtracts days from a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setTime(result.getTime() + days * 24 * 60 * 60 * 1000);
  return result;
}

/**
 * Calculates legal deadlines accounting for holidays and suspension periods.
 *
 * @param start - Reference date in ISO format (YYYY-MM-DD). Excluded from count.
 * @param noOfDays - Number of days to add/subtract (must be >= 0)
 * @param options - Calculation options including direction, count behavior, and non-working dates
 * @returns Object containing final date, paused dates, and skipped dates
 *
 * @example
 * // Forward direction with standard behavior
 * getDateCalculation('2024-01-15', 10, {
 *   direction: 'forward',
 *   countBehavior: 'standard',
 *   argiesAndAnastoli: {
 *     argies: ['2024-01-20', '2024-01-21'],
 *     anastoli: ['2024-01-22', '2024-01-23', '2024-01-24']
 *   }
 * });
 */
export function getDateCalculation(
  start: string,
  noOfDays: number,
  options: DateCalculationOptions
): DateCalculationResult {
  // Validation
  if (noOfDays < 0) {
    throw new Error('noOfDays must be >= 0');
  }

  // Special case: zero days returns start date
  if (noOfDays === 0) {
    return {
      date: start,
      paused: [],
      skipped: []
    };
  }

  const { direction, countBehavior, argiesAndAnastoli } = options;
  const { argies, anastoli } = argiesAndAnastoli;

  // Validate all dates
  parseISODate(start);
  argies.forEach(d => parseISODate(d));
  anastoli.forEach(d => parseISODate(d));

  // Create sets for O(1) lookup
  const argiesSet = new Set(argies);
  const anastoliSet = new Set(anastoli);

  // Determine which dates pause the counter
  const pauseSet = countBehavior === 'standard'
    ? anastoliSet
    : new Set([...argies, ...anastoli]);

  // Step direction
  const step = direction === 'forward' ? 1 : -1;

  // Phase 1: Count days while avoiding pause dates
  let dt = parseISODate(start);
  const arr: string[] = [];
  const paused: string[] = [];
  let i = 0;

  while (i < noOfDays) {
    dt = addDays(dt, step);
    const dateStr = toISODateString(dt);

    if (!pauseSet.has(dateStr)) {
      arr.push(dateStr);
      i++;
    } else {
      paused.push(dateStr);
    }
  }

  // Phase 2: Handle holidays on final date
  let lastDay = arr[arr.length - 1];
  const skipped: string[] = [];
  let lastDayDate = parseISODate(lastDay);

  if (countBehavior === 'standard') {
    // In standard mode, Phase 1 skipped anastoli, so lastDay cannot be anastoli
    if (anastoliSet.has(lastDay)) {
      throw new Error('Invalid state: final date landed on anastoli');
    }

    // Skip over argies
    while (argiesSet.has(lastDay)) {
      skipped.push(lastDay);
      lastDayDate = addDays(lastDayDate, step);
      lastDay = toISODateString(lastDayDate);
      arr.push(lastDay);
    }
  } else {
    // In workingDaysOnly mode, Phase 1 skipped both argies and anastoli
    if (argiesSet.has(lastDay) || anastoliSet.has(lastDay)) {
      throw new Error('Invalid state: final date landed on non-working day');
    }
  }

  return {
    date: lastDay,
    paused,
    skipped
  };
}
