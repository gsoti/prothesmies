import { describe, it, expect } from 'vitest';
import {
  getOrthodoxEaster,
  getKinitesArgies,
  getStatheresArgies,
  getWeekends,
  getArgiesForRange,
  getDateRangeForCalculation,
} from './argies';

describe('getOrthodoxEaster', () => {
  it('calculates correct Easter dates for known years', () => {
    // Known Orthodox Easter dates (Gregorian calendar)
    const knownEasterDates: Record<number, string> = {
      2020: '2020-04-19',
      2021: '2021-05-02',
      2022: '2022-04-24',
      2023: '2023-04-16',
      2024: '2024-05-05',
      2025: '2025-04-20',
      2026: '2026-04-12',
      2027: '2027-05-02',
    };

    for (const [year, expectedDate] of Object.entries(knownEasterDates)) {
      const easter = getOrthodoxEaster(parseInt(year));
      const easterStr = easter.toISOString().split('T')[0];
      expect(easterStr).toBe(expectedDate);
    }
  });

  it('returns a Date object', () => {
    const easter = getOrthodoxEaster(2024);
    expect(easter).toBeInstanceOf(Date);
  });
});

describe('getKinitesArgies', () => {
  it('returns 4 movable holidays', () => {
    const holidays = getKinitesArgies(2024);
    expect(holidays).toHaveLength(4);
  });

  it('calculates correct movable holidays for 2024', () => {
    // Easter 2024: May 5
    const holidays = getKinitesArgies(2024);

    expect(holidays).toContain('2024-03-18'); // Kathara Deftera (48 days before)
    expect(holidays).toContain('2024-05-03'); // Megali Paraskevi (2 days before)
    expect(holidays).toContain('2024-05-06'); // Deftera tou Pascha (1 day after)
    expect(holidays).toContain('2024-06-24'); // Agiou Pnefmatos (50 days after)
  });

  it('calculates correct movable holidays for 2025', () => {
    // Easter 2025: April 20
    const holidays = getKinitesArgies(2025);

    expect(holidays).toContain('2025-03-03'); // Kathara Deftera
    expect(holidays).toContain('2025-04-18'); // Megali Paraskevi
    expect(holidays).toContain('2025-04-21'); // Deftera tou Pascha
    expect(holidays).toContain('2025-06-09'); // Agiou Pnefmatos
  });

  it('returns dates in ISO format', () => {
    const holidays = getKinitesArgies(2024);
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;

    for (const holiday of holidays) {
      expect(holiday).toMatch(isoRegex);
    }
  });
});

describe('getStatheresArgies', () => {
  it('returns 9 fixed holidays', () => {
    const holidays = getStatheresArgies(2024);
    expect(holidays).toHaveLength(9);
  });

  it('returns correct fixed holidays for 2024', () => {
    const holidays = getStatheresArgies(2024);

    expect(holidays).toContain('2024-01-01'); // New Year
    expect(holidays).toContain('2024-01-06'); // Epiphany
    expect(holidays).toContain('2024-03-25'); // Independence Day
    expect(holidays).toContain('2024-05-01'); // Labor Day
    expect(holidays).toContain('2024-08-15'); // Assumption
    expect(holidays).toContain('2024-10-03'); // St. Dionysios
    expect(holidays).toContain('2024-10-28'); // Ochi Day
    expect(holidays).toContain('2024-12-25'); // Christmas
    expect(holidays).toContain('2024-12-26'); // Second Christmas
  });

  it('uses the correct year in dates', () => {
    const holidays = getStatheresArgies(2030);

    for (const holiday of holidays) {
      expect(holiday.startsWith('2030-')).toBe(true);
    }
  });
});

