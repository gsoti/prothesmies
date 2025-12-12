import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getDateCalculation } from './dateCalculation';

/**
 * Converts a day offset from epoch to ISO date string
 */
function dayOffsetToISODate(dayOffset: number): string {
  const date = new Date(dayOffset * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
}

// Day offsets for date range (2020-01-01 to 2030-12-31)
const MIN_DAY = Math.floor(new Date('2020-01-01T00:00:00.000Z').getTime() / (24 * 60 * 60 * 1000));
const MAX_DAY = Math.floor(new Date('2030-12-31T00:00:00.000Z').getTime() / (24 * 60 * 60 * 1000));

/**
 * Generates a date arbitrary that produces ISO date strings (YYYY-MM-DD)
 * within a reasonable range (2020-2030)
 */
const dateArbitrary = fc
  .integer({ min: MIN_DAY, max: MAX_DAY })
  .map(dayOffsetToISODate);

/**
 * Generates an array of unique date strings for holidays/suspension periods
 * Limited to avoid blocking all possible dates
 */
const dateArrayArbitrary = fc
  .uniqueArray(fc.integer({ min: MIN_DAY, max: MAX_DAY }), { maxLength: 30 })
  .map((offsets) => offsets.map(dayOffsetToISODate).sort());

describe('getDateCalculation property-based tests', () => {
  it('round-trip: forward then backward returns original start date (workingDaysOnly)', () => {
    fc.assert(
      fc.property(
        dateArbitrary,
        fc.integer({ min: 1, max: 100 }),
        dateArrayArbitrary,
        dateArrayArbitrary,
        (startDate, noOfDays, argies, anastoli) => {
          // Filter out start date from argies and anastoli to ensure valid round-trip
          // (start date is excluded from counting, so if it's in a blocked period,
          // the backward calculation would skip over it)
          const filteredArgies = argies.filter((d) => d !== startDate);
          const filteredAnastoli = anastoli.filter((d) => d !== startDate);

          const options = {
            countBehavior: 'workingDaysOnly' as const,
            argiesAndAnastoli: {
              argies: filteredArgies,
              anastoli: filteredAnastoli,
            },
          };

          // Calculate forward from start date
          const forwardResult = getDateCalculation(startDate, noOfDays, {
            ...options,
            direction: 'forward',
          });

          // Calculate backward from the forward result
          const backwardResult = getDateCalculation(forwardResult.date, noOfDays, {
            ...options,
            direction: 'backward',
          });

          // Should return to the original start date
          expect(backwardResult.date).toBe(startDate);
        }
      ),
      { numRuns: 1000 }
    );
  });
});
