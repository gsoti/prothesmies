import { ArgiesAndAnastoli } from './dateCalculation.js';
import { getArgiesForRange, getDateRangeForCalculation } from './utils/argies.js';
import { parseISODate, toISODateString, addDays } from './utils/dateUtils.js';
import { getCivilAnastoliForRange } from './utils/anastoli-civil.js';
import {
    DeadlineCalculationError,
    buildCalculationLogic,
    calculateDeadlineDate,
} from './utils/deadlineHelpers.js';
export { DeadlineCalculationError } from './utils/deadlineHelpers.js';
import {
    getCivilTaktikiPost2026Rules,
    getCivilMicrodifferencesRules,
    getCivilTaktikiPre2026Rules,
    getCivilEidikesRules,
} from './rules/index.js';
import { getCivilFormattedNomothesia, getCivilNomothesia } from './nomothesia-civil.js';
import {
    CivilAnchorType,
    CivilDeadlineCode,
    CivilDeadlineRule,
    CivilDeadlinesResult,
    GetCivilDeadlinesInput,
    Deadline,
    DateCalculation,
    DayCount,
    Direction,
} from './types.js';

type BuildContext = { isPost2026: boolean; exoteriko?: boolean; variant: 'taktiki' | 'mikrodiafores' | 'eidikes' };

const DATE_RANGE_BUFFER_DAYS = 365;
const EIDIKES_DIADIKASIES = new Set<string>([
    'ΑΜΟΙΒΕΣ',
    'ΑΝΑΚΟΠΕΣ ΚΑΤΑ ΤΗΣ ΕΚΤΕΛΕΣΗΣ (Από Μετάπτωση)',
    'ΑΝΑΚΟΠΕΣ',
    'ΑΥΤΟΚΙΝΗΤΑ-ΠΕΡΙΟΥΣΙΑΚΕΣ ΔΙΑΦΟΡΕΣ',
    'ΕΙΔΙΚΗ ΔΙΑ ΤΟΥ ΤΥΠΟΥ Τ.ΠΟΛ',
    'ΕΚΟΥΣΙΑ ΜΟΝΟΜΕΛΟΥΣ',
    'ΕΡΓΑΤΙΚΑ-ΠΕΡΙΟΥΣΙΑΚΕΣ ΔΙΑΦΟΡΕΣ',
    'ΜΙΣΘΩΣΕΙΣ - ΠΕΡΙΟΥΣΙΑΚΕΣ ΔΙΑΦΟΡΕΣ',
    'ΟΙΚΟΓΕΝΕΙΑΚΟ ΕΙΔΙΚΕΣ ΔΙΑΔΙΚΑΣΙΕΣ',
]);

const PENDING_ANCHOR_TYPES = [CivilAnchorType.ORISMOS_DIKASTI, CivilAnchorType.EKDOSI_DIATAXIS];

const ANCHOR_TRAVERSAL_DAYS = new Map<CivilAnchorType, number>([
    [CivilAnchorType.IMEROMINIA_KATATHESIS, 0],
    [CivilAnchorType.LIXI_EPIDOSIS_AGOGIS, 30],
    [CivilAnchorType.LIXI_PROTASEON, 120],
    [CivilAnchorType.LIXI_PROSTHIKIS_ANTIKROUSIS, 135],
]);

function getAnchorReference(anchor: CivilAnchorType): string {
    switch (anchor) {
        case CivilAnchorType.IMEROMINIA_KATATHESIS: return 'katathesi';
        case CivilAnchorType.LIXI_EPIDOSIS_AGOGIS:  return 'epidosi';
        case CivilAnchorType.DIKASIMOS:             return 'dikasimos';
        default:                                    return anchor;
    }
}