describe('getWeekends', () => {
  it('returns all Saturdays and Sundays in a range', () => {
    // Week of Jan 1-7, 2024 (Mon-Sun)
    const weekends = getWeekends('2024-01-01', '2024-01-07');

    expect(weekends).toContain('2024-01-06'); // Saturday
    expect(weekends).toContain('2024-01-07'); // Sunday
    expect(weekends).toHaveLength(2);
  });

  it('handles a full month', () => {
    // January 2024 has 4 full weekends + partial
    const weekends = getWeekends('2024-01-01', '2024-01-31');

    // Jan 2024: Sat 6, 13, 20, 27 and Sun 7, 14, 21, 28
    expect(weekends).toHaveLength(8);
    expect(weekends).toContain('2024-01-06');
    expect(weekends).toContain('2024-01-07');
    expect(weekends).toContain('2024-01-13');
    expect(weekends).toContain('2024-01-14');
    expect(weekends).toContain('2024-01-20');
    expect(weekends).toContain('2024-01-21');
    expect(weekends).toContain('2024-01-27');
    expect(weekends).toContain('2024-01-28');
  });

  it('returns empty array for weekday-only range', () => {
    // Mon-Fri Jan 8-12, 2024
    const weekends = getWeekends('2024-01-08', '2024-01-12');
    expect(weekends).toHaveLength(0);
  });

  it('includes start and end dates if they are weekends', () => {
    // Sat-Sun Jan 6-7, 2024
    const weekends = getWeekends('2024-01-06', '2024-01-07');
    expect(weekends).toContain('2024-01-06');
    expect(weekends).toContain('2024-01-07');
  });
});

describe('getArgiesForRange', () => {
  it('combines holidays and weekends', () => {
    const argies = getArgiesForRange('2024-01-01', '2024-01-10');

    // Should include New Year's Day
    expect(argies).toContain('2024-01-01');
    // Should include Epiphany
    expect(argies).toContain('2024-01-06');
    // Should include weekend (Jan 7 is Sunday)
    expect(argies).toContain('2024-01-07');
  });

  it('returns sorted unique dates', () => {
    const argies = getArgiesForRange('2024-01-01', '2024-12-31');

    // Check sorted
    for (let i = 1; i < argies.length; i++) {
      expect(argies[i] > argies[i - 1]).toBe(true);
    }

    // Check unique
    const unique = new Set(argies);
    expect(argies.length).toBe(unique.size);
  });

  it('only includes dates within range', () => {
    const argies = getArgiesForRange('2024-06-01', '2024-06-30');

    for (const date of argies) {
      expect(date >= '2024-06-01').toBe(true);
      expect(date <= '2024-06-30').toBe(true);
    }
  });

  it('includes movable holidays when in range', () => {
    // Easter Monday 2024 is May 6
    const argies = getArgiesForRange('2024-05-01', '2024-05-10');
    expect(argies).toContain('2024-05-06');
  });

  it('handles year boundaries correctly', () => {
    const argies = getArgiesForRange('2023-12-25', '2024-01-06');

    expect(argies).toContain('2023-12-25'); // Christmas 2023
    expect(argies).toContain('2023-12-26'); // Second Christmas 2023
    expect(argies).toContain('2024-01-01'); // New Year 2024
    expect(argies).toContain('2024-01-06'); // Epiphany 2024
  });
});

describe('getDateRangeForCalculation', () => {
  it('calculates forward range correctly', () => {
    const range = getDateRangeForCalculation('2024-01-15', 30, 'forward', 60);

    expect(range.startDate).toBe('2024-01-15');
    // 30 + 60 = 90 days forward from Jan 15 = April 14
    expect(range.endDate).toBe('2024-04-14');
  });

  it('calculates backward range correctly', () => {
    const range = getDateRangeForCalculation('2024-06-15', 30, 'backward', 60);

    expect(range.endDate).toBe('2024-06-15');
    // 30 + 60 = 90 days backward from Jun 15 = March 17
    expect(range.startDate).toBe('2024-03-17');
  });

  it('uses default buffer of 60', () => {
    const range = getDateRangeForCalculation('2024-01-01', 10, 'forward');

    // 10 + 60 = 70 days forward
    expect(range.endDate).toBe('2024-03-11');
  });

  it('allows custom buffer', () => {
    const range = getDateRangeForCalculation('2024-01-01', 10, 'forward', 10);

    // 10 + 10 = 20 days forward
    expect(range.endDate).toBe('2024-01-21');
  });
});

describe('integration: argies for date calculation', () => {
  it('provides complete argies for a typical deadline calculation', () => {
    const { startDate, endDate } = getDateRangeForCalculation('2024-03-01', 30, 'forward');
    const argies = getArgiesForRange(startDate, endDate);

    // Should include Independence Day
    expect(argies).toContain('2024-03-25');

    // Should include Kathara Deftera 2024 (March 18)
    expect(argies).toContain('2024-03-18');

    // Should include many weekends
    const weekendCount = argies.filter((d) => {
      const date = new Date(d + 'T00:00:00.000Z');
      const day = date.getUTCDay();
      return day === 0 || day === 6;
    }).length;
    expect(weekendCount).toBeGreaterThan(10);
  });
});
