import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { getAdminDeadlines } from '../../src/deadlines-admin.js';
import { Deadline, DeadlineRule } from '../../src/types.js';
import { getArgiesForRange } from '../../src/utils/argies.js';
import { loadAdminDbRules } from './admin-db-rules.js';
import { getLegacyAdminDeadlines } from './legacy-admin-calculator.js';

const parityDescribe = process.env.ADMIN_PARITY === '1' ? describe : describe.skip;

function byType(deadlines: Deadline[]): Record<string, Deadline> {
    const codes = deadlines.map(deadline => deadline.type);
    expect(codes).toHaveLength(12);
    expect(new Set(codes).size).toBe(12);
    return Object.fromEntries(deadlines.map(deadline => [deadline.type, deadline]));
}

parityDescribe('legacy/new administrative parity', () => {
    let rules: DeadlineRule[];

    beforeAll(async () => {
        rules = await loadAdminDbRules();
    });

    it('matches complete semantic output for 1,000 reproducible valid inputs', () => {
        const firstDay = Date.UTC(2020, 0, 1) / 86_400_000;
        const lastDay = Date.UTC(2035, 11, 31) / 86_400_000;
        const validDate = fc.integer({ min: firstDay, max: lastDay })
            .map(day => new Date(day * 86_400_000).toISOString().slice(0, 10))
            .filter(date => !getArgiesForRange(date, date).includes(date));

        fc.assert(fc.property(validDate, fc.boolean(), (dikasimos, syntmisi) => {
            const input = {
                court: 'dprotodikeioath',
                katigoria: 'Αγωγή',
                dikasimos,
                syntmisi,
            };
            const result = getAdminDeadlines(input);
            expect(result.status).toBe('success');
            if (result.status !== 'success') throw new Error('Expected successful calculation');
            expect(byType(result.deadlines)).toEqual(
                byType(getLegacyAdminDeadlines(input, rules))
            );
        }), { numRuns: 1_000, seed: 20_260_918 });
    });
});
