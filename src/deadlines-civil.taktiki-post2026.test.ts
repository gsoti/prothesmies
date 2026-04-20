import { describe, expect, it } from 'vitest';
import { getCivilDeadlines } from './deadlines.js';
import {
    CivilAnchorType,
    CivilDeadlineCode,
    DeadlineStatus,
} from './types.js';
import { formatCivilDeadlines } from './test-helpers/formatCivilDeadlines.js';

const SUPPORTED_DIADIKASIA = 'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ';

describe('getCivilDeadlines', () => {
    it('returns calculated early deadlines and pending late deadlines', async () => {
        const { deadlines, status } = await getCivilDeadlines({
            imerominia_katathesis: '2026-01-15',
            diadikasia: SUPPORTED_DIADIKASIA,
        });

        expect(status).toBe('success');
        expect(deadlines).toHaveLength(8);

        const earlyCodes = deadlines
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

        const pending = deadlines.filter(deadline => deadline.status === DeadlineStatus.PENDING);
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
        const { deadlines } = await getCivilDeadlines({
            imerominia_katathesis: '2026-01-15',
            diadikasia: SUPPORTED_DIADIKASIA,
        });

        const byCode = new Map(deadlines.map(deadline => [deadline.type, deadline]));

        expect(byCode.get(CivilDeadlineCode.epidosi)?.date).toBe('2026-02-16');
        expect(byCode.get(CivilDeadlineCode.paremptiptouses_antagogi_paremvasi_prosepiklisi_anakoinosi)?.date).toBe('2026-03-30');
        expect(byCode.get(CivilDeadlineCode.paremvasi_prosepikaloumenou)?.date).toBe('2026-04-27');
        expect(byCode.get(CivilDeadlineCode.protaseis_kai_apodeiktika)?.date).toBe('2026-05-18');
        expect(byCode.get(CivilDeadlineCode.prosthiki_antikrousi)?.date).toBe('2026-06-02');
        expect(byCode.get(CivilDeadlineCode.orismos_dikasti_synthesis)?.date).toBe('2026-06-12');

        expect(byCode.get(CivilDeadlineCode.prosthiki_antikrousi)?.calculation?.logic.reference).toBe('λήξη προθεσμίας προτάσεων');
        expect(byCode.get(CivilDeadlineCode.orismos_dikasti_synthesis)?.calculation?.logic.reference).toBe('λήξη προθεσμίας προσθήκης - αντίκρουσης');
    });

    it('marks pending deadlines without calculation payloads', async () => {
        const { deadlines } = await getCivilDeadlines({
            imerominia_katathesis: '2026-01-15',
            diadikasia: SUPPORTED_DIADIKASIA,
        });

        const pending = deadlines.find(deadline => deadline.type === CivilDeadlineCode.ekdosi_diataxis_dikasti);
        expect(pending).toMatchObject({
            status: DeadlineStatus.PENDING,
            anchorType: CivilAnchorType.ORISMOS_DIKASTI,
            missingAnchor: CivilAnchorType.ORISMOS_DIKASTI,
            calculation: null,
            date: '',
        });
    });

    it('keeps legislation text shape compatible when no full text is available', async () => {
        const { deadlines } = await getCivilDeadlines({
            imerominia_katathesis: '2026-01-15',
            diadikasia: SUPPORTED_DIADIKASIA,
        });

        for (const deadline of deadlines) {
            expect(deadline.nomothesia.length).toBe(1);
            expect(deadline.formattedNomothesia[0]?.article).toBe(deadline.nomothesia[0]);
        }
    });

    it('should format civil deadlines from filing date', async () => {
        const { deadlines } = await getCivilDeadlines({
            imerominia_katathesis: '2026-01-15',
            diadikasia: SUPPORTED_DIADIKASIA,
        });

        expect(formatCivilDeadlines(deadlines)).toMatchInlineSnapshot(`
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

    describe('anastoli', () => {
        it('pauses counting in August for standard (non-dimosio) filing', async () => {
            const { deadlines } = await getCivilDeadlines({
                imerominia_katathesis: '2026-06-01',
                diadikasia: SUPPORTED_DIADIKASIA,
            });

            const allPaused = deadlines.flatMap(d => d.calculation?.paused ?? []);
            const augustDates = allPaused.filter(d => d.startsWith('2026-08'));
            // 93 = 3 deadlines × 31 August days: παρεμπίπτουσες, παρέμβαση, and προτάσεις all span August
            expect(augustDates.length).toBe(93);

            const julyDates = allPaused.filter(d => d.startsWith('2026-07'));
            expect(julyDates.length).toBe(0);

            const septDates = allPaused.filter(d => d.startsWith('2026-09'));
            expect(septDates.length).toBe(0);
        });

        it('pauses counting in July, August, and Sept 1–15 for dimosio filing', async () => {
            const { deadlines } = await getCivilDeadlines({
                imerominia_katathesis: '2026-06-01',
                diadikasia: SUPPORTED_DIADIKASIA,
                dimosio: true,
            });

            const allPaused = deadlines.flatMap(d => d.calculation?.paused ?? []);
            const julyDates = allPaused.filter(d => d.startsWith('2026-07'));
            const augustDates = allPaused.filter(d => d.startsWith('2026-08'));
            const septDates = allPaused.filter(d => {
                if (!d.startsWith('2026-09')) return false;
                const day = parseInt(d.slice(8, 10), 10);
                return day <= 15;
            });

            expect(julyDates.length).toBe(0);
            expect(augustDates.length).toBeGreaterThan(0);
            expect(septDates.length).toBe(0);
        });

        it('should format civil deadlines from filing date crossing anastoli', async () => {
            const { deadlines } = await getCivilDeadlines({
                imerominia_katathesis: '2026-06-01',
                diadikasia: SUPPORTED_DIADIKASIA,
                dimosio: true,
            });

            expect(formatCivilDeadlines(deadlines)).toMatchInlineSnapshot(`
              "2026-07-01 - Επίδοση                      30 ημέρες μετά ημερομηνία κατάθεσης
              2026-09-10 - Παρεμπίπτουσες/Ανταγωγή      40 ημέρες μετά λήξη προθεσμίας επίδοσης αγωγής [paused: 31]
              2026-10-12 - Παρέμβαση προσεπικαλούμενου  70 ημέρες μετά λήξη προθεσμίας επίδοσης αγωγής [paused: 31] [skipped: 2026-10-10, 2026-10-11]
              2026-10-30 - Προτάσεις & Αποδεικτικά      90 ημέρες μετά λήξη προθεσμίας επίδοσης αγωγής [paused: 31]
              2026-11-16 - Προσθήκη – αντίκρουση        15 ημέρες μετά λήξη προθεσμίας προτάσεων [skipped: 2026-11-14, 2026-11-15]
              2026-11-26 - Ορισμός δικαστή              10 ημέρες μετά λήξη προθεσμίας προσθήκης - αντίκρουσης
              PENDING - Έκδοση διάταξης                 pending (orismos_dikasti)
              PENDING - Αίτηση μετά από απαράδεκτο      pending (ekdosi_diataxis)"
            `);
        });

        it('dimosio deadlines are later than standard deadlines due to extended suspension', async () => {
            const [standard, dimosio] = await Promise.all([
                getCivilDeadlines({ imerominia_katathesis: '2026-06-01', diadikasia: SUPPORTED_DIADIKASIA }),
                getCivilDeadlines({ imerominia_katathesis: '2026-06-01', diadikasia: SUPPORTED_DIADIKASIA, dimosio: true }),
            ]);

            const byCode = (deadlines: typeof standard.deadlines) =>
                new Map(deadlines.map(d => [d.type, d]));

            const stdMap = byCode(standard.deadlines);
            const dimMap = byCode(dimosio.deadlines);

            for (const [code, stdDeadline] of stdMap) {
                const dimDeadline = dimMap.get(code);
                if (!stdDeadline.date || !dimDeadline?.date) continue;
                expect(dimDeadline.date >= stdDeadline.date).toBe(true);
            }
        });
    });
});
