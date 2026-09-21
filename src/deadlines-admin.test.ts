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
