import { describe, expect, it } from 'vitest';
import {
    getAdminDeadlines,
    sortAdminDeadlineRules,
} from './deadlines-admin.js';
import { ADMIN_DIAFORA_OUSIAS_RULES } from './rules/rules-admin-diafora-ousias.js';
import {
    AdminDeadlineCode,
    DeadlineRule,
    GetAdminDeadlinesInput,
} from './types.js';
import {
    ADMIN_NOMOTHESIA_SOURCE,
    GENERATED_ADMIN_NOMOTHESIA,
} from './generated/admin-nomothesia.generated.js';
import { NOMOTHESIA_TEXT } from './nomothesia-admin.js';
import { DeadlineCalculationError } from './utils/deadlineHelpers.js';

const baseInput = {
    court: 'dprotodikeioath',
    katigoria: 'Αγωγή',
    dikasimos: '2026-11-20',
};

const supportedCourts = [
    'defeteioath', 'defeteiopei', 'dprotodikeioath', 'dprotodikeiopei',
    'defeteioxan', 'dprotodikeiohra', 'dprotodikeioxan', 'dprotodikeiorod',
    'dprotodikeiosyr', 'dprotodikeiomyt', 'dprotodikeioker', 'defeteiotrp',
    'dprotodikeiokal', 'dprotodikeiokor', 'dprotodikeionaf', 'dprotodikeiotrp',
    'defeteiopat', 'dprotodikeioagr', 'dprotodikeiomes', 'dprotodikeiopat',
    'dprotodikeiopyr', 'dprotodikeiolam', 'dprotodikeioliv', 'dprotodikeioxal',
    'defeteioiwa', 'dprotodikeioiwa', 'defeteiolar', 'dprotodikeiovol',
    'dprotodikeiolar', 'dprotodikeiotri', 'dprotodikeiokoz', 'defeteiothe',
    'dprotodikeiover', 'dprotodikeiothe', 'dprotodikeioser', 'defeteiokom',
    'dprotodikeioale', 'dprotodikeiokav', 'dprotodikeiokom',
] as const;

function getSuccessfulDeadlines(input: GetAdminDeadlinesInput = baseInput) {
    const result = getAdminDeadlines(input);
    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error(`Expected success, received ${result.reason}`);
    return result.deadlines;
}

