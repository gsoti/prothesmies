import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getCivilAnastoliForRange } from './anastoli-civil';

const dateArb = fc.record({
  year: fc.integer({ min: 2020, max: 2030 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
}).map(({ year, month, day }) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const dateRangeArb = fc.tuple(dateArb, dateArb)
  .map(([a, b]) => a <= b ? [a, b] : [b, a]);

describe('getCivilAnastoliForRange (standard)', () => {
  it('all returned dates are within the requested range', () => {
    fc.assert(
      fc.property(dateRangeArb, ([startDate, endDate]) => {
        const result = getCivilAnastoliForRange(startDate, endDate);
        return result.every(d => d >= startDate && d <= endDate);
      })
    );
  });

  it('all returned dates are in August', () => {
    fc.assert(
      fc.property(dateRangeArb, ([startDate, endDate]) => {
        const result = getCivilAnastoliForRange(startDate, endDate);
        return result.every(d => parseInt(d.slice(5, 7), 10) === 8);
      })
    );
  });

  it('returns no duplicates', () => {
    fc.assert(
      fc.property(dateRangeArb, ([startDate, endDate]) => {
        const result = getCivilAnastoliForRange(startDate, endDate);
        return new Set(result).size === result.length;
      })
    );
  });

  it('returns dates in sorted order', () => {
    fc.assert(
      fc.property(dateRangeArb, ([startDate, endDate]) => {
        const result = getCivilAnastoliForRange(startDate, endDate);
        return result.every((d, i) => i === 0 || d > result[i - 1]);
      })
    );
  });

  it('returns exactly 31 dates when range fully covers one year', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2020, max: 2030 }), (year) => {
        const result = getCivilAnastoliForRange(`${year}-01-01`, `${year}-12-31`);
        return result.length === 31;
      })
    );
  });

  it('returns empty array when range is outside August', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2020, max: 2030 }), (year) => {
        const before = getCivilAnastoliForRange(`${year}-01-01`, `${year}-07-31`);
        const after = getCivilAnastoliForRange(`${year}-09-01`, `${year}-12-31`);
        return before.length === 0 && after.length === 0;
      })
    );
  });
});

describe('getCivilAnastoliForRange (dimosio=true)', () => {
  it('all returned dates are within the requested range', () => {
    fc.assert(
      fc.property(dateRangeArb, ([startDate, endDate]) => {
        const result = getCivilAnastoliForRange(startDate, endDate, true);
        return result.every(d => d >= startDate && d <= endDate);
      })
    );
  });

  it('all returned dates are in July, August, or Sept 1–15', () => {
    fc.assert(
      fc.property(dateRangeArb, ([startDate, endDate]) => {
        const result = getCivilAnastoliForRange(startDate, endDate, true);
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
        const result = getCivilAnastoliForRange(startDate, endDate, true);
        return new Set(result).size === result.length;
      })
    );
  });

  it('returns dates in sorted order', () => {
    fc.assert(
      fc.property(dateRangeArb, ([startDate, endDate]) => {
        const result = getCivilAnastoliForRange(startDate, endDate, true);
        return result.every((d, i) => i === 0 || d > result[i - 1]);
      })
    );
  });

  it('returns exactly 31 dates when range fully covers one year', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2020, max: 2030 }), (year) => {
        const result = getCivilAnastoliForRange(`${year}-01-01`, `${year}-12-31`, true);
        return result.length === 31;
      })
    );
  });

  it('always includes August regardless of dimosio flag', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2020, max: 2030 }), (year) => {
        const standard = getCivilAnastoliForRange(`${year}-01-01`, `${year}-12-31`);
        const dimosio = getCivilAnastoliForRange(`${year}-01-01`, `${year}-12-31`, true);
        return standard.every(d => dimosio.includes(d));
      })
    );
  });

  it('returns empty array when range is outside suspension periods', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2020, max: 2030 }), (year) => {
        const before = getCivilAnastoliForRange(`${year}-01-01`, `${year}-06-30`, true);
        const after = getCivilAnastoliForRange(`${year}-09-16`, `${year}-12-31`, true);
        return before.length === 0 && after.length === 0;
      })
    );
  });
});