function getAnchorName(anchor: CivilAnchorType): string {
    switch (anchor) {
        case CivilAnchorType.IMEROMINIA_KATATHESIS:      return 'Κατάθεση';
        case CivilAnchorType.LIXI_EPIDOSIS_AGOGIS:       return 'Επίδοση';
        case CivilAnchorType.LIXI_PROTASEON:             return 'Προτάσεις';
        case CivilAnchorType.LIXI_PROSTHIKIS_ANTIKROUSIS: return 'Προσθήκη';
        case CivilAnchorType.DIKASIMOS:                  return 'Δικάσιμος';
        case CivilAnchorType.ORISMOS_DIKASTI:            return 'Ορισμός δικαστή / σύνθεσης';
        case CivilAnchorType.EKDOSI_DIATAXIS:            return 'Έκδοση διάταξης';
    }
}

function buildDeadline(
    rule: Pick<CivilDeadlineRule, 'deadline_name' | 'short_name' | 'deadline_code' | 'legislation'>,
    calculatedResult: ReturnType<typeof calculateDeadlineDate>,
    logic: DateCalculation['logic'],
    ctx: BuildContext
): Deadline {
    const plain = getCivilNomothesia(rule.deadline_code, ctx) ?? [rule.legislation];
    const formatted = getCivilFormattedNomothesia(rule.deadline_code, ctx);

    return {
        calculation: {
            date: calculatedResult.date,
            paused: calculatedResult.paused,
            skipped: calculatedResult.skipped,
            logic,
        },
        date: calculatedResult.date,
        name: rule.deadline_name,
        formattedNomothesia: formatted,
        shortName: rule.short_name,
        type: rule.deadline_code as CivilDeadlineCode,
        nomothesia: plain,
    };
}

function buildPendingDeadline(
    rule: CivilDeadlineRule,
    missingAnchor: CivilAnchorType,
    ctx: BuildContext
): Deadline {
    const plain = getCivilNomothesia(rule.deadline_code, ctx) ?? [rule.legislation];
    const formatted = getCivilFormattedNomothesia(rule.deadline_code, ctx);

    return {
        name: rule.deadline_name,
        shortName: rule.short_name,
        type: rule.deadline_code,
        date: '',
        nomothesia: plain,
        formattedNomothesia: formatted,
        calculation: null,
        missingAnchor,
    };
}

function buildFilingDeadline(input: GetCivilDeadlinesInput): Deadline {
    return {
        name: 'Κατάθεση',
        shortName: 'Κατάθεση',
        type: CivilDeadlineCode.katathesi,
        date: input.imerominia_katathesis,
        nomothesia: [],
        formattedNomothesia: [],
        calculation: null,
    };
}

function buildDikasimosDeadline(dikasimos: string): Deadline {
    return {
        name: 'Δικάσιμος',
        shortName: 'Δικάσιμος',
        type: CivilDeadlineCode.dikasimos,
        date: dikasimos,
        nomothesia: [],
        formattedNomothesia: [],
        calculation: null,
    };
}

function getCivilEidikesDeadlines(input: GetCivilDeadlinesInput): CivilDeadlinesResult {
    const ctx: BuildContext = {
        isPost2026: input.imerominia_katathesis >= '2026-01-01',
        exoteriko: input.exoteriko,
        variant: 'eidikes',
    };
    const deadlines: Deadline[] = [buildFilingDeadline(input)];

    if (!input.dikasimos) {
        return { deadlines, status: 'success' };
    }

    deadlines.push(buildDikasimosDeadline(input.dikasimos));

    if (input.apotelesma !== 'ΣΥΖΗΤΗΘΗΚΕ') {
        return { deadlines, status: 'success' };
    }

    const [rule] = getCivilEidikesRules();

    const forwardRange = getDateRangeForCalculation(
        input.dikasimos,
        rule.days,
        'forward',
        DATE_RANGE_BUFFER_DAYS
    );
    const backwardRange = getDateRangeForCalculation(
        input.dikasimos,
        rule.days,
        'backward',
        DATE_RANGE_BUFFER_DAYS
    );

    const argiesAndAnastoli: ArgiesAndAnastoli = {
        argies: getArgiesForRange(backwardRange.startDate, forwardRange.endDate),
        anastoli: getCivilAnastoliForRange(
            backwardRange.startDate,
            forwardRange.endDate,
            input.dimosio
        ),
    };

    const calculatedResult = calculateDeadlineDate(
        rule,
        input.dikasimos,
        argiesAndAnastoli
    );
    const logic = buildCalculationLogic(
        rule,
        input.dikasimos,
        'dikasimos',
        'Δικάσιμος'
    );

    deadlines.push(buildDeadline(rule, calculatedResult, logic, ctx));

    return { deadlines, status: 'success' };
}

