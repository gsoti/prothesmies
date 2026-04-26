import { describe, expect, it } from 'vitest';
import { getCivilDeadlines, DeadlineCalculationError } from './deadlines-civil.js';

describe('getCivilDeadlines', () => {
    it('throws error for invalid filing date', () => {
        expect(() =>
            getCivilDeadlines({
                imerominia_katathesis: 'invalid-date',
                diadikasia: 'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ',
            })
        ).toThrow('Invalid imerominia_katathesis date format');
    });

    it('returns not_supported for unsupported diadikasia', () => {
        const result = getCivilDeadlines({
            imerominia_katathesis: '2026-01-15',
            diadikasia: 'ΕΙΔΙΚΗ ΔΙΑΔΙΚΑΣΙΑ',
        });
        expect(result).toEqual({ deadlines: [], status: 'not_supported' });
    });
});

describe('DeadlineCalculationError', () => {
    it('is reusable by the civil calculator', () => {
        const error = new DeadlineCalculationError('x', 'INVALID_INPUT');
        expect(error).toBeInstanceOf(Error);
        expect(error.code).toBe('INVALID_INPUT');
    });
});
