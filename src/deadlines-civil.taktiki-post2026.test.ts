import { describe, expect, it } from 'vitest';
import { getCivilDeadlines } from './deadlines-admin.js';
import {
    CivilAnchorType,
    CivilDeadlineCode,
} from './types.js';
import { formatCivilDeadlines } from './test-helpers/formatCivilDeadlines.js';

const SUPPORTED_DIADIKASIA = 'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ';

describe('getCivilDeadlines', () => {
    it('returns calculated early deadlines and pending late deadlines', () => {
        const { deadlines, status } = getCivilDeadlines({
            imerominia_katathesis: '2026-01-15',
            diadikasia: SUPPORTED_DIADIKASIA,
        });

        expect(status).toBe('success');
        expect(deadlines).toHaveLength(7);

        const earlyCodes = deadlines
            .filter(deadline => deadline.calculation !== null)
            .map(deadline => deadline.type);
        expect(earlyCodes).toEqual([
            CivilDeadlineCode.epidosi,
            CivilDeadlineCode.paremvasi,
            CivilDeadlineCode.paremvasiProsek,
            CivilDeadlineCode.protaseis,
            CivilDeadlineCode.prosthiki,
            CivilDeadlineCode.orismos_dikasti_synthesis,
        ]);

        const katathesi = deadlines.find(deadline => deadline.type === CivilDeadlineCode.katathesi);
        expect(katathesi?.date).toBe('2026-01-15');
        expect(katathesi?.calculation).toBeNull();

        expect(
            deadlines.every(deadline =>
                deadline.type === CivilDeadlineCode.katathesi || deadline.calculation !== null
            )
        ).toBe(true);
    });

    it('derives civil anchors from filing date in sequence', () => {
        const { deadlines } = getCivilDeadlines({
            imerominia_katathesis: '2026-01-15',
            diadikasia: SUPPORTED_DIADIKASIA,
        });

        const byCode = new Map(deadlines.map(deadline => [deadline.type, deadline]));

        expect(byCode.get(CivilDeadlineCode.epidosi)?.date).toBe('2026-02-16');
        expect(byCode.get(CivilDeadlineCode.paremvasi)?.date).toBe('2026-03-30');
        expect(byCode.get(CivilDeadlineCode.paremvasiProsek)?.date).toBe('2026-04-27');
        expect(byCode.get(CivilDeadlineCode.protaseis)?.date).toBe('2026-05-18');
        expect(byCode.get(CivilDeadlineCode.prosthiki)?.date).toBe('2026-06-02');

        expect(byCode.get(CivilDeadlineCode.prosthiki)?.calculation?.logic.reference).toBe('protaseis');
    });

    it('keeps legislation text shape compatible when no full text is available', () => {
        const { deadlines } = getCivilDeadlines({
            imerominia_katathesis: '2026-01-15',
            diadikasia: SUPPORTED_DIADIKASIA,
        });

        for (const deadline of deadlines) {
            if (deadline.type === CivilDeadlineCode.katathesi) {
                expect(deadline.nomothesia).toEqual([]);
                expect(deadline.formattedNomothesia).toEqual([]);
                continue;
            }

            expect(deadline.nomothesia.length).toBe(1);
            // formattedNomothesia is populated for codes with known article text;
            // when populated, it should expose a non-empty article and text payload
            if (deadline.formattedNomothesia.length > 0) {
                expect(deadline.formattedNomothesia[0].article.length).toBeGreaterThan(0);
                expect(deadline.formattedNomothesia[0].text.length).toBeGreaterThan(0);
            }
        }
    });

    it('should format civil deadlines from filing date', () => {
        const { deadlines } = getCivilDeadlines({
            imerominia_katathesis: '2026-01-15',
            diadikasia: SUPPORTED_DIADIKASIA,
        });

        expect(formatCivilDeadlines(deadlines)).toMatchInlineSnapshot(`
          "2026-01-15 - Κατάθεση                   
          2026-02-16 - Επίδοση                      30 ημέρες μετά katathesi [skipped: 2026-02-14, 2026-02-15]
          2026-03-30 - Παρέμβαση                    40 ημέρες μετά epidosi [skipped: 2026-03-28, 2026-03-29]
          2026-04-27 - Παρέμβαση προσεπικαλούμενου  70 ημέρες μετά epidosi
          2026-05-18 - Προτάσεις & Αποδεικτικά      90 ημέρες μετά epidosi [skipped: 2026-05-17]
          2026-06-02 - Προσθήκη – αντίκρουση        15 ημέρες μετά protaseis
          2026-06-12 - Ορισμός δικαστή              10 ημέρες μετά prosthiki"
        `);
    });

    describe('json snapshots', () => {
        it('snapshots επίδοση as JSON', () => {
            const { deadlines } = getCivilDeadlines({
                imerominia_katathesis: '2026-01-15',
                diadikasia: SUPPORTED_DIADIKASIA,
            });

            const deadline = deadlines.find(d => d.type === CivilDeadlineCode.epidosi);
            expect(JSON.parse(JSON.stringify(deadline))).toMatchInlineSnapshot(`
              {
                "calculation": {
                  "date": "2026-02-16",
                  "logic": {
                    "day_count": "CALENDAR",
                    "days": 30,
                    "name": "Κατάθεση",
                    "reference": "katathesi",
                    "start": "2026-01-15",
                    "when": "after",
                  },
                  "paused": [],
                  "skipped": [
                    "2026-02-14",
                    "2026-02-15",
                  ],
                },
                "date": "2026-02-16",
                "formattedNomothesia": [
                  {
                    "article": "Άρθρο 215 §2 ΚΠολΔ (από 1.1.2026)",
                    "highlighted": [
                      "Αν δεν ορίζεται άλλως, η αγωγή επιδίδεται στον εναγόμενο μέσα σε προθεσμία τριάντα (30) ημερών από την κατάθεσή της.",
                    ],
                    "text": "Αν δεν ορίζεται άλλως, η αγωγή επιδίδεται στον εναγόμενο μέσα σε προθεσμία τριάντα (30) ημερών από την κατάθεσή της. Αν η αγωγή πρέπει να επιδοθεί στο εξωτερικό, εντός του διαστήματος αυτού πρέπει να έχει επιδοθεί στον εισαγγελέα, κατά την παρ. 1 του άρθρου 134. Από την επίδοση της αγωγής μπορεί να ξεκινήσει και η διαδικασία διαμεσολάβησης, όπου προβλέπεται υποχρεωτική αρχική συνεδρία διαμεσολάβησης. Αν η αγωγή δεν επιδοθεί νομίμως μέσα στην προθεσμία αυτή, θεωρείται ως μη ασκηθείσα.",
                  },
                ],
                "name": "Επίδοση",
                "nomothesia": [
                  "Άρθρο 215 §2 ΚΠολΔ",
                ],
                "shortName": "Επίδοση",
                "type": "epidosi",
              }
            `);
        });

        it('snapshots παρέμβαση as JSON', () => {
            const { deadlines } = getCivilDeadlines({
                imerominia_katathesis: '2026-01-15',
                diadikasia: SUPPORTED_DIADIKASIA,
            });

            const deadline = deadlines.find(d => d.type === CivilDeadlineCode.paremvasi);
            expect(JSON.parse(JSON.stringify(deadline))).toMatchInlineSnapshot(`
              {
                "calculation": {
                  "date": "2026-03-30",
                  "logic": {
                    "day_count": "CALENDAR",
                    "days": 40,
                    "name": "Επίδοση",
                    "reference": "epidosi",
                    "start": "2026-02-16",
                    "when": "after",
                  },
                  "paused": [],
                  "skipped": [
                    "2026-03-28",
                    "2026-03-29",
                  ],
                },
                "date": "2026-03-30",
                "formattedNomothesia": [
                  {
                    "article": "Άρθρο 238 §1 ΚΠολΔ (από 1.1.2026)",
                    "highlighted": [
                      "Παρεμπίπτουσες αγωγές, ανταγωγές, παρεμβάσεις, προσεπικλήσεις και ανακοινώσεις στην περίπτωση του άρθρου 237 κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία σαράντα (40) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής",
                    ],
                    "text": "Παρεμπίπτουσες αγωγές, ανταγωγές, παρεμβάσεις, προσεπικλήσεις και ανακοινώσεις στην περίπτωση του άρθρου 237 κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία σαράντα (40) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Παρεμβάσεις μετά από προσεπίκληση ή ανακοίνωση κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία εβδομήντα (70) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Αν ο αρχικός εναγόμενος ή κάποιος από τους ομοδίκους του διαμένει στο εξωτερικό ή είναι άγνωστης διαμονής, οι ως άνω προθεσμίες παρατείνονται σε εβδομήντα (70) και εκατό (100) ημέρες, αντίστοιχα, από το πέρας της προθεσμίας επίδοσης της αγωγής. Η κατάθεση των προτάσεων γίνεται σε προθεσμία ενενήντα (90) ημερών και στην περίπτωση του προηγούμενου εδαφίου σε προθεσμία εκατόν είκοσι (120) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Για την προσθήκη ισχύει η παρ. 2 του άρθρου 237.",
                  },
                ],
                "name": "Παρεμπίπτουσες αγωγές, ανταγωγή, παρέμβαση, προσεπίκληση, ανακοίνωση",
                "nomothesia": [
                  "Άρθρο 238 §1 ΚΠολΔ",
                ],
                "shortName": "Παρέμβαση",
                "type": "paremvasi",
              }
            `);
        });

        it('snapshots παρέμβαση προσεπικαλούμενου as JSON', () => {
            const { deadlines } = getCivilDeadlines({
                imerominia_katathesis: '2026-01-15',
                diadikasia: SUPPORTED_DIADIKASIA,
            });

            const deadline = deadlines.find(d => d.type === CivilDeadlineCode.paremvasiProsek);
            expect(JSON.parse(JSON.stringify(deadline))).toMatchInlineSnapshot(`
              {
                "calculation": {
                  "date": "2026-04-27",
                  "logic": {
                    "day_count": "CALENDAR",
                    "days": 70,
                    "name": "Επίδοση",
                    "reference": "epidosi",
                    "start": "2026-02-16",
                    "when": "after",
                  },
                  "paused": [],
                  "skipped": [],
                },
                "date": "2026-04-27",
                "formattedNomothesia": [
                  {
                    "article": "Άρθρο 238 §1 ΚΠολΔ (από 1.1.2026)",
                    "highlighted": [
                      "Παρεμβάσεις μετά από προσεπίκληση ή ανακοίνωση κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία εβδομήντα (70) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής",
                    ],
                    "text": "Παρεμπίπτουσες αγωγές, ανταγωγές, παρεμβάσεις, προσεπικλήσεις και ανακοινώσεις στην περίπτωση του άρθρου 237 κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία σαράντα (40) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Παρεμβάσεις μετά από προσεπίκληση ή ανακοίνωση κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία εβδομήντα (70) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Αν ο αρχικός εναγόμενος ή κάποιος από τους ομοδίκους του διαμένει στο εξωτερικό ή είναι άγνωστης διαμονής, οι ως άνω προθεσμίες παρατείνονται σε εβδομήντα (70) και εκατό (100) ημέρες, αντίστοιχα, από το πέρας της προθεσμίας επίδοσης της αγωγής. Η κατάθεση των προτάσεων γίνεται σε προθεσμία ενενήντα (90) ημερών και στην περίπτωση του προηγούμενου εδαφίου σε προθεσμία εκατόν είκοσι (120) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Για την προσθήκη ισχύει η παρ. 2 του άρθρου 237.",
                  },
                ],
                "name": "Παρέμβαση προσεπικαλούμενου",
                "nomothesia": [
                  "άρθρο 238 §1 εδ. β΄ ΚΠολΔ",
                ],
                "shortName": "Παρέμβαση προσεπικαλούμενου",
                "type": "paremvasiProsek",
              }
            `);
        });

        it('snapshots προτάσεις as JSON', () => {
            const { deadlines } = getCivilDeadlines({
                imerominia_katathesis: '2026-01-15',
                diadikasia: SUPPORTED_DIADIKASIA,
            });

            const deadline = deadlines.find(d => d.type === CivilDeadlineCode.protaseis);
            expect(JSON.parse(JSON.stringify(deadline))).toMatchInlineSnapshot(`
              {
                "calculation": {
                  "date": "2026-05-18",
                  "logic": {
                    "day_count": "CALENDAR",
                    "days": 90,
                    "name": "Επίδοση",
                    "reference": "epidosi",
                    "start": "2026-02-16",
                    "when": "after",
                  },
                  "paused": [],
                  "skipped": [
                    "2026-05-17",
                  ],
                },
                "date": "2026-05-18",
                "formattedNomothesia": [
                  {
                    "article": "Άρθρο 238 §1 ΚΠολΔ (από 1.1.2026)",
                    "highlighted": [
                      "Η κατάθεση των προτάσεων γίνεται σε προθεσμία ενενήντα (90) ημερών",
                      "από το πέρας της προθεσμίας επίδοσης της αγωγής",
                    ],
                    "text": "Παρεμπίπτουσες αγωγές, ανταγωγές, παρεμβάσεις, προσεπικλήσεις και ανακοινώσεις στην περίπτωση του άρθρου 237 κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία σαράντα (40) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Παρεμβάσεις μετά από προσεπίκληση ή ανακοίνωση κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία εβδομήντα (70) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Αν ο αρχικός εναγόμενος ή κάποιος από τους ομοδίκους του διαμένει στο εξωτερικό ή είναι άγνωστης διαμονής, οι ως άνω προθεσμίες παρατείνονται σε εβδομήντα (70) και εκατό (100) ημέρες, αντίστοιχα, από το πέρας της προθεσμίας επίδοσης της αγωγής. Η κατάθεση των προτάσεων γίνεται σε προθεσμία ενενήντα (90) ημερών και στην περίπτωση του προηγούμενου εδαφίου σε προθεσμία εκατόν είκοσι (120) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Για την προσθήκη ισχύει η παρ. 2 του άρθρου 237.",
                  },
                ],
                "name": "Κατάθεση προτάσεων και αποδεικτικών μέσων",
                "nomothesia": [
                  "άρθρο 237 §1 ΚΠολΔ",
                ],
                "shortName": "Προτάσεις & Αποδεικτικά",
                "type": "protaseis",
              }
            `);
        });

        it('snapshots προσθήκη as JSON', () => {
            const { deadlines } = getCivilDeadlines({
                imerominia_katathesis: '2026-01-15',
                diadikasia: SUPPORTED_DIADIKASIA,
            });

            const deadline = deadlines.find(d => d.type === CivilDeadlineCode.prosthiki);
            expect(JSON.parse(JSON.stringify(deadline))).toMatchInlineSnapshot(`
              {
                "calculation": {
                  "date": "2026-06-02",
                  "logic": {
                    "day_count": "CALENDAR",
                    "days": 15,
                    "name": "Προτάσεις",
                    "reference": "protaseis",
                    "start": "2026-05-18",
                    "when": "after",
                  },
                  "paused": [],
                  "skipped": [],
                },
                "date": "2026-06-02",
                "formattedNomothesia": [
                  {
                    "article": "Άρθρο 237 §2 ΚΠολΔ (από 1.1.2026)",
                    "highlighted": [
                      "Η προσθήκη - αντίκρουση κατατίθεται εντός των επόμενων δεκαπέντε (15) ημερών από τη λήξη της προθεσμίας κατάθεσης των προτάσεων",
                      "Στην ίδια προθεσμία κατατίθεται και το δικαστικό ένσημο",
                    ],
                    "text": "Η προσθήκη - αντίκρουση κατατίθεται εντός των επόμενων δεκαπέντε (15) ημερών από τη λήξη της προθεσμίας κατάθεσης των προτάσεων. Στην ίδια προθεσμία κατατίθεται και το δικαστικό ένσημο. Εντός των επόμενων δέκα (10) ημερών από την τελευταία αυτή προθεσμία ορίζεται ο δικαστής ή, επί πολυμελούς δικαστηρίου, η σύνθεση και ο εισηγητής για την εκδίκαση της διαφοράς.",
                  },
                ],
                "name": "Προσθήκη – αντίκρουση",
                "nomothesia": [
                  "Άρθρο 237 §2 ΚΠολΔ",
                ],
                "shortName": "Προσθήκη – αντίκρουση",
                "type": "prosthiki",
              }
            `);
        });

        it('snapshots ορισμός δικαστή as JSON', () => {
            const { deadlines } = getCivilDeadlines({
                imerominia_katathesis: '2026-01-15',
                diadikasia: SUPPORTED_DIADIKASIA,
            });

            const deadline = deadlines.find(d => d.type === CivilDeadlineCode.orismos_dikasti_synthesis);
            expect(JSON.parse(JSON.stringify(deadline))).toMatchInlineSnapshot(`
              {
                "calculation": {
                  "date": "2026-06-12",
                  "logic": {
                    "day_count": "CALENDAR",
                    "days": 10,
                    "name": "Προσθήκη",
                    "reference": "prosthiki",
                    "start": "2026-06-02",
                    "when": "after",
                  },
                  "paused": [],
                  "skipped": [],
                },
                "date": "2026-06-12",
                "formattedNomothesia": [
                  {
                    "article": "Άρθρο 237 §2 ΚΠολΔ (από 1.1.2026)",
                    "highlighted": [
                      "Εντός των επόμενων δέκα (10) ημερών από την τελευταία αυτή προθεσμία ορίζεται ο δικαστής ή, επί πολυμελούς δικαστηρίου, η σύνθεση και ο εισηγητής για την εκδίκαση της διαφοράς",
                    ],
                    "text": "Η προσθήκη - αντίκρουση κατατίθεται εντός των επόμενων δεκαπέντε (15) ημερών από τη λήξη της προθεσμίας κατάθεσης των προτάσεων. Στην ίδια προθεσμία κατατίθεται και το δικαστικό ένσημο. Εντός των επόμενων δέκα (10) ημερών από την τελευταία αυτή προθεσμία ορίζεται ο δικαστής ή, επί πολυμελούς δικαστηρίου, η σύνθεση και ο εισηγητής για την εκδίκαση της διαφοράς.",
                  },
                ],
                "name": "Ορισμός δικαστή / σύνθεσης",
                "nomothesia": [
                  "Άρθρο 237 §2 ΚΠολΔ",
                ],
                "shortName": "Ορισμός δικαστή",
                "type": "orismos_dikasti_synthesis",
              }
            `);
        });

    });

    describe('anastoli', () => {
        it('pauses counting in August for standard (non-dimosio) filing', () => {
            const { deadlines } = getCivilDeadlines({
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

        it('pauses counting in July, August, and Sept 1–15 for dimosio filing', () => {
            const { deadlines } = getCivilDeadlines({
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

            expect(julyDates.length).toBe(31);
            expect(augustDates.length).toBe(31);
            expect(septDates.length).toBe(15);
        });

        it('should format civil deadlines from filing date crossing anastoli', () => {
            const { deadlines } = getCivilDeadlines({
                imerominia_katathesis: '2026-06-01',
                diadikasia: SUPPORTED_DIADIKASIA,
                dimosio: true,
            });

            expect(formatCivilDeadlines(deadlines)).toMatchInlineSnapshot(`
              "2026-06-01 - Κατάθεση                   
              2026-09-16 - Επίδοση                      30 ημέρες μετά katathesi [paused: 77]
              2026-10-26 - Παρέμβαση                    40 ημέρες μετά epidosi
              2026-11-25 - Παρέμβαση προσεπικαλούμενου  70 ημέρες μετά epidosi
              2026-12-15 - Προτάσεις & Αποδεικτικά      90 ημέρες μετά epidosi
              2026-12-30 - Προσθήκη – αντίκρουση        15 ημέρες μετά protaseis
              2027-01-11 - Ορισμός δικαστή              10 ημέρες μετά prosthiki [skipped: 2027-01-09, 2027-01-10]"
            `);
        });

        it('dimosio deadlines are later than standard deadlines due to extended suspension', () => {
            const standard = getCivilDeadlines({
                imerominia_katathesis: '2026-06-01',
                diadikasia: SUPPORTED_DIADIKASIA,
            });
            const dimosio = getCivilDeadlines({
                imerominia_katathesis: '2026-06-01',
                diadikasia: SUPPORTED_DIADIKASIA,
                dimosio: true,
            });

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