function validateCivilInput(input: GetCivilDeadlinesInput): void {
    if (!input.imerominia_katathesis || typeof input.imerominia_katathesis !== 'string') {
        throw new DeadlineCalculationError(
            'imerominia_katathesis is required and must be a string',
            'INVALID_INPUT'
        );
    }

    try {
        parseISODate(input.imerominia_katathesis);
    } catch (error) {
        throw new DeadlineCalculationError(
            `Invalid imerominia_katathesis date format: ${input.imerominia_katathesis}. Expected YYYY-MM-DD`,
            'INVALID_INPUT',
            { originalError: error }
        );
    }
}

function getCivilMaxTraversalDays(rules: CivilDeadlineRule[]): number {
    let maxTraversalDays = 0;
    for (const rule of rules) {
        const traversalDays = (ANCHOR_TRAVERSAL_DAYS.get(rule.anchor_type) ?? 0) + rule.days;
        maxTraversalDays = Math.max(maxTraversalDays, traversalDays);
    }
    return maxTraversalDays;
}

export function getCivilDeadlines(input: GetCivilDeadlinesInput): CivilDeadlinesResult {
    validateCivilInput(input);

    const isPost2026 = input.imerominia_katathesis >= '2026-01-01';
    const isMicrodifferences = input.diadikasia === 'ΜΙΚΡΟΔΙΑΦΟΡΕΣ';
    const isEidikes = EIDIKES_DIADIKASIES.has(input.diadikasia);
    const ctx: BuildContext = {
        isPost2026,
        exoteriko: input.exoteriko,
        variant: isMicrodifferences ? 'mikrodiafores' : isEidikes ? 'eidikes' : 'taktiki',
    };
    const isBefore2022 = input.imerominia_katathesis < '2022-01-01';
    const isTaktiki = [
        'ΤΑΚΤΙΚΗ',
        'ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ',
        'ΤΑΚΤΙΚΗ ΠΟΛΥΜΕΛΟΥΣ',
        'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ',
        'ΝΕΑ ΤΑΚΤΙΚΗ ΠΟΛΥΜΕΛΟΥΣ',
        'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ (ν.5221/2025)',
        'ΝΕΑ ΤΑΚΤΙΚΗ ΠΟΛΥΜΕΛΟΥΣ (ν.5221/2025)',
    ].includes(input.diadikasia) && input.eidos === 'ΑΓΩΓΗ';
    if (!isTaktiki && !isMicrodifferences && !isEidikes) {
        return { deadlines: [], status: 'not_supported' };
    }
    if (isEidikes) {
        return getCivilEidikesDeadlines(input);
    }
    if (isTaktiki && isBefore2022) {
        return { deadlines: [], status: 'not_supported' };
    }

    const rules = isMicrodifferences
        ? getCivilMicrodifferencesRules({ isPost2026, exoteriko: input.exoteriko, apotelesma: input.apotelesma })
        : isPost2026
            ? getCivilTaktikiPost2026Rules(input.exoteriko)
            : getCivilTaktikiPre2026Rules(input.exoteriko);

    let maxTraversalDays = getCivilMaxTraversalDays(rules);
    if (input.dikasimos) {
        const dikasimosDistance = Math.ceil(
            (parseISODate(input.dikasimos).getTime() - parseISODate(input.imerominia_katathesis).getTime())
            / (24 * 60 * 60 * 1000)
        );
        const dikasimosTraversalDays = rules
            .filter(rule => rule.anchor_type === CivilAnchorType.DIKASIMOS)
            .reduce((max, rule) => Math.max(max, dikasimosDistance + rule.days), dikasimosDistance);
        maxTraversalDays = Math.max(maxTraversalDays, dikasimosTraversalDays);
    }
    const forwardRange = getDateRangeForCalculation(
        input.imerominia_katathesis,
        maxTraversalDays,
        'forward',
        DATE_RANGE_BUFFER_DAYS
    );
    const backwardRange = getDateRangeForCalculation(
        input.imerominia_katathesis,
        maxTraversalDays,
        'backward',
        DATE_RANGE_BUFFER_DAYS
    );

    const argiesAndAnastoli: ArgiesAndAnastoli = {
        argies: getArgiesForRange(backwardRange.startDate, forwardRange.endDate),
        anastoli: getCivilAnastoliForRange(
            backwardRange.startDate,
            forwardRange.endDate,
            input.dimosio
        ),
    };

    const { earlyRules, lateRules } = rules.reduce(
        (acc, rule) => {
            if (PENDING_ANCHOR_TYPES.includes(rule.anchor_type)) {
                acc.lateRules.push(rule);
            } else {
                acc.earlyRules.push(rule);
            }
            return acc;
        },
        { earlyRules: [] as CivilDeadlineRule[], lateRules: [] as CivilDeadlineRule[] }
    );

    const deadlines: Deadline[] = [buildFilingDeadline(input)];
    const anchors = new Map<CivilAnchorType, string>([
        [CivilAnchorType.IMEROMINIA_KATATHESIS, input.imerominia_katathesis],
        ...(input.dikasimos ? [[CivilAnchorType.DIKASIMOS, input.dikasimos] as const] : []),
    ]);

    let hasInsertedDikasimos = false;

    for (const rule of earlyRules) {
        if (!hasInsertedDikasimos && input.dikasimos && rule.anchor_type === CivilAnchorType.DIKASIMOS) {
            deadlines.push(buildDikasimosDeadline(input.dikasimos));
            hasInsertedDikasimos = true;
        }

        const referenceDate = anchors.get(rule.anchor_type);

        if (!referenceDate) {
            deadlines.push(buildPendingDeadline(rule, rule.anchor_type, ctx));
            continue;
        }

        const calculatedResult = calculateDeadlineDate(rule, referenceDate, argiesAndAnastoli);
        const anchorRef = rule.deadline_code === CivilDeadlineCode.protaseis && ctx.variant === 'taktiki'
            ? 'epidosi'
            : getAnchorReference(rule.anchor_type);
        const logicName = ctx.variant === 'mikrodiafores' && rule.deadline_code === CivilDeadlineCode.prosthiki
            ? 'Προσκομιδή του εναγομένου'
            : getAnchorName(rule.anchor_type);
        const logicRef = ctx.variant === 'mikrodiafores' && rule.deadline_code === CivilDeadlineCode.prosthiki
            ? 'proskomidi'
            : anchorRef;
        const logic = buildCalculationLogic(rule, referenceDate, logicRef, logicName);
        const deadline = buildDeadline(rule, calculatedResult, logic, ctx);
        deadlines.push(deadline);

        switch (deadline.type) {
            case CivilDeadlineCode.epidosi:
                anchors.set(CivilAnchorType.LIXI_EPIDOSIS_AGOGIS, deadline.date);
                break;
            case CivilDeadlineCode.protaseis:
                anchors.set(CivilAnchorType.LIXI_PROTASEON, deadline.date);
                break;
            case CivilDeadlineCode.prosthiki:
                anchors.set(CivilAnchorType.LIXI_PROSTHIKIS_ANTIKROUSIS, deadline.date);
                break;
        }
    }

    if (!hasInsertedDikasimos && input.dikasimos) {
        deadlines.push(buildDikasimosDeadline(input.dikasimos));
    }

    for (const rule of lateRules) {
        deadlines.push(buildPendingDeadline(rule, rule.anchor_type, ctx));
    }

    return { deadlines, status: 'success' };
}
