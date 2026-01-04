import { describe, it } from 'vitest';
import fc from 'fast-check';
import { getAnastoliForRange } from './anastoli-admin';

describe('getAnastoliForRange property-based tests', () => {
  // Helper to generate valid date strings using year/month/day components
  const dateArb = fc.record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid dates
  }).map(({ year, month, day }) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  );

  // Generate ordered date pairs (startDate <= endDate)
  const dateRangeArb = fc.tuple(dateArb, dateArb)
    .map(([a, b]) => a <= b ? [a, b] : [b, a]);

  it('all returned dates are within the requested range', () => {
    fc.assert(
      fc.property(dateRangeArb, ([startDate, endDate]) => {
        const result = getAnastoliForRange(startDate, endDate);
        return result.every(d => d >= startDate && d <= endDate);
      })
    );
  });

  it('all returned dates are within July 1 - September 15', () => {
    fc.assert(
      fc.property(dateRangeArb, ([startDate, endDate]) => {
        const result = getAnastoliForRange(startDate, endDate);
        return result.every(d => {
          const month = parseInt(d.slice(5, 7), 10);
          const day = parseInt(d.slice(8, 10), 10);
          if (month === 7 || month === 8) return true;
          if (month === 9 && day <= 15) return true;
          return false;
        });
      })
    );
  });

  it('returns no duplicates', () => {
    fc.assert(
      fc.property(dateRangeArb, ([startDate, endDate]) => {
        const result = getAnastoliForRange(startDate, endDate);
        return new Set(result).size === result.length;
      })
    );
  });

  it('returns dates in sorted order', () => {
    fc.assert(
      fc.property(dateRangeArb, ([startDate, endDate]) => {
        const result = getAnastoliForRange(startDate, endDate);
        return result.every((d, i) => i === 0 || d > result[i - 1]);
      })
    );
  });

  it('returns exactly 77 dates when range fully covers one anastoli period', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2030 }),
        (year) => {
          const result = getAnastoliForRange(`${year}-01-01`, `${year}-12-31`);
          return result.length === 77; // 31 (July) + 31 (August) + 15 (Sept 1-15)
        }
      )
    );
  });

  it('returns empty array when range is outside anastoli period', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2030 }),
        (year) => {
          // Test range entirely before July 1
          const beforeResult = getAnastoliForRange(`${year}-01-01`, `${year}-06-30`);
          // Test range entirely after September 15
          const afterResult = getAnastoliForRange(`${year}-09-16`, `${year}-12-31`);
          return beforeResult.length === 0 && afterResult.length === 0;
        }
      )
    );
  });
});
