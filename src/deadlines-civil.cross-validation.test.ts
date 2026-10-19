/**
 * Cross-validation between our getCivilDeadlines and the @gsoti/prothesmies
 * reference implementation (prothesmiesCivilCase).
 */

import { describe, expect, it } from 'vitest';
import { prothesmiesCivilCase } from '@gsoti/prothesmies';
import { getCivilDeadlines } from './deadlines-civil.js';
import { CivilDeadlineCode } from './types.js';

// https://www.run.legal/civil-cases/396e5941-17ba-40a7-8cbe-073f0a3edff4
const INPUT = {
    imerominia_katathesis: '2024-10-16',
    diadikasia: 'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ',
    eidos: 'ΑΓΩΓΗ',
    dikasimos: '2025-09-25',
} as const;

const INPUT_WITHOUT_DIMASIMOS = {
    imerominia_katathesis: '2025-12-02',
    diadikasia: 'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ',
    eidos: 'ΑΓΩΓΗ',    
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

function byDate(a: { date: string }, b: { date: string }) {
    return a.date.localeCompare(b.date);
}

type CrossValidationInput =
    | typeof INPUT
    | typeof INPUT_EXOTERIKO_DIMOSIO
    | typeof INPUT_MIKRODIAFORES
    | typeof INPUT_EIDIKES_DIADIKASIES
    | typeof INPUT_WITHOUT_DIMASIMOS;

function expectSameOutputAsExternal(
    input: CrossValidationInput,
    localOnlyDeadlineTypes: CivilDeadlineCode[] = []
) {
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
            .sort(byDate)
            .map(d => [d.type, normalize(d)] as const)
    );

    const oursNormalized = new Map(
        deadlines
            .filter(deadline => !localOnlyDeadlineTypes.includes(deadline.type))
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

    expect(Array.from(oursNormalized.keys()).sort()).toEqual(Array.from(extNormalized.keys()).sort());
    expect(oursNormalized).toEqual(extNormalized);
}

describe('getCivilDeadlines cross-validation against @gsoti/prothesmies', () => {
    it('returns the same output as prothesmiesCivilCase', () => {
        expectSameOutputAsExternal(INPUT);
    });

    it('returns the same output as prothesmiesCivilCase when dikasimos is not provided', () => {
        expectSameOutputAsExternal(INPUT_WITHOUT_DIMASIMOS);
    });

    it('returns the same output as prothesmiesCivilCase when exoteriko and dimosio are true', () => {
        expectSameOutputAsExternal(INPUT_EXOTERIKO_DIMOSIO);
    });

    it('returns the same output as prothesmiesCivilCase for ΜΙΚΡΟΔΙΑΦΟΡΕΣ', () => {
        expectSameOutputAsExternal(INPUT_MIKRODIAFORES);
    });

    it('returns the same output as prothesmiesCivilCase for ειδικές διαδικασίες', () => {
        // The local calculator now returns katathesi for ειδικές διαδικασίες;
        // the legacy reference package does not include it.
        expectSameOutputAsExternal(INPUT_EIDIKES_DIADIKASIES, [CivilDeadlineCode.katathesi]);
    });
});
