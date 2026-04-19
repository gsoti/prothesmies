import { getDateCalculation, DateCalculationResult, ArgiesAndAnastoli } from '../dateCalculation.js';
import { DayCount, Direction, DateCalculation, Nomothesia } from '../types.js';
import { NOMOTHESIA_TEXT, getHighlighted } from '../nomothesia-admin.js';

export class DeadlineCalculationError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: any
    ) {
        super(message);
        this.name = 'DeadlineCalculationError';
    }
}

export function mapDayCountToBehavior(dayCount: DayCount): 'standard' | 'workingDaysOnly' {
    switch (dayCount) {
        case DayCount.CALENDAR:
        case DayCount.FULL:
            return 'standard';
        case DayCount.WORKING:
            return 'workingDaysOnly';
        default:
            throw new DeadlineCalculationError(
                `Invalid day count: ${dayCount}. Valid values: CALENDAR, FULL, WORKING`,
                'INVALID_ENUM'
            );
    }
}

export function mapDirectionToCalculation(direction: Direction): 'forward' | 'backward' {
    switch (direction) {
        case Direction.BEFORE:
            return 'backward';
        case Direction.AFTER:
        case Direction.UNTIL:
            return 'forward';
        default:
            throw new DeadlineCalculationError(
                `Invalid direction: ${direction}. Valid values: BEFORE, AFTER, UNTIL`,
                'INVALID_ENUM'
            );
    }
}

export function getWhenText(direction: Direction): 'before' | 'after' {
    switch (direction) {
        case Direction.BEFORE:
            return 'before';
        case Direction.AFTER:
        case Direction.UNTIL:
            return 'after';
        default:
            throw new DeadlineCalculationError(
                `Invalid direction: ${direction}. Valid values: BEFORE, AFTER, UNTIL`,
                'INVALID_ENUM'
            );
    }
}

export function parseLegislation(legislation: string | null, syntmisi: boolean, deadlineCode?: string): {
    plain: string[];
    formatted: Nomothesia[];
} {
    if (!legislation) {
        return { plain: [], formatted: [] };
    }

    return {
        plain: [legislation],
        formatted: [{
            article: legislation,
            text: NOMOTHESIA_TEXT[legislation] ?? '',
            highlighted: getHighlighted(legislation, syntmisi, deadlineCode),
        }],
    };
}

interface RuleForLogic {
    days: number;
    day_count: DayCount;
    direction: Direction;
    short_name: string;
}

export function buildCalculationLogic(
    rule: RuleForLogic,
    referenceDate: string,
    referenceLabel: string
): DateCalculation['logic'] {
    return {
        days: rule.days,
        day_count: rule.day_count,
        when: getWhenText(rule.direction),
        reference: referenceLabel,
        start: referenceDate,
        name: rule.short_name,
    };
}

interface RuleForCalculation {
    days: number;
    day_count: DayCount;
    direction: Direction;
}

export function calculateDeadlineDate(
    rule: RuleForCalculation,
    referenceDate: string,
    argiesAndAnastoli: ArgiesAndAnastoli
): DateCalculationResult {
    return getDateCalculation(referenceDate, rule.days, {
        direction: mapDirectionToCalculation(rule.direction),
        countBehavior: mapDayCountToBehavior(rule.day_count),
        argiesAndAnastoli,
    });
}
