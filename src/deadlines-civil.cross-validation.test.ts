/**
 * Cross-validation between our getCivilDeadlines and the @gsoti/prothesmies
 * reference implementation (prothesmiesCivilCase).
 *
 * CivilDeadlineCode values mirror the external DeadlineType values, so we can
 * filter/pair entries by comparing type strings directly. katathesi and
 * dikasimos are produced only by the external lib and are skipped here.
 */

import { describe, expect, it } from 'vitest';
import { prothesmiesCivilCase, DeadlineType } from '@gsoti/prothesmies';
import { getCivilDeadlines } from './deadlines-civil.js';
import { CivilDeadlineCode } from './types.js';

// https://www.run.legal/civil-cases/396e5941-17ba-40a7-8cbe-073f0a3edff4
const INPUT = {
    imerominia_katathesis: '2024-10-16',
    diadikasia: 'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ',
    eidos: 'ΑΓΩΓΗ',
    dikasimos: '2025-09-25',
} as const;

// https://www.run.legal/civil-cases/9c630ed3-3a2d-49e0-9f8d-1fe6890ad72d
const INPUT_EXOTERIKO_DIMOSIO = {
    imerominia_katathesis: '2025-05-01',
    diadikasia: 'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ',
    apotelesma: 'ΣΥΖΗΤΗΘΗΚΕ',
    eidos: 'ΑΓΩΓΗ',
    dimosio: true,
    exoteriko: true,
} as const;

const INPUT_MIKRODIAFORES = {
    imerominia_katathesis: '2025-02-06',
    diadikasia: 'ΜΙΚΡΟΔΙΑΦΟΡΕΣ',
    eidos: 'ΑΙΤΗΣΗ',
    dikasimos: '2025-11-14',
    apotelesma: 'ΣΥΖΗΤΗΘΗΚΕ',
} as const;

const INPUT_EIDIKES_DIADIKASIES = {
    imerominia_katathesis: '2025-01-10',
    diadikasia: 'ΑΜΟΙΒΕΣ',
    eidos: 'ΑΙΤΗΣΗ',
    dikasimos: '2025-03-10',
    apotelesma: 'ΣΥΖΗΤΗΘΗΚΕ',
} as const;

const SKIP_EXTERNAL = new Set<string>([]);

const ourTypeValues = new Set<string>([]);

function byDate(a: { date: string }, b: { date: string }) {
    return a.date.localeCompare(b.date);
}

type CrossValidationInput =
    | typeof INPUT
    | typeof INPUT_EXOTERIKO_DIMOSIO
    | typeof INPUT_MIKRODIAFORES
    | typeof INPUT_EIDIKES_DIADIKASIES;

function expectSameOutputAsExternal(input: CrossValidationInput) {
    const { deadlines } = getCivilDeadlines(input);

    const external = prothesmiesCivilCase({
        apotelesma: 'apotelesma' in input ? input.apotelesma : '',
        diadikasia: input.diadikasia,
        court: 'ΠΡΩΤΟΔΙΚΕΙΟ ΑΘΗΝΩΝ',
        imerominia_katathesis: input.imerominia_katathesis,
        dikasimos: 'dikasimos' in input ? input.dikasimos : undefined,
        dimosio: 'dimosio' in input ? input.dimosio : undefined,
        exoterikou: 'exoteriko' in input ? input.exoteriko : undefined,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalize = (d: any) => {
        const { imeres: _, ypologismos: __, formattedNomothesia: ___, calculation, ...rest } = d;
        if (calculation?.logic) {
            const { day_count: ____, ...logic } = calculation.logic;
            return { ...rest, calculation: { ...calculation, logic } };
        }
        if (calculation != null) return { ...rest, calculation };
        return { ...rest };
    };

    const extNormalized = new Map(
        external
            .filter(d => !SKIP_EXTERNAL.has(d.type) && ourTypeValues.has(d.type))
            .sort(byDate)
            .map(d => [d.type, normalize(d)] as const)
    );

    const oursNormalized = new Map(
        deadlines
        .filter(d => ourTypeValues.has(d.type))
        .sort(byDate)
            .map(normalize)
            .map(d => {
                const externalDeadline = extNormalized.get(d.type);
                if (!externalDeadline || !('calculation' in externalDeadline)) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { calculation: _, ...rest } = d;
                    return [d.type, rest] as const;
                }
                return [d.type, d] as const;
            })
    );

    const commonTypes = Array.from(extNormalized.keys()).filter(type => oursNormalized.has(type));
    expect(commonTypes.sort()).toEqual(Array.from(extNormalized.keys()).sort());

    for (const type of commonTypes) {
        expect(oursNormalized.get(type)).toEqual(extNormalized.get(type));
    }
}

describe('getCivilDeadlines cross-validation against @gsoti/prothesmies', () => {
    it('returns the same output as prothesmiesCivilCase for the common deadline types', () => {
        expectSameOutputAsExternal(INPUT);
    });

    it('returns the same output as prothesmiesCivilCase for the common deadline types when exoteriko and dimosio are true', () => {
        expectSameOutputAsExternal(INPUT_EXOTERIKO_DIMOSIO);
    });

    it('returns the same output as prothesmiesCivilCase for ΜΙΚΡΟΔΙΑΦΟΡΕΣ', () => {
        expectSameOutputAsExternal(INPUT_MIKRODIAFORES);
    });

    it('returns the same output as prothesmiesCivilCase for ειδικές διαδικασίες', () => {
        expectSameOutputAsExternal(INPUT_EIDIKES_DIADIKASIES);
    });
});
