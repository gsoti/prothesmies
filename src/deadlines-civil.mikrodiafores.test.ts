import { describe, expect, it } from 'vitest';
import { getCivilDeadlines } from './deadlines-civil.js';
import { CivilDeadlineCode } from './types.js';
import { formatCivilDeadlines } from './test-helpers/formatCivilDeadlines.js';

const SUPPORTED_DIADIKASIA = 'ΜΙΚΡΟΔΙΑΦΟΡΕΣ';

describe('getCivilDeadlines for ΜΙΚΡΟΔΙΑΦΟΡΕΣ', () => {
    it('should format civil deadlines from filing date', () => {
        const { deadlines } = getCivilDeadlines({
            imerominia_katathesis: '2023-03-24',
            diadikasia: SUPPORTED_DIADIKASIA,
            dikasimos: '2025-03-06',
            apotelesma: 'ΣΥΖΗΤΗΘΗΚΕ',
        });

        expect(formatCivilDeadlines(deadlines)).toMatchInlineSnapshot(`
          "2023-03-24 - Κατάθεση                 
          2023-04-03 - Επίδοση                    10 ημέρες μετά katathesi
          2023-04-13 - Παρέμβαση                  20 ημέρες μετά katathesi
          2023-04-24 - Προσκομιδή του εναγομένου  20 ημέρες μετά epidosi [skipped: 2023-04-23]
          2023-05-02 - Προσθήκη                   5 ημέρες μετά proskomidi [skipped: 2023-04-29, 2023-04-30, 2023-05-01]
          2025-03-06 - Δικάσιμος                "
        `);
    });

    it('should format post-2026 civil deadlines from filing date when exoteriko is false', () => {
        const { deadlines } = getCivilDeadlines({
            imerominia_katathesis: '2026-03-24',
            diadikasia: SUPPORTED_DIADIKASIA,
            dikasimos: '2026-05-27',
            apotelesma: 'ΣΥΖΗΤΗΘΗΚΕ',
            exoteriko: false,
        });

        expect(formatCivilDeadlines(deadlines)).toMatchInlineSnapshot(`
          "2026-03-24 - Κατάθεση                 
          2026-04-03 - Επίδοση                    10 ημέρες μετά katathesi
          2026-04-14 - Παρέμβαση                  20 ημέρες μετά katathesi [skipped: 2026-04-13]
          2026-04-23 - Προσκομιδή του εναγομένου  20 ημέρες μετά epidosi
          2026-04-28 - Προσθήκη                   5 ημέρες μετά proskomidi
          2026-05-27 - Δικάσιμος                
          2026-06-04 - Προσθήκη – αντίκρουση      5 ΕΡΓΑΣΙΜΕΣ ημέρες μετά dikasimos [paused: 3]"
        `);
    });

    it('uses 30-day epidosi for pre-2026 mikrodiafores when exoteriko is true', () => {
        const { deadlines } = getCivilDeadlines({
            imerominia_katathesis: '2023-03-24',
            diadikasia: SUPPORTED_DIADIKASIA,
            exoteriko: true,
        });

        expect(deadlines.find(d => d.type === CivilDeadlineCode.epidosi)?.calculation?.logic.days).toBe(30);
        expect(deadlines.find(d => d.type === CivilDeadlineCode.epidosi)?.date).toBe('2023-04-24');
        expect(deadlines.find(d => d.type === CivilDeadlineCode.paremvasi)?.calculation?.logic.days).toBe(40);
        expect(deadlines.find(d => d.type === CivilDeadlineCode.paremvasi)?.date).toBe('2023-05-03');
        expect(deadlines.find(d => d.type === CivilDeadlineCode.epidosi)?.formattedNomothesia[0]?.highlighted).toEqual([
            'Αν ο εναγόμενος διαμένει στο εξωτερικό ή είναι άγνωστης διαμονής η αγωγή επιδίδεται σε προθεσμία τριάντα (30) ημερών από την κατάθεσή της',
        ]);
        expect(deadlines.find(d => d.type === CivilDeadlineCode.paremvasi)?.formattedNomothesia[0]?.highlighted).toEqual([
            'Παρεμβάσεις και ανταγωγές κατατίθενται και επιδίδονται στους διαδίκους μέσα σε προθεσμία είκοσι (20) ημερών από την κατάθεση της αγωγής. Η προθεσμία αυτή παρατείνεται κατά είκοσι (20) ημέρες αν ο εναγόμενος διαμένει στο εξωτερικό ή είναι άγνωστης διαμονής',
        ]);
    });

    it('uses 10-day epidosi for post-2026 mikrodiafores even when exoteriko is true', () => {
        const { deadlines } = getCivilDeadlines({
            imerominia_katathesis: '2026-03-24',
            diadikasia: SUPPORTED_DIADIKASIA,
            exoteriko: true,
        });

        expect(deadlines.find(d => d.type === CivilDeadlineCode.epidosi)?.calculation?.logic.days).toBe(10);
        expect(deadlines.find(d => d.type === CivilDeadlineCode.epidosi)?.date).toBe('2026-04-03');
    });

    it('adds post-2026 article 469 deadline when apotelesma is ΣΥΖΗΤΗΘΗΚΕ', () => {
        const { deadlines } = getCivilDeadlines({
            imerominia_katathesis: '2026-03-24',
            diadikasia: SUPPORTED_DIADIKASIA,
            dikasimos: '2026-04-27',
            apotelesma: 'ΣΥΖΗΤΗΘΗΚΕ',
        });

        const deadline = deadlines.find(d => d.type === CivilDeadlineCode.prosthikiAntikrousiNeoiIsxyrismoi);
        expect(deadline?.date).toBe('2026-05-05');
        expect(deadline?.calculation?.logic).toEqual({
            days: 5,
            day_count: 'WORKING',
            when: 'after',
            reference: 'dikasimos',
            start: '2026-04-27',
            name: 'Δικάσιμος',
        });
        expect(deadline?.formattedNomothesia).toEqual([
            {
                article: 'Άρθρο 469 §1 ΚΠολΔ (από 1.1.2026)',
                text: 'Κατά την ορισμένη δικάσιμο η υπόθεση συζητείται ακόμα και αν δεν παρίσταται κανείς διάδικος. Αναβολή της συζήτησης κατά το άρθρο 241 δεν επιτρέπεται. Οι παριστάμενοι κατά τη συζήτηση διάδικοι μπορούν, κατά την κρίση του Δικαστή, να εξετάζονται κατ άρθρο 415 ή να παρέχουν διασαφήσεις για την υπόθεση, οι δε ενόρκως βεβαιώσαντες να καταθέτουν συμπληρωματικά, εφόσον είναι παρόντες και ο Δικαστής κρίνει τούτο απολύτως αναγκαίο. Νέοι ισχυρισμοί μπορούν να προταθούν μόνον εάν αποδεικνύονται εγγράφως ή με δικαστική ομολογία του αντιδίκου και προέκυψαν μεταγενέστερα. Σε περίπτωση νέων ισχυρισμών επιτρέπεται η προσθήκη αντίκρουση εντός πέντε (5) εργάσιμων ημερών από τη συζήτηση. Μετά το πέρας της συζήτησης ο δικαστής δύναται να ζητεί από τους διαδίκους να προσκομίσουν σε ηλεκτρονική μορφή αντίγραφο του δικογράφου της αγωγής, του υπομνήματος και της προσθήκης.',
                highlighted: [
                    'Σε περίπτωση νέων ισχυρισμών επιτρέπεται η προσθήκη αντίκρουση εντός πέντε (5) εργάσιμων ημερών από τη συζήτηση',
                ],
            },
        ]);
    });

    it('does not add article 469 deadline when apotelesma is not ΣΥΖΗΤΗΘΗΚΕ', () => {
        const { deadlines } = getCivilDeadlines({
            imerominia_katathesis: '2026-03-24',
            diadikasia: SUPPORTED_DIADIKASIA,
            dikasimos: '2026-04-27',
            apotelesma: 'ΑΝΑΒΛΗΘΗΚΕ',
        });

        expect(deadlines.find(d => d.type === CivilDeadlineCode.prosthikiAntikrousiNeoiIsxyrismoi)).toBeUndefined();
    });

    describe('json snapshots', () => {
        it('snapshots επίδοση as JSON', () => {
            const { deadlines } = getCivilDeadlines({
                imerominia_katathesis: '2023-03-24',
                diadikasia: SUPPORTED_DIADIKASIA,
                dikasimos: '2025-03-04',
                apotelesma: 'ΣΥΖΗΤΗΘΗΚΕ',
            });

            const deadline = deadlines.find(d => d.type === CivilDeadlineCode.epidosi);
            expect(JSON.parse(JSON.stringify(deadline))).toMatchInlineSnapshot(`
              {
                "calculation": {
                  "date": "2023-04-03",
                  "logic": {
                    "day_count": "CALENDAR",
                    "days": 10,
                    "name": "Κατάθεση",
                    "reference": "katathesi",
                    "start": "2023-03-24",
                    "when": "after",
                  },
                  "paused": [],
                  "skipped": [],
                },
                "date": "2023-04-03",
                "formattedNomothesia": [
                  {
                    "article": "Άρθρο 468 §1 ΚΠολΔ",
                    "highlighted": [
                      "Η αγωγή κατατίθεται στη γραμματεία του ειρηνοδικείου και επιδίδεται στον εναγόμενο μέσα σε προθεσμία δέκα (10) ημερών από την κατάθεσή της",
                    ],
                    "text": "Η αγωγή κατατίθεται στη γραμματεία του ειρηνοδικείου και επιδίδεται στον εναγόμενο μέσα σε προθεσμία δέκα (10) ημερών από την κατάθεσή της. Αν ο εναγόμενος διαμένει στο εξωτερικό ή είναι άγνωστης διαμονής η αγωγή επιδίδεται σε προθεσμία τριάντα (30) ημερών από την κατάθεσή της. Το δεύτερο εδάφιο της παρ. 2 του άρθρου 215 εφαρμόζεται αναλόγως.",
                  },
                ],
                "name": "Επίδοση",
                "nomothesia": [
                  "Αρθ.468 § 1 ΚΠολΔ. Η αγωγή κατατίθεται στη γραμματεία του ειρηνοδικείου και επιδίδεται στον εναγόμενο μέσα σε προθεσμία δέκα (10) ημερών από την κατάθεσή της. Αν ο εναγόμενος διαμένει στο εξωτερικό ή είναι άγνωστης διαμονής η αγωγή επιδίδεται σε προθεσμία τριάντα (30) ημερών από την κατάθεσή της. Το δεύτερο εδάφιο της παρ. 2 του άρθρου 215 εφαρμόζεται αναλόγως.",
                ],
                "shortName": "Επίδοση",
                "type": "epidosi",
              }
            `);
        });

        it('snapshots παρέμβαση as JSON', () => {
            const { deadlines } = getCivilDeadlines({
                imerominia_katathesis: '2023-03-24',
                diadikasia: SUPPORTED_DIADIKASIA,
                dikasimos: '2025-03-04',
                apotelesma: 'ΣΥΖΗΤΗΘΗΚΕ',
            });

            const deadline = deadlines.find(d => d.type === CivilDeadlineCode.paremvasi);
            expect(JSON.parse(JSON.stringify(deadline))).toMatchInlineSnapshot(`
              {
                "calculation": {
                  "date": "2023-04-13",
                  "logic": {
                    "day_count": "CALENDAR",
                    "days": 20,
                    "name": "Κατάθεση",
                    "reference": "katathesi",
                    "start": "2023-03-24",
                    "when": "after",
                  },
                  "paused": [],
                  "skipped": [],
                },
                "date": "2023-04-13",
                "formattedNomothesia": [
                  {
                    "article": "Άρθρο 468 §3 ΚΠολΔ",
                    "highlighted": [
                      "Παρεμβάσεις και ανταγωγές κατατίθενται και επιδίδονται στους διαδίκους μέσα σε προθεσμία είκοσι (20) ημερών από την κατάθεση της αγωγής",
                    ],
                    "text": "Παρεμβάσεις και ανταγωγές κατατίθενται και επιδίδονται στους διαδίκους μέσα σε προθεσμία είκοσι (20) ημερών από την κατάθεση της αγωγής. Η προθεσμία αυτή παρατείνεται κατά είκοσι (20) ημέρες αν ο εναγόμενος διαμένει στο εξωτερικό ή είναι άγνωστης διαμονής. Η προσκομιδή των αποδεικτικών μέσων και το έγγραφο υπόμνημα των ισχυρισμών στις περιπτώσεις του δεύτερου εδαφίου γίνονται σε προθεσμία τριάντα (30) ή πενήντα (50) ημερών, αντίστοιχα, από την κατάθεση της αγωγής και η έγγραφη προσθήκη- αντίκρουση στην προθεσμία του τρίτου εδαφίου της παρ. 2.",
                  },
                ],
                "name": "Παρέμβαση, προσεπίκληση, ανακοίνωση ή ανταγωγή",
                "nomothesia": [
                  "Αρθ.468 § 3 ΚΠολΔ. Παρεμβάσεις και ανταγωγές κατατίθενται και επιδίδονται στους διαδίκους μέσα σε προθεσμία είκοσι (20) ημερών από την κατάθεση της αγωγής. Η προθεσμία αυτή παρατείνεται κατά είκοσι (20) ημέρες αν ο εναγόμενος διαμένει στο εξωτερικό ή είναι άγνωστης διαμονής. Η προσκομιδή των αποδεικτικών μέσων και το έγγραφο υπόμνημα των ισχυρισμών στις περιπτώσεις του δεύτερου εδαφίου γίνονται σε προθεσμία τριάντα (30) ή πενήντα (50) ημερών, αντίστοιχα, από την κατάθεση της αγωγής και η έγγραφη προσθήκη αντίκρουση στην προθεσμία του τρίτου εδαφίου της παρ. 2.",
                ],
                "shortName": "Παρέμβαση",
                "type": "paremvasi",
              }
            `);
        });

        it('snapshots προσκομιδή του εναγομένου as JSON', () => {
            const { deadlines } = getCivilDeadlines({
                imerominia_katathesis: '2023-03-24',
                diadikasia: SUPPORTED_DIADIKASIA,
                dikasimos: '2025-03-04',
                apotelesma: 'ΣΥΖΗΤΗΘΗΚΕ',
            });

            const deadline = deadlines.find(d => d.type === CivilDeadlineCode.protaseis);
            expect(JSON.parse(JSON.stringify(deadline))).toMatchInlineSnapshot(`
              {
                "calculation": {
                  "date": "2023-04-24",
                  "logic": {
                    "day_count": "CALENDAR",
                    "days": 20,
                    "name": "Επίδοση",
                    "reference": "epidosi",
                    "start": "2023-04-03",
                    "when": "after",
                  },
                  "paused": [],
                  "skipped": [
                    "2023-04-23",
                  ],
                },
                "date": "2023-04-24",
                "formattedNomothesia": [
                  {
                    "article": "Άρθρο 468 §2 ΚΠολΔ",
                    "highlighted": [
                      "Μέσα σε είκοσι (20) ημέρες από τη λήξη της προθεσμίας για την επίδοση της αγωγής, οι διάδικοι προσκομίζουν στο ειρηνοδικείο τα αποδεικτικά τους μέσα και ο εναγόμενος υποβάλλει με έγγραφο υπόμνημα τους ισχυρισμούς του",
                    ],
                    "text": "Μέσα σε είκοσι (20) ημέρες από τη λήξη της προθεσμίας για την επίδοση της αγωγής, οι διάδικοι προσκομίζουν στο ειρηνοδικείο τα αποδεικτικά τους μέσα και ο εναγόμενος υποβάλλει με έγγραφο υπόμνημα τους ισχυρισμούς του. Μέχρι δύο (2) ένορκες βεβαιώσεις, επιτρέπονται και χωρίς κλήση του αντιδίκου. Εντός προθεσμίας πέντε (5) ημερών από τη λήξη της ως άνω προθεσμίας οι διάδικοι μπορούν να καταθέσουν έγγραφη προσθήκη - αντίκρουση. Νέοι ισχυρισμοί με την προσθήκη μπορεί να προταθούν και νέα αποδεικτικά μέσα να προσκομισθούν μόνο για την αντίκρουση ισχυρισμών που περιέχονται στο ως άνω υπόμνημα. Εκπρόθεσμα αποδεικτικά μέσα και ισχυρισμοί των διαδίκων δεν λαμβάνονται υπόψη.",
                  },
                ],
                "name": "Προσκομιδή των αποδεικτικών από τους διαδίκους και η υποβολή του έγγραφου υπομνήματος του εναγομένου",
                "nomothesia": [
                  "Αρθ.468 § 2 ΚΠολΔ.  Μέσα σε είκοσι (20) ημέρες από τη λήξη της προθεσμίας για την επίδοση της αγωγής, οι διάδικοι προσκομίζουν στο ειρηνοδικείο τα αποδεικτικά τους μέσα και ο εναγόμενος υποβάλλει με έγγραφο υπόμνημα τους ισχυρισμούς του. Μέχρι δύο (2) ένορκες βεβαιώσεις, επιτρέπονται και χωρίς κλήση του αντιδίκου. Εντός προθεσμίας πέντε (5) ημερών από τη λήξη της ως άνω προθεσμίας οι διάδικοι μπορούν να καταθέσουν έγγραφη προσθήκη αντίκρουση. Νέοι ισχυρισμοί με την προσθήκη μπορεί να προταθούν και νέα αποδεικτικά μέσα να προσκομισθούν μόνο για την αντίκρουση ισχυρισμών που περιέχονται στο ως άνω υπόμνημα. Εκπρόθεσμα αποδεικτικά μέσα και ισχυρισμοί των διαδίκων δεν λαμβάνονται υπόψη.",
                ],
                "shortName": "Προσκομιδή του εναγομένου",
                "type": "protaseis",
              }
            `);
        });

        it('snapshots προσθήκη as JSON', () => {
            const { deadlines } = getCivilDeadlines({
                imerominia_katathesis: '2023-03-24',
                diadikasia: SUPPORTED_DIADIKASIA,
                dikasimos: '2025-03-04',
                apotelesma: 'ΣΥΖΗΤΗΘΗΚΕ',
            });

            const deadline = deadlines.find(d => d.type === CivilDeadlineCode.prosthiki);
            expect(JSON.parse(JSON.stringify(deadline))).toMatchInlineSnapshot(`
              {
                "calculation": {
                  "date": "2023-05-02",
                  "logic": {
                    "day_count": "CALENDAR",
                    "days": 5,
                    "name": "Προσκομιδή του εναγομένου",
                    "reference": "proskomidi",
                    "start": "2023-04-24",
                    "when": "after",
                  },
                  "paused": [],
                  "skipped": [
                    "2023-04-29",
                    "2023-04-30",
                    "2023-05-01",
                  ],
                },
                "date": "2023-05-02",
                "formattedNomothesia": [
                  {
                    "article": "Άρθρο 468 §2 ΚΠολΔ",
                    "highlighted": [
                      "Εντός προθεσμίας πέντε (5) ημερών από τη λήξη της ως άνω προθεσμίας οι διάδικοι μπορούν να καταθέσουν έγγραφη προσθήκη - αντίκρουση",
                    ],
                    "text": "Μέσα σε είκοσι (20) ημέρες από τη λήξη της προθεσμίας για την επίδοση της αγωγής, οι διάδικοι προσκομίζουν στο ειρηνοδικείο τα αποδεικτικά τους μέσα και ο εναγόμενος υποβάλλει με έγγραφο υπόμνημα τους ισχυρισμούς του. Μέχρι δύο (2) ένορκες βεβαιώσεις, επιτρέπονται και χωρίς κλήση του αντιδίκου. Εντός προθεσμίας πέντε (5) ημερών από τη λήξη της ως άνω προθεσμίας οι διάδικοι μπορούν να καταθέσουν έγγραφη προσθήκη - αντίκρουση. Νέοι ισχυρισμοί με την προσθήκη μπορεί να προταθούν και νέα αποδεικτικά μέσα να προσκομισθούν μόνο για την αντίκρουση ισχυρισμών που περιέχονται στο ως άνω υπόμνημα. Εκπρόθεσμα αποδεικτικά μέσα και ισχυρισμοί των διαδίκων δεν λαμβάνονται υπόψη.",
                  },
                ],
                "name": "Κατάθεση προσθήκης",
                "nomothesia": [
                  "Αρθ.468 § 2 ΚΠολΔ. Μέσα σε είκοσι (20) ημέρες από τη λήξη της προθεσμίας για την επίδοση της αγωγής, οι διάδικοι προσκομίζουν στο ειρηνοδικείο τα αποδεικτικά τους μέσα και ο εναγόμενος υποβάλλει με έγγραφο υπόμνημα τους ισχυρισμούς του. Μέχρι δύο (2) ένορκες βεβαιώσεις, επιτρέπονται και χωρίς κλήση του αντιδίκου. Εντός προθεσμίας πέντε (5) ημερών από τη λήξη της ως άνω προθεσμίας οι διάδικοι μπορούν να καταθέσουν έγγραφη προσθήκη αντίκρουση. Νέοι ισχυρισμοί με την προσθήκη μπορεί να προταθούν και νέα αποδεικτικά μέσα να προσκομισθούν μόνο για την αντίκρουση ισχυρισμών που περιέχονται στο ως άνω υπόμνημα. Εκπρόθεσμα αποδεικτικά μέσα και ισχυρισμοί των διαδίκων δεν λαμβάνονται υπόψη.",
                ],
                "shortName": "Προσθήκη",
                "type": "prosthiki",
              }
            `);
        });
    });
});