describe('getAdminDeadlines', () => {
    it('is synchronous, deterministic, and returns the stable 12-deadline result', () => {
        const firstResult = getAdminDeadlines(baseInput);
        const secondResult = getAdminDeadlines(baseInput);

        expect(firstResult).not.toBeInstanceOf(Promise);
        expect(secondResult).toEqual(firstResult);
        expect(firstResult.status).toBe('success');
        if (firstResult.status !== 'success') throw new Error('Expected successful calculation');
        const first = firstResult.deadlines;
        expect(first.map(deadline => ({
            type: deadline.type,
            date: deadline.date,
            days: deadline.calculation?.logic.days,
            dayCount: deadline.calculation?.logic.day_count,
            reference: deadline.calculation?.logic.reference,
            paused: deadline.calculation?.paused,
            skipped: deadline.calculation?.skipped,
        }))).toMatchInlineSnapshot(`
          [
            {
              "date": "2026-10-21",
              "dayCount": "CALENDAR",
              "days": 30,
              "paused": [],
              "reference": "dikasimos",
              "skipped": [],
              "type": "apopseis_fakelos_dioikisis",
            },
            {
              "date": "2026-10-30",
              "dayCount": "FULL",
              "days": 20,
              "paused": [],
              "reference": "dikasimos",
              "skipped": [
                "2026-10-31",
              ],
              "type": "anakoinosi_dikis",
            },
            {
              "date": "2026-11-05",
              "dayCount": "CALENDAR",
              "days": 15,
              "paused": [],
              "reference": "dikasimos",
              "skipped": [],
              "type": "prostheti_logoi",
            },
            {
              "date": "2026-11-05",
              "dayCount": "CALENDAR",
              "days": 15,
              "paused": [],
              "reference": "dikasimos",
              "skipped": [],
              "type": "prosepiklisi_omodikon",
            },
            {
              "date": "2026-11-13",
              "dayCount": "FULL",
              "days": 6,
              "paused": [],
              "reference": "dikasimos",
              "skipped": [
                "2026-11-14",
              ],
              "type": "paremvasi",
            },
            {
              "date": "2026-11-13",
              "dayCount": "CALENDAR",
              "days": 5,
              "paused": [],
              "reference": "dikasimos",
              "skipped": [
                "2026-11-15",
                "2026-11-14",
              ],
              "type": "aitisi_martyra",
            },
            {
              "date": "2026-11-19",
              "dayCount": "CALENDAR",
              "days": 1,
              "paused": [],
              "reference": "dikasimos",
              "skipped": [],
              "type": "dilosi_nomim_apodeiktika",
            },
            {
              "date": "2026-11-19",
              "dayCount": "CALENDAR",
              "days": 1,
              "paused": [],
              "reference": "dikasimos",
              "skipped": [],
              "type": "dikografo_omodikon",
            },
            {
              "date": "2026-11-20",
              "dayCount": "CALENDAR",
              "days": 0,
              "paused": [],
              "reference": "dikasimos",
              "skipped": [],
              "type": "paravolo",
            },
            {
              "date": "2026-11-20",
              "dayCount": "CALENDAR",
              "days": 0,
              "paused": [],
              "reference": "dikasimos",
              "skipped": [],
              "type": "dikastiko_ensimo",
            },
            {
              "date": "2026-11-25",
              "dayCount": "WORKING",
              "days": 3,
              "paused": [
                "2026-11-21",
                "2026-11-22",
              ],
              "reference": "dikasimos",
              "skipped": [],
              "type": "ypomnima",
            },
            {
              "date": "2026-11-30",
              "dayCount": "WORKING",
              "days": 3,
              "paused": [
                "2026-11-28",
                "2026-11-29",
              ],
              "reference": "ypomnima",
              "skipped": [],
              "type": "ypomnima_antikrousis",
            },
          ]
        `);
    });

    it('returns unique active codes and excludes the inactive reconciliation folder rule', () => {
        const result = getSuccessfulDeadlines();
        const codes = result.map(deadline => deadline.type);

        expect(new Set(codes).size).toBe(12);
        expect(codes).not.toContain(AdminDeadlineCode.fakelos_symvivastikou);
        expect(codes).toEqual([
            AdminDeadlineCode.apopseis_fakelos_dioikisis,
            AdminDeadlineCode.anakoinosi_dikis,
            AdminDeadlineCode.prostheti_logoi,
            AdminDeadlineCode.prosepiklisi_omodikon,
            AdminDeadlineCode.paremvasi,
            AdminDeadlineCode.aitisi_martyra,
            AdminDeadlineCode.dilosi_nomim_apodeiktika,
            AdminDeadlineCode.dikografo_omodikon,
            AdminDeadlineCode.paravolo,
            AdminDeadlineCode.dikastiko_ensimo,
            AdminDeadlineCode.ypomnima,
            AdminDeadlineCode.ypomnima_antikrousis,
        ]);
    });

    it('applies syntmisi only to the administration-file deadline', () => {
        const ordinary = getSuccessfulDeadlines();
        const shortened = getSuccessfulDeadlines({ ...baseInput, syntmisi: true });

        const ordinaryByType = new Map(ordinary.map(deadline => [deadline.type, deadline]));
        for (const deadline of shortened) {
            if (deadline.type === AdminDeadlineCode.apopseis_fakelos_dioikisis) {
                expect(deadline.date).toBe('2026-11-12');
                expect(deadline.calculation?.logic.days).toBe(8);
                expect(deadline.formattedNomothesia[0].highlighted[0]).toContain('οκτώ ημέρες');
            } else {
                expect(deadline).toEqual(ordinaryByType.get(deadline.type));
            }
        }
    });

    it('returns the generated full Article 114 for the Παρέμβαση deadline', () => {
        const ordinary = getSuccessfulDeadlines();
        const shortened = getSuccessfulDeadlines({ ...baseInput, syntmisi: true });
        const deadline = ordinary.find(item => item.type === AdminDeadlineCode.paremvasi)!;
        const shortenedDeadline = shortened.find(item => item.type === AdminDeadlineCode.paremvasi)!;
        const formatted = deadline.formattedNomothesia[0];
        const paragraphs = formatted.text.split('\n\n');

        expect(deadline.date).toBe('2026-11-13');
        expect(deadline.nomothesia).toEqual(['114 παρ. 2 ΚΔΔ']);
        expect(formatted).toEqual(GENERATED_ADMIN_NOMOTHESIA.paremvasi);
        expect(shortenedDeadline.formattedNomothesia).toEqual(deadline.formattedNomothesia);
        expect(paragraphs).toHaveLength(4);
        expect(paragraphs.map(paragraph => paragraph.match(/^«?(\d+)\./u)?.[1])).toEqual([
            '1', '2', '3', '4',
        ]);
        expect(formatted.text).toContain('άρθρου 126.');
        expect(formatted.text).not.toContain('άρθρου\n\n126.');
        expect(formatted.highlighted).toHaveLength(1);
        expect(formatted.text).toContain(formatted.highlighted[0]);
        expect(ADMIN_NOMOTHESIA_SOURCE).toEqual({
            codeId: 'kdiokd',
            sourceUrl: 'https://deep-law.io/nomothesia-kodikas-dioikitikis-dikonomias',
            scrapedAt: '2026-09-21T11:45:18.965Z',
            latestModification: 'Ν. 5197/2025',
            sha256: '8d45ed9abe9818e28ccb86bb76747cd2199ad3e9c25b5db4675f8c7a102cd871',
        });
        expect(formatted.text).toMatchInlineSnapshot(`
          "«1. Στα πρόσωπα που, κατά τα προηγούμενα άρθρα, νομιμοποιούνται να ασκήσουν παρέμβαση, ανακοινώνεται η δίκη, με κοινοποίηση του εισαγωγικού δικογράφου και γνωστοποίηση της δικασίμου είκοσι (20) τουλάχιστον πλήρεις ημέρες πριν από αυτήν, από οποιονδήποτε διάδικο.».

          2. «Η παρέμβαση ασκείται με ιδιαίτερο έγγραφο, το οποίο κατατίθεται στη γραμματεία του δικαστηρίου στο οποίο εκκρεμεί το σχετικό ένδικο βοήθημα ή μέσο και, με τη φροντίδα του παρεμβαίνοντος, επιδίδεται, με την ποινή του απαραδέκτου, σε κυρωμένο αντίγραφο στους διαδίκους τουλάχιστον έξι (6) πλήρεις ημέρες πριν από τη συζήτηση.» Κατά τα λοιπά εφαρμόζονται αναλόγως όσα ορίζονται στην παρ. 3 του άρθρου 126. Η παράλειψη της πιο πάνω επίδοσης καλύπτεται αν εκείνος προς τον οποίο αυτή έπρεπε να γίνει παρίσταται στο ακροατήριο και δεν αντιλέγει.

          3. Οι διατάξεις για την ομοδικία, τη συνάφεια και το χωρισμό δικογράφων εφαρμόζονται αναλόγως και στην παρέμβαση.

          4. Αποφάσεις, πράξεις και δικόγραφα που προβλέπεται ότι επιδίδονται στους διαδίκους, μετά την άσκηση της παρέμβασης επιδίδονται και στους παρεμβαίνοντες."
        `);
    });

    it('keeps all non-pilot administrative legislation on the legacy lookup', () => {
        const deadlines = getSuccessfulDeadlines();

        for (const deadline of deadlines) {
            if (deadline.type === AdminDeadlineCode.paremvasi) continue;
            const citation = deadline.nomothesia[0];
            expect(deadline.formattedNomothesia[0].text).toBe(NOMOTHESIA_TEXT[citation] ?? '');
        }
    });

    it('preserves the ypomnima dependency chain', () => {
        const result = getSuccessfulDeadlines();
        const ypomnima = result.find(deadline => deadline.type === AdminDeadlineCode.ypomnima)!;
        const antikrousis = result.find(deadline => deadline.type === AdminDeadlineCode.ypomnima_antikrousis)!;

        expect(antikrousis.calculation?.logic.start).toBe(ypomnima.date);
        expect(antikrousis.calculation?.logic.reference).toBe(AdminDeadlineCode.ypomnima);
    });

    it('accounts for the administrative summer suspension', () => {
        const result = getSuccessfulDeadlines({ ...baseInput, dikasimos: '2025-09-22' });
        const deadline = result.find(item => item.type === AdminDeadlineCode.prostheti_logoi)!;

        expect(deadline.date).toBe('2025-06-20');
        expect(deadline.calculation?.paused).toHaveLength(77);
        expect(deadline.calculation?.skipped).toEqual(['2025-06-22', '2025-06-21']);
    });

    it('returns legislation and calculation explanations for every deadline', () => {
        for (const deadline of getSuccessfulDeadlines()) {
            expect(deadline.calculation).not.toBeNull();
            expect(deadline.calculation?.logic.name).toBe(deadline.shortName);
            expect(deadline.nomothesia).toHaveLength(1);
            expect(deadline.formattedNomothesia).toHaveLength(1);
            for (const highlighted of deadline.formattedNomothesia[0].highlighted) {
                expect(deadline.formattedNomothesia[0].text).toContain(highlighted);
            }
        }
    });

    it.each([
        ['', 'required'],
        ['not-a-date', 'Invalid dikasimos'],
        ['2026-2-03', 'Invalid dikasimos'],
        ['2026-02-30', 'Invalid dikasimos'],
        ['2026-11-21', 'non-holiday weekday'],
        ['2026-10-28', 'non-holiday weekday'],
    ])('rejects invalid hearing date %j', (dikasimos, message) => {
        expect(() => getAdminDeadlines({ ...baseInput, dikasimos })).toThrow(message);
    });

    it.each(supportedCourts)('supports administrative court %s', court => {
        expect(getAdminDeadlines({ ...baseInput, court }).status).toBe('success');
    });

    it.each([
        ['ste', 'Αγωγή', 'ste'],
        ['legacy-court', 'Αγωγή', 'unknown_court'],
        ['dprotodikeioath', 'Προσφυγή', 'unsupported_category'],
        ['dprotodikeioath', 'ΔΟ', 'unsupported_category'],
        ['dprotodikeioath', 'Δ. Ο.', 'unsupported_category'],
        ['dprotodikeioath', 'Διαφορά Ουσίας', 'unsupported_category'],
    ])('returns not_supported for court %j and category %j', (court, katigoria, reason) => {
        expect(getAdminDeadlines({ ...baseInput, court, katigoria })).toEqual({
            status: 'not_supported',
            reason,
            deadlines: [],
        });
    });

    it.each([
        'Αγωγή',
        '  Αγωγή με Τόνο  ',
        'Κατηγορία Δ.Ο. Ενδίκου',
        'δ.ο. - ουσίας',
    ])('normalizes and supports category %j', katigoria => {
        expect(getAdminDeadlines({ ...baseInput, katigoria }).status).toBe('success');
    });

    it('rejects non-string court and category values with DeadlineCalculationError', () => {
        expect(() => getAdminDeadlines({ ...baseInput, court: null as unknown as string }))
            .toThrow(DeadlineCalculationError);
        expect(() => getAdminDeadlines({ ...baseInput, katigoria: null as unknown as string }))
            .toThrow(DeadlineCalculationError);
    });
});

describe('administrative rule graph validation', () => {
    const clone = (rule: DeadlineRule, changes: Partial<DeadlineRule>): DeadlineRule => ({
        ...rule,
        ...changes,
    });

    it('rejects a missing dependency', () => {
        const rules = [clone(ADMIN_DIAFORA_OUSIAS_RULES[0], {
            parent_deadline_code: 'missing',
        })];
        expect(() => sortAdminDeadlineRules(rules)).toThrow("Missing parent 'missing'");
    });

    it('rejects circular dependencies', () => {
        const rules = [
            clone(ADMIN_DIAFORA_OUSIAS_RULES[0], { deadline_code: 'a', parent_deadline_code: 'b' }),
            clone(ADMIN_DIAFORA_OUSIAS_RULES[1], { deadline_code: 'b', parent_deadline_code: 'a' }),
        ];
        expect(() => sortAdminDeadlineRules(rules)).toThrow('Circular dependency detected');
    });

    it('rejects duplicate deadline codes', () => {
        expect(() => sortAdminDeadlineRules([
            ADMIN_DIAFORA_OUSIAS_RULES[0],
            ADMIN_DIAFORA_OUSIAS_RULES[0],
        ])).toThrow('Duplicate deadline code');
    });
});
