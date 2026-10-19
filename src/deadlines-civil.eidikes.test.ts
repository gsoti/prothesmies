import { describe, expect, it } from 'vitest';
import { getCivilDeadlines } from './deadlines-civil.js';
import { CivilDeadlineCode } from './types.js';
import { formatCivilDeadlines } from './test-helpers/formatCivilDeadlines.js';

const INPUT = {
    imerominia_katathesis: '2025-01-10',
    diadikasia: 'ΑΜΟΙΒΕΣ',
    eidos: 'ΑΙΤΗΣΗ',
    dikasimos: '2025-03-10',
    apotelesma: 'ΣΥΖΗΤΗΘΗΚΕ',
} as const;

describe('getCivilDeadlines for ειδικές διαδικασίες', () => {
    it('should format civil deadlines from filing date', () => {
        const { deadlines } = getCivilDeadlines(INPUT);

        expect(formatCivilDeadlines(deadlines).replace(/[ \t]+$/gm, '')).toMatchInlineSnapshot(`
          "2025-01-10 - Κατάθεση
          2025-03-10 - Δικάσιμος
          2025-03-17 - Προσθήκη   5 ΕΡΓΑΣΙΜΕΣ ημέρες μετά dikasimos [paused: 2]"
        `);
    });

    it('returns katathesi when no dikasimos is provided', () => {
        const { deadlines } = getCivilDeadlines({
            imerominia_katathesis: INPUT.imerominia_katathesis,
            diadikasia: INPUT.diadikasia,
            eidos: INPUT.eidos,
        });

        expect(deadlines.map(deadline => deadline.type)).toEqual([CivilDeadlineCode.katathesi]);
        expect(deadlines[0].date).toBe(INPUT.imerominia_katathesis);
    });

    it('returns katathesi when the case was not heard', () => {
        const { deadlines } = getCivilDeadlines({
            ...INPUT,
            apotelesma: 'ΜΑΤΑΙΩΘΗΚΕ',
        });

        expect(deadlines.map(deadline => deadline.type)).toEqual([
            CivilDeadlineCode.katathesi,
            CivilDeadlineCode.dikasimos,
        ]);
    });

    describe('json snapshots', () => {
        it('snapshots katathesi as JSON', () => {
            const { deadlines } = getCivilDeadlines(INPUT);

            const deadline = deadlines.find(d => d.type === CivilDeadlineCode.katathesi);
            expect(JSON.parse(JSON.stringify(deadline))).toMatchInlineSnapshot(`
              {
                "calculation": null,
                "date": "2025-01-10",
                "formattedNomothesia": [],
                "name": "Κατάθεση",
                "nomothesia": [],
                "shortName": "Κατάθεση",
                "type": "katathesi",
              }
            `);
        });

        it('snapshots δικάσιμος as JSON', () => {
            const { deadlines } = getCivilDeadlines(INPUT);

            const deadline = deadlines.find(d => d.type === CivilDeadlineCode.dikasimos);
            expect(JSON.parse(JSON.stringify(deadline))).toMatchInlineSnapshot(`
              {
                "calculation": null,
                "date": "2025-03-10",
                "formattedNomothesia": [],
                "name": "Δικάσιμος",
                "nomothesia": [],
                "shortName": "Δικάσιμος",
                "type": "dikasimos",
              }
            `);
        });

        it('snapshots προσθήκη as JSON', () => {
            const { deadlines } = getCivilDeadlines(INPUT);

            const deadline = deadlines.find(d => d.type === CivilDeadlineCode.prosthiki);
            expect(JSON.parse(JSON.stringify(deadline))).toMatchInlineSnapshot(`
              {
                "calculation": {
                  "date": "2025-03-17",
                  "logic": {
                    "day_count": "WORKING",
                    "days": 5,
                    "name": "Δικάσιμος",
                    "reference": "dikasimos",
                    "start": "2025-03-10",
                    "when": "after",
                  },
                  "paused": [
                    "2025-03-15",
                    "2025-03-16",
                  ],
                  "skipped": [],
                },
                "date": "2025-03-17",
                "formattedNomothesia": [
                  {
                    "article": "ΚΠολΔ 591 παρ. 1 περ. στ΄",
                    "highlighted": [
                      "Οι διάδικοι μπορούν έως τη δωδέκατη ώρα της πέμπτης εργάσιμης ημέρας από τη συζήτηση να καταθέσουν προσθήκη στις προτάσεις τους",
                    ],
                    "text": "Οι διάδικοι μπορούν έως τη δωδέκατη ώρα της πέμπτης εργάσιμης ημέρας από τη συζήτηση να καταθέσουν προσθήκη στις προτάσεις τους, με την οποία αξιολογούνται οι αποδείξεις, προτείνονται ισχυρισμοί και προσκομίζονται ένορκες βεβαιώσεις, έγγραφα και γνωμοδοτήσεις κατά το άρθρο 390 μόνο για την αντίκρουση ισχυρισμών που προτάθηκαν.",
                  },
                ],
                "name": "Κατάθεση προσθήκης",
                "nomothesia": [
                  "ΚΠολΔ 591 παρ. 1 περ. στ΄ Οι διάδικοι μπορούν έως τη δωδέκατη ώρα της πέμπτης εργάσιμης ημέρας από τη συζήτηση να καταθέσουν προσθήκη στις προτάσεις τους, με την οποία αξιολογούνται οι αποδείξεις, προτείνονται ισχυρισμοί και προσκομίζονται ένορκες βεβαιώσεις, έγγραφα και γνωμοδοτήσεις κατά το άρθρο 390 μόνο για την αντίκρουση ισχυρισμών που προτάθηκαν.",
                ],
                "shortName": "Προσθήκη",
                "type": "prosthiki",
              }
            `);
        });
    });
});
