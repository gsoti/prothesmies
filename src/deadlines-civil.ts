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
    CIVIL_DEADLINE_TAKTIKI_POST2026_RULES,
    getCivilTaktikiPre2026Rules,
} from './rules-civil.js';
import { getCivilFormattedNomothesia, getCivilNomothesia } from './nomothesia-civil.js';
import {
    CivilAnchorType,
    CivilDeadlineCode,
    CivilDeadlineRule,
    CivilDeadlinesResult,
    GetCivilDeadlinesInput,
    Deadline,
    DateCalculation,
} from './types.js';

type BuildContext = { isPost2026: boolean; exoteriko?: boolean };

const DATE_RANGE_BUFFER_DAYS = 365;

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
        case CivilAnchorType.LIXI_PROSTHIKIS_ANTIKROUSIS: return 'Λήξη προσθήκης - αντίκρουσης';
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

export async function getCivilDeadlines(input: GetCivilDeadlinesInput): Promise<CivilDeadlinesResult> {
    validateCivilInput(input);

    const isPost2026 = input.imerominia_katathesis >= '2026-01-01';
    const ctx: BuildContext = { isPost2026, exoteriko: input.exoteriko };
    const isBefore2022 = input.imerominia_katathesis < '2022-01-01';
    const isTaktiki = [
        'ΤΑΚΤΙΚΗ',
        'ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ',
        'ΤΑΚΤΙΚΗ ΠΟΛΥΜΕΛΟΥΣ',
        'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ',
        'ΝΕΑ ΤΑΚΤΙΚΗ ΠΟΛΥΜΕΛΟΥΣ',
        'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ (ν.5221/2025)',
        'ΝΕΑ ΤΑΚΤΙΚΗ ΠΟΛΥΜΕΛΟΥΣ (ν.5221/2025)',
    ].includes(input.diadikasia);
    if (!isTaktiki) {
        return { deadlines: [], status: 'not_supported' };
    }
    if (isTaktiki && isBefore2022) {
        return { deadlines: [], status: 'not_supported' };
    }

    const rules = isPost2026
        ? CIVIL_DEADLINE_TAKTIKI_POST2026_RULES
        : getCivilTaktikiPre2026Rules(input.dimosio);

    let maxTraversalDays = getCivilMaxTraversalDays(rules);
    if (input.dikasimos) {
        const dikasimosDistance = Math.ceil(
            (parseISODate(input.dikasimos).getTime() - parseISODate(input.imerominia_katathesis).getTime())
            / (24 * 60 * 60 * 1000)
        );
        maxTraversalDays = Math.max(maxTraversalDays, dikasimosDistance);
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

    const deadlines: Deadline[] = [];
    const anchors = new Map<CivilAnchorType, string>([
        [CivilAnchorType.IMEROMINIA_KATATHESIS, input.imerominia_katathesis],
        ...(input.dikasimos ? [[CivilAnchorType.DIKASIMOS, input.dikasimos] as const] : []),
    ]);

    for (const rule of earlyRules) {
        const referenceDate = anchors.get(rule.anchor_type);

        if (!referenceDate) {
            deadlines.push(buildPendingDeadline(rule, rule.anchor_type, ctx));
            continue;
        }

        const calculatedResult = calculateDeadlineDate(rule, referenceDate, argiesAndAnastoli);
        const anchorRef = rule.deadline_code === CivilDeadlineCode.protaseis ? 'epidosi' : getAnchorReference(rule.anchor_type);
        const logic = buildCalculationLogic(rule, referenceDate, anchorRef, getAnchorName(rule.anchor_type));
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

    for (const rule of lateRules) {
        deadlines.push(buildPendingDeadline(rule, rule.anchor_type, ctx));
    }

    return { deadlines, status: 'success' };
}
