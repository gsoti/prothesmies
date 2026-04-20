import { describe, expect, it } from 'vitest';
import { getCivilDeadlines } from './deadlines.js';
import {
    CivilAnchorType,
    CivilDeadlineCode,
    DeadlineStatus,
} from './types.js';
import { formatCivilDeadlines } from './test-helpers/formatCivilDeadlines.js';

const DIADIKASIA = 'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ';

describe('getCivilDeadlines (pre-2026 τακτική)', () => {
    it('returns not_supported for non-taktiki pre-2026 filing', async () => {
        const result = await getCivilDeadlines({
            imerominia_katathesis: '2025-06-01',
            diadikasia: 'ΕΙΔΙΚΗ ΔΙΑΔΙΚΑΣΙΑ',
        });
        expect(result).toEqual({ deadlines: [], status: 'not_supported' });
    });

    it('returns epidosi deadline for pre-2026 taktiki filing', async () => {
        const { deadlines, status } = await getCivilDeadlines({
            imerominia_katathesis: '2025-06-01',
            diadikasia: DIADIKASIA,
        });

        expect(status).toBe('success');
        expect(deadlines).toHaveLength(3);

        const epidosi = deadlines[0];
        expect(epidosi.type).toBe(CivilDeadlineCode.epidosi);
        expect(epidosi.status).toBe(DeadlineStatus.CALCULATED);
        expect(epidosi.anchorType).toBe(CivilAnchorType.IMEROMINIA_KATATHESIS);
        // 30 calendar days after 2025-06-01 = 2025-07-01 (Tuesday, no holidays)
        expect(epidosi.date).toBe('2025-07-01');
    });

    it('skips weekends on the final date', async () => {
        // 30 days after 2025-01-15 (Wednesday) = 2025-02-14 (Friday) — no skip needed
        // 30 days after 2025-01-13 (Monday) = 2025-02-12 (Wednesday) — no skip needed
        // Choose a date where +30 lands on Saturday: 2025-01-04 → 2025-02-03 (Monday, ok)
        // 2025-02-15 is Saturday, find katathesis where +30 = Saturday
        // 2025-01-16 (Thursday) + 30 = 2025-02-15 (Saturday) → skip to 2025-02-17 (Monday)
        const { deadlines } = await getCivilDeadlines({
            imerominia_katathesis: '2025-01-16',
            diadikasia: DIADIKASIA,
        });

        expect(deadlines[0].date).toBe('2025-02-17');
        expect(deadlines[0].calculation?.skipped.length).toBeGreaterThan(0);
    });

    it('applies August anastoli for standard pre-2026 filing', async () => {
        const { deadlines } = await getCivilDeadlines({
            imerominia_katathesis: '2025-07-15',
            diadikasia: DIADIKASIA,
        });

        const epidosi = deadlines[0];
        // 30 days from 2025-07-15 would be 2025-08-14, but August is paused
        // so the deadline should be pushed past 2025-08-31
        expect(epidosi.calculation?.paused.length).toBeGreaterThan(0);
        expect(epidosi.date > '2025-08-31').toBe(true);
    });

    it('applies the same August anastoli when dimosio is true for pre-2026 filing', async () => {
        const standard = await getCivilDeadlines({
            imerominia_katathesis: '2025-07-15',
            diadikasia: DIADIKASIA,
        });
        const dimosio = await getCivilDeadlines({
            imerominia_katathesis: '2025-07-15',
            diadikasia: DIADIKASIA,
            dimosio: true,
        });

        expect(dimosio.deadlines[0].date >= standard.deadlines[0].date).toBe(true);
        expect(dimosio.deadlines[0].calculation!.paused.length).toBe(
            standard.deadlines[0].calculation!.paused.length
        );
    });

    it('calculation logic reflects correct reference and days', async () => {
        const { deadlines } = await getCivilDeadlines({
            imerominia_katathesis: '2025-03-01',
            diadikasia: DIADIKASIA,
        });

        const logic = deadlines[0].calculation?.logic;
        expect(logic?.days).toBe(30);
        expect(logic?.when).toBe('after');
        expect(logic?.start).toBe('2025-03-01');
    });

    // https://www.run.legal/civil-cases/396e5941-17ba-40a7-8cbe-073f0a3edff4
    it('should format pre-2026 epidosi deadline from filing date', async () => {
        const { deadlines } = await getCivilDeadlines({
            imerominia_katathesis: '2024-10-16',
            diadikasia: DIADIKASIA,
        });

        expect(formatCivilDeadlines(deadlines)).toMatchInlineSnapshot(`
          "2024-11-15 - Επίδοση                          30 ημέρες μετά ημερομηνία κατάθεσης
          2024-12-16 - Παρέμβαση                        60 ημέρες μετά ημερομηνία κατάθεσης [skipped: 2024-12-15]
          2025-01-14 - Παρέμβαση του προσεπικαλούμενου  90 ημέρες μετά ημερομηνία κατάθεσης"
        `);
    });

    it('uses 60-day epidosi for dimosio pre-2026 filing', async () => {
        const { deadlines, status } = await getCivilDeadlines({
            imerominia_katathesis: '2025-03-01',
            diadikasia: DIADIKASIA,
            dimosio: true,
        });

        expect(status).toBe('success');
        expect(deadlines[0].calculation?.logic.days).toBe(60);
    });

    it('should format pre-2026 dimosio epidosi deadline from filing date', async () => {
        const { deadlines } = await getCivilDeadlines({
            imerominia_katathesis: '2025-03-01',
            diadikasia: DIADIKASIA,
            dimosio: true,
        });

        expect(formatCivilDeadlines(deadlines)).toMatchInlineSnapshot(`
          "2025-04-30 - Επίδοση                          60 ημέρες μετά ημερομηνία κατάθεσης
          2025-05-30 - Παρέμβαση                        90 ημέρες μετά ημερομηνία κατάθεσης
          2025-06-30 - Παρέμβαση του προσεπικαλούμενου  120 ημέρες μετά ημερομηνία κατάθεσης [skipped: 2025-06-29]"
        `);
    });
});
