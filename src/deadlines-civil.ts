import { ArgiesAndAnastoli } from './dateCalculation.js';
import { getArgiesForRange, getDateRangeForCalculation } from './utils/argies.js';
import { parseISODate } from './utils/dateUtils.js';
import {
    DeadlineCalculationError,
    parseLegislation,
    buildCalculationLogic,
    calculateDeadlineDate,
} from './utils/deadlineHelpers.js';
import { CIVIL_DEADLINE_TAKTIKI_POST2026_RULES } from './rules-civil.js';
import {
    CivilAnchorType,
    CivilDeadlineCode,
    CivilDeadlineRule,
    CivilDeadlinesResult,
    DeadlineStatus,
    GetCivilDeadlinesInput,
    Deadline,
    DateCalculation,
} from './types.js';

const DATE_RANGE_BUFFER_DAYS = 365;

const PENDING_ANCHOR_TYPES = [CivilAnchorType.ORISMOS_DIKASTI, CivilAnchorType.EKDOSI_DIATAXIS];

const ANCHOR_TRAVERSAL_DAYS = new Map<CivilAnchorType, number>([
    [CivilAnchorType.IMEROMINIA_KATATHESIS, 0],
    [CivilAnchorType.LIXI_EPIDOSIS_AGOGIS, 30],
    [CivilAnchorType.LIXI_PROTASEON, 120],
    [CivilAnchorType.LIXI_PROSTHIKIS_ANTIKROUSIS, 135],
]);

function getReferenceLabel(reference: CivilAnchorType | string): string {
    switch (reference) {
        case CivilAnchorType.IMEROMINIA_KATATHESIS:
            return 'ημερομηνία κατάθεσης';
        case CivilAnchorType.LIXI_EPIDOSIS_AGOGIS:
            return 'λήξη προθεσμίας επίδοσης αγωγής';
        case CivilAnchorType.LIXI_PROTASEON:
            return 'λήξη προθεσμίας προτάσεων';
        case CivilAnchorType.LIXI_PROSTHIKIS_ANTIKROUSIS:
            return 'λήξη προθεσμίας προσθήκης - αντίκρουσης';
        case CivilAnchorType.ORISMOS_DIKASTI:
            return 'ορισμός δικαστή / σύνθεσης';
        case CivilAnchorType.EKDOSI_DIATAXIS:
            return 'έκδοση διάταξης';
        default:
            return reference;
    }
}

function buildDeadline(
    rule: Pick<CivilDeadlineRule, 'deadline_name' | 'short_name' | 'deadline_code' | 'legislation'>,
    calculatedResult: ReturnType<typeof calculateDeadlineDate>,
    logic: DateCalculation['logic'],
    anchorType: CivilAnchorType
): Deadline {
    const { plain, formatted } = parseLegislation(rule.legislation, false, rule.deadline_code);

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
        ypologismos: [],
        imeres: [],
        status: DeadlineStatus.CALCULATED,
        anchorType,
    };
}

function buildPendingDeadline(
    rule: CivilDeadlineRule,
    missingAnchor: CivilAnchorType
): Deadline {
    const { plain, formatted } = parseLegislation(rule.legislation, false, rule.deadline_code);

    return {
        name: rule.deadline_name,
        shortName: rule.short_name,
        type: rule.deadline_code,
        date: '',
        nomothesia: plain,
        formattedNomothesia: formatted,
        ypologismos: [],
        imeres: [],
        calculation: null,
        status: DeadlineStatus.PENDING,
        anchorType: rule.anchor_type,
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
    const isTaktiki = input.diadikasia === 'ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ' ||
        input.diadikasia === 'ΝΕΑ ΤΑΚΤΙΚΗ ΠΟΛΥΜΕΛΟΥΣ' ||
        input.diadikasia === 'ΤΑΚΤΙΚΗ';
    if (!isTaktiki || !isPost2026) {
        return { deadlines: [], status: 'not_supported' };
    }

    const maxTraversalDays = getCivilMaxTraversalDays(CIVIL_DEADLINE_TAKTIKI_POST2026_RULES);
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
        anastoli: [],
    };

    const { earlyRules, lateRules } = CIVIL_DEADLINE_TAKTIKI_POST2026_RULES.reduce(
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
    ]);

    for (const rule of earlyRules) {
        const referenceDate = anchors.get(rule.anchor_type);

        if (!referenceDate) {
            deadlines.push(buildPendingDeadline(rule, rule.anchor_type));
            continue;
        }

        const calculatedResult = calculateDeadlineDate(rule, referenceDate, argiesAndAnastoli);
        const logic = buildCalculationLogic(rule, referenceDate, getReferenceLabel(rule.anchor_type));
        const deadline = buildDeadline(rule, calculatedResult, logic, rule.anchor_type);
        deadlines.push(deadline);

        switch (deadline.type) {
            case CivilDeadlineCode.epidosi:
                anchors.set(CivilAnchorType.LIXI_EPIDOSIS_AGOGIS, deadline.date);
                break;
            case CivilDeadlineCode.protaseis_kai_apodeiktika:
                anchors.set(CivilAnchorType.LIXI_PROTASEON, deadline.date);
                break;
            case CivilDeadlineCode.prosthiki_antikrousi:
                anchors.set(CivilAnchorType.LIXI_PROSTHIKIS_ANTIKROUSIS, deadline.date);
                break;
        }
    }

    for (const rule of lateRules) {
        deadlines.push(buildPendingDeadline(rule, rule.anchor_type));
    }

    return { deadlines, status: 'success' };
}
