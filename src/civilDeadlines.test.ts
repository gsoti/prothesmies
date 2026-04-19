import { describe, expect, it } from 'vitest';
import { getCivilDeadlines, DeadlineCalculationError } from './deadlines.js';
import {
    CivilAnchorType,
    CivilDeadlineCode,
    DeadlineStatus,
} from './types.js';

describe('getCivilDeadlines', () => {
    it('throws error for invalid filing date', async () => {
        await expect(
            getCivilDeadlines({
                imerominia_katathesis: 'invalid-date',
            })
        ).rejects.toThrow('Invalid imerominia_katathesis date format');
    });

    it('returns calculated early deadlines and pending late deadlines', async () => {
        const result = await getCivilDeadlines({
            imerominia_katathesis: '2025-01-15',
        });

        expect(result).toHaveLength(8);

        const earlyCodes = result
            .filter(deadline => deadline.status === DeadlineStatus.CALCULATED)
            .map(deadline => deadline.type);
        expect(earlyCodes).toEqual([
            CivilDeadlineCode.epidosi,
            CivilDeadlineCode.paremptiptouses_antagogi_paremvasi_prosepiklisi_anakoinosi,
            CivilDeadlineCode.paremvasi_prosepikaloumenou,
            CivilDeadlineCode.protaseis_kai_apodeiktika,
            CivilDeadlineCode.prosthiki_antikrousi,
            CivilDeadlineCode.orismos_dikasti_synthesis,
        ]);

        const pending = result.filter(deadline => deadline.status === DeadlineStatus.PENDING);
        expect(pending.map(deadline => deadline.type)).toEqual([
            CivilDeadlineCode.ekdosi_diataxis_dikasti,
            CivilDeadlineCode.aitisi_meta_apo_aparadekto,
        ]);
        expect(pending.map(deadline => deadline.missingAnchor)).toEqual([
            CivilAnchorType.ORISMOS_DIKASTI,
            CivilAnchorType.EKDOSI_DIATAXIS,
        ]);
    });

    it('derives civil anchors from filing date in sequence', async () => {
        const result = await getCivilDeadlines({
            imerominia_katathesis: '2025-01-15',
        });

        const byCode = new Map(result.map(deadline => [deadline.type, deadline]));

        expect(byCode.get(CivilDeadlineCode.epidosi)?.date).toBe('2025-02-14');
        expect(byCode.get(CivilDeadlineCode.paremptiptouses_antagogi_paremvasi_prosepiklisi_anakoinosi)?.date).toBe('2025-03-26');
        expect(byCode.get(CivilDeadlineCode.paremvasi_prosepikaloumenou)?.date).toBe('2025-04-25');
        expect(byCode.get(CivilDeadlineCode.protaseis_kai_apodeiktika)?.date).toBe('2025-05-15');
        expect(byCode.get(CivilDeadlineCode.prosthiki_antikrousi)?.date).toBe('2025-05-30');
        expect(byCode.get(CivilDeadlineCode.orismos_dikasti_synthesis)?.date).toBe('2025-06-10');

        expect(byCode.get(CivilDeadlineCode.prosthiki_antikrousi)?.calculation?.logic.reference).toBe('λήξη προθεσμίας προτάσεων');
        expect(byCode.get(CivilDeadlineCode.orismos_dikasti_synthesis)?.calculation?.logic.reference).toBe('λήξη προθεσμίας προσθήκης - αντίκρουσης');
    });

    it('marks pending deadlines without calculation payloads', async () => {
        const result = await getCivilDeadlines({
            imerominia_katathesis: '2025-01-15',
        });

        const pending = result.find(deadline => deadline.type === CivilDeadlineCode.ekdosi_diataxis_dikasti);
        expect(pending).toMatchObject({
            status: DeadlineStatus.PENDING,
            anchorType: CivilAnchorType.ORISMOS_DIKASTI,
            missingAnchor: CivilAnchorType.ORISMOS_DIKASTI,
            calculation: null,
            date: '',
        });
    });

    it('keeps legislation text shape compatible when no full text is available', async () => {
        const result = await getCivilDeadlines({
            imerominia_katathesis: '2025-01-15',
        });

        for (const deadline of result) {
            expect(deadline.nomothesia.length).toBe(1);
            expect(deadline.formattedNomothesia[0]?.article).toBe(deadline.nomothesia[0]);
        }
    });

    it('should format civil deadlines from filing date', async () => {
        const result = await getCivilDeadlines({
            imerominia_katathesis: '2026-01-15',
        });

        const sorted = result.sort((a, b) => {
            const left = a.date || '9999-12-31';
            const right = b.date || '9999-12-31';
            return left.localeCompare(right);
        });

        const maxFirstColLength = Math.max(
            ...sorted.map(d => `${d.date || 'PENDING'} - ${d.shortName}`.length)
        );

        const formatted = sorted
            .map(d => {
                const firstCol = `${d.date || 'PENDING'} - ${d.shortName}`.padEnd(maxFirstColLength);

                if (d.status === DeadlineStatus.PENDING) {
                    return `${firstCol}  pending (${d.missingAnchor})`;
                }

                const days = d.calculation!.logic.days;
                const dayCount = d.calculation!.logic.day_count === 'CALENDAR'
                    ? ''
                    : d.calculation!.logic.day_count === 'FULL'
                        ? ' ΠΛΗΡΕΙΣ'
                        : ' ΕΡΓΑΣΙΜΕΣ';
                const when = d.calculation!.logic.when === 'before' ? 'πριν' : 'μετά';
                const ref = d.calculation!.logic.reference;
                const paused = d.calculation!.paused.length > 0 ? ` [paused: ${d.calculation!.paused.length}]` : '';
                const skipped = d.calculation!.skipped.length > 0 ? ` [skipped: ${d.calculation!.skipped.join(', ')}]` : '';
                return `${firstCol}  ${days}${dayCount} ημέρες ${when} ${ref}${paused}${skipped}`;
            })
            .join('\n');

        expect(formatted).toMatchInlineSnapshot(`
          "2026-02-16 - Επίδοση                      30 ημέρες μετά ημερομηνία κατάθεσης [skipped: 2026-02-14, 2026-02-15]
          2026-03-30 - Παρεμπίπτουσες/Ανταγωγή      40 ημέρες μετά λήξη προθεσμίας επίδοσης αγωγής [skipped: 2026-03-28, 2026-03-29]
          2026-04-27 - Παρέμβαση προσεπικαλούμενου  70 ημέρες μετά λήξη προθεσμίας επίδοσης αγωγής
          2026-05-18 - Προτάσεις & Αποδεικτικά      90 ημέρες μετά λήξη προθεσμίας επίδοσης αγωγής [skipped: 2026-05-17]
          2026-06-02 - Προσθήκη – αντίκρουση        15 ημέρες μετά λήξη προθεσμίας προτάσεων
          2026-06-12 - Ορισμός δικαστή              10 ημέρες μετά λήξη προθεσμίας προσθήκης - αντίκρουσης
          PENDING - Έκδοση διάταξης                 pending (orismos_dikasti)
          PENDING - Αίτηση μετά από απαράδεκτο      pending (ekdosi_diataxis)"
        `);
    });
});

describe('DeadlineCalculationError', () => {
    it('is reusable by the civil calculator', () => {
        const error = new DeadlineCalculationError('x', 'INVALID_INPUT');
        expect(error).toBeInstanceOf(Error);
        expect(error.code).toBe('INVALID_INPUT');
    });
});
