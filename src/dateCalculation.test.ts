import { describe, it, expect } from 'vitest';
import { getDateCalculation } from './dateCalculation.js';

describe('getDateCalculation', () => {
  describe('validation', () => {
    it('throws error for negative noOfDays', () => {
      expect(() =>
        getDateCalculation('2024-01-15', -1, {
          direction: 'forward',
          countBehavior: 'standard',
          argiesAndAnastoli: { argies: [], anastoli: [] }
        })
      ).toThrow('noOfDays must be >= 0');
    });

    it('throws error for invalid start date', () => {
      expect(() =>
        getDateCalculation('invalid-date', 10, {
          direction: 'forward',
          countBehavior: 'standard',
          argiesAndAnastoli: { argies: [], anastoli: [] }
        })
      ).toThrow('Invalid date format');
    });

    it('throws error for invalid argia date', () => {
      expect(() =>
        getDateCalculation('2024-01-15', 10, {
          direction: 'forward',
          countBehavior: 'standard',
          argiesAndAnastoli: { argies: ['not-a-date'], anastoli: [] }
        })
      ).toThrow('Invalid date format');
    });

    it('throws error for invalid anastoli date', () => {
      expect(() =>
        getDateCalculation('2024-01-15', 10, {
          direction: 'forward',
          countBehavior: 'standard',
          argiesAndAnastoli: { argies: [], anastoli: ['bad'] }
        })
      ).toThrow('Invalid date format');
    });
  });

  describe('special cases', () => {
    it('returns start date when noOfDays is 0', () => {
      const result = getDateCalculation('2024-01-15', 0, {
        direction: 'forward',
        countBehavior: 'standard',
        argiesAndAnastoli: { argies: [], anastoli: [] }
      });

      expect(result).toEqual({
        date: '2024-01-15',
        paused: [],
        skipped: []
      });
    });

    it('handles empty argies and anastoli', () => {
      const result = getDateCalculation('2024-01-15', 5, {
        direction: 'forward',
        countBehavior: 'standard',
        argiesAndAnastoli: { argies: [], anastoli: [] }
      });

      expect(result).toEqual({
        date: '2024-01-20',
        paused: [],
        skipped: []
      });
    });
  });

  describe('Example 1: Forward Direction (Standard Behavior)', () => {
    it('correctly handles suspension periods and holidays', () => {
      const result = getDateCalculation('2024-01-15', 10, {
        direction: 'forward',
        countBehavior: 'standard',
        argiesAndAnastoli: {
          argies: ['2024-01-20', '2024-01-21', '2024-01-25'],
          anastoli: ['2024-01-22', '2024-01-23', '2024-01-24']
        }
      });

      expect(result.date).toBe('2024-01-28');
      expect(result.paused).toEqual(['2024-01-22', '2024-01-23', '2024-01-24']);
      expect(result.skipped).toEqual([]);
    });
  });

  describe('Example 2: Backward Direction (Standard Behavior)', () => {
    it('correctly counts backward with suspension periods', () => {
      const result = getDateCalculation('2024-01-28', 10, {
        direction: 'backward',
        countBehavior: 'standard',
        argiesAndAnastoli: {
          argies: ['2024-01-20', '2024-01-21'],
          anastoli: ['2024-01-22', '2024-01-23', '2024-01-24']
        }
      });

      expect(result.date).toBe('2024-01-15');
      expect(result.paused).toEqual(['2024-01-24', '2024-01-23', '2024-01-22']);
      expect(result.skipped).toEqual([]);
    });
  });

  describe('Example 3: Working Days Only Behavior', () => {
    it('correctly counts only working days', () => {
      const result = getDateCalculation('2024-01-15', 10, {
        direction: 'forward',
        countBehavior: 'workingDaysOnly',
        argiesAndAnastoli: {
          argies: ['2024-01-20', '2024-01-21'],
          anastoli: ['2024-01-24', '2024-01-25']
        }
      });

      expect(result.date).toBe('2024-01-29');
      expect(result.paused).toEqual(['2024-01-20', '2024-01-21', '2024-01-24', '2024-01-25']);
      expect(result.skipped).toEqual([]);
    });
  });

  describe('Phase 2: Final date landing on holidays', () => {
    it('skips argies when final date lands on holiday (standard mode)', () => {
      const result = getDateCalculation('2024-01-15', 5, {
        direction: 'forward',
        countBehavior: 'standard',
        argiesAndAnastoli: {
          argies: ['2024-01-20', '2024-01-21'],
          anastoli: []
        }
      });

      // Day 1: 16, Day 2: 17, Day 3: 18, Day 4: 19, Day 5: 20 (argia)
      // Skips 20 (argia), 21 (argia), lands on 22
      expect(result.date).toBe('2024-01-22');
      expect(result.paused).toEqual([]);
      expect(result.skipped).toEqual(['2024-01-20', '2024-01-21']);
    });

    it('skips argies backward when final date lands on holiday', () => {
      const result = getDateCalculation('2024-01-25', 4, {
        direction: 'backward',
        countBehavior: 'standard',
        argiesAndAnastoli: {
          argies: ['2024-01-20', '2024-01-21'],
          anastoli: []
        }
      });

      // Day 1: 24, Day 2: 23, Day 3: 22, Day 4: 21 (argia)
      // Skips 21 (argia), 20 (argia), lands on 19
      expect(result.date).toBe('2024-01-19');
      expect(result.paused).toEqual([]);
      expect(result.skipped).toEqual(['2024-01-21', '2024-01-20']);
    });
  });

  describe('start date exclusion', () => {
    it('does not count the start date', () => {
      const result = getDateCalculation('2024-01-15', 1, {
        direction: 'forward',
        countBehavior: 'standard',
        argiesAndAnastoli: { argies: [], anastoli: [] }
      });

      expect(result.date).toBe('2024-01-16');
    });

    it('does not count the start date backward', () => {
      const result = getDateCalculation('2024-01-15', 1, {
        direction: 'backward',
        countBehavior: 'standard',
        argiesAndAnastoli: { argies: [], anastoli: [] }
      });

      expect(result.date).toBe('2024-01-14');
    });
  });

  describe('consecutive suspension handling', () => {
    it('handles multiple consecutive suspension days', () => {
      const result = getDateCalculation('2024-01-15', 3, {
        direction: 'forward',
        countBehavior: 'standard',
        argiesAndAnastoli: {
          argies: [],
          anastoli: ['2024-01-16', '2024-01-17', '2024-01-18', '2024-01-19', '2024-01-20']
        }
      });

      // Day 1: 16 (paused), 17 (paused), 18 (paused), 19 (paused), 20 (paused), 21 ✓
      // Day 2: 22 ✓
      // Day 3: 23 ✓
      expect(result.date).toBe('2024-01-23');
      expect(result.paused).toEqual(['2024-01-16', '2024-01-17', '2024-01-18', '2024-01-19', '2024-01-20']);
    });
  });

  describe('overlapping argies and anastoli', () => {
    it('handles dates that are both argia and anastoli', () => {
      const result = getDateCalculation('2024-01-15', 3, {
        direction: 'forward',
        countBehavior: 'standard',
        argiesAndAnastoli: {
          argies: ['2024-01-17'],
          anastoli: ['2024-01-17']
        }
      });

      // In standard mode, only anastoli pauses during Phase 1
      // Day 1: 16 ✓, 17 (paused - anastoli), Day 2: 18 ✓, Day 3: 19 ✓
      expect(result.date).toBe('2024-01-19');
      expect(result.paused).toEqual(['2024-01-17']);
    });
  });
});
