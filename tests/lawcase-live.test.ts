import { describe, expect, it } from 'vitest';
import { getCivilDeadlines } from '../src/deadlines-civil.js';
import { CivilDeadlineCode, type Deadline } from '../src/types.js';
import { getArgiesForRange } from '../src/utils/argies.js';
import {
    computeLawcaseTaktiki,
    type LawcaseTaktikiDhmosio,
    type LawcaseTaktikiKat,
} from './support/lawcase.js';

const SUPPORTED_DIADIKASIA = 'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ';
const EIDOS = 'ΑΓΩΓΗ';
const LAWCASE_LIVE_ENABLED = process.env.LAWCASE_LIVE === '1';
const LAWCASE_SEED = getLawcaseSeed();
const describeLive = LAWCASE_LIVE_ENABLED ? describe : describe.skip;

const LAWCASE_DEADLINE_MAPPINGS = [
    { key: '11', code: CivilDeadlineCode.epidosi, label: 'Επίδοση' },
    { key: '12', code: CivilDeadlineCode.paremvasi, label: 'Παρέμβαση' },
    { key: '13', code: CivilDeadlineCode.paremvasiProsek, label: 'Παρέμβαση προσεπικαλούμενου' },
    { key: '14', code: CivilDeadlineCode.protaseis, label: 'Προτάσεις' },
    { key: '15', code: CivilDeadlineCode.prosthiki, label: 'Προσθήκη' },
    // { key: '16', code: CivilDeadlineCode.orismos_dikasti_synthesis, label: 'Ορισμός δικαστή' },
] as const;

const GREEK_MONTHS: Record<string, string> = {
    Ιανουαρίου: '01',
    Φεβρουαρίου: '02',
    Μαρτίου: '03',
    Απριλίου: '04',
    Μαΐου: '05',
    Μαίου: '05',
    Ιουνίου: '06',
    Ιουλίου: '07',
    Αυγούστου: '08',
    Σεπτεμβρίου: '09',
    Οκτωβρίου: '10',
    Νοεμβρίου: '11',
    Δεκεμβρίου: '12',
};

interface LawcaseLiveCase {
    filingDate: string;
    kat: LawcaseTaktikiKat;
    dhmosio: LawcaseTaktikiDhmosio;
}

describeLive('LawCase live cross-validation', () => {
    const cases = generateLiveCases();

    if (LAWCASE_LIVE_ENABLED) {
        console.info(`LawCase live seed: ${LAWCASE_SEED}`);
        console.info(
            `LawCase live cases: ${cases.map(testCase => (
                `${testCase.filingDate} kat=${testCase.kat} dhmosio=${testCase.dhmosio}`
            )).join(', ')}`
        );
    }

    it.each(cases)(
        'matches supported post-2026 taktiki deadlines for $filingDate kat=$kat dhmosio=$dhmosio',
        async (testCase) => {
            const { filingDate, kat, dhmosio } = testCase;
            const lawcase = await computeLawcaseTaktiki({
                date: toLawcaseDate(filingDate),
                kat,
                dhmosio,
                dwsidikia: '0',
                kathulhn: 'Eir',
                agwghpar: '0',
                hmerdik: '0',
                hm_dikasimou: toLawcaseDate(filingDate),
                n4842: '1',
                klhsh: '0',
            });

            expect(lawcase.data['99'], failureContext(testCase, [])).toBe('after26');

            const { deadlines, status } = getCivilDeadlines({
                imerominia_katathesis: filingDate,
                diadikasia: SUPPORTED_DIADIKASIA,
                eidos: EIDOS,
                exoteriko: kat === '2',
                dimosio: dhmosio === '2',
            });
            expect(status).toBe('success');

            const ourDeadlines = new Map(deadlines.map(deadline => [deadline.type, deadline]));
            const mismatches = LAWCASE_DEADLINE_MAPPINGS.flatMap(mapping => {
                const lawcaseText = getLawcaseText(lawcase.data[mapping.key]);
                const lawcaseDate = parseLawcaseGreekDate(lawcaseText);
                const ourDeadline = ourDeadlines.get(mapping.code);

                if (ourDeadline?.date === lawcaseDate) {
                    return [];
                }

                return [{
                    filingDate,
                    kat,
                    dhmosio,
                    code: mapping.code,
                    label: mapping.label,
                    lawcaseKey: mapping.key,
                    lawcaseText,
                    lawcaseDate,
                    ourDeadline: serializeDeadline(ourDeadline),
                }];
            });

            expect(mismatches, failureContext(testCase, mismatches)).toEqual([]);
        },
        30_000
    );
});

function generateLiveCases(): LawcaseLiveCase[] {
    const random = seededRandom(LAWCASE_SEED);
    const dates = new Set<string>();
    const start = Date.UTC(2026, 1, 2);
    const end = Date.UTC(2026, 11, 30);
    const daysInRange = Math.floor((end - start) / DAY_MS);

    while (dates.size < 20) {
        const candidate = toISODate(new Date(start + randomInt(random, daysInRange + 1) * DAY_MS));
        if (getArgiesForRange(candidate, candidate).length === 0) {
            dates.add(candidate);
        }
    }

    return [...dates].sort().map(filingDate => ({
        filingDate,
        kat: randomInt(random, 2) === 0 ? '1' : '2',
        dhmosio: randomInt(random, 2) === 0 ? '1' : '2',
    }));
}

function getLawcaseSeed(): number {
    const rawSeed = process.env.LAWCASE_SEED;
    if (!rawSeed) {
        return Date.now();
    }

    const seed = Number(rawSeed);
    if (!Number.isInteger(seed)) {
        throw new Error(`Invalid LAWCASE_SEED "${rawSeed}". Expected an integer.`);
    }

    return seed;
}

function seededRandom(seed: number): () => number {
    let state = seed >>> 0;

    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function randomInt(random: () => number, maxExclusive: number): number {
    return Math.floor(random() * maxExclusive);
}

function toLawcaseDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}-${month}-${year}`;
}

function toISODate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function getLawcaseText(value: unknown): string {
    const raw = Array.isArray(value) ? value[0] : value;
    return String(raw ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseLawcaseGreekDate(text: string): string {
    const match = text.match(/(\d{1,2})\s+([Α-ΩΆΈΉΊΌΎΏΪΫα-ωάέήίόύώϊϋΐΰ]+)\s+(\d{4})/u);
    if (!match) {
        throw new Error(`Could not parse LawCase date from: ${text}`);
    }

    const [, day, monthName, year] = match;
    const month = GREEK_MONTHS[monthName];
    if (!month) {
        throw new Error(`Unknown LawCase Greek month "${monthName}" in: ${text}`);
    }

    return `${year}-${month}-${day.padStart(2, '0')}`;
}

function serializeDeadline(deadline: Deadline | undefined): unknown {
    return deadline ? JSON.parse(JSON.stringify(deadline)) : null;
}

function failureContext(testCase: LawcaseLiveCase, mismatches: unknown[]): string {
    return JSON.stringify({ ...testCase, mismatches }, null, 2);
}

const DAY_MS = 24 * 60 * 60 * 1000;
