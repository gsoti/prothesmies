import { getDateCalculation } from '../../src/dateCalculation.js';
import { NOMOTHESIA_TEXT, getHighlighted } from '../../src/nomothesia-admin.js';
import {
    AdminDeadlineCode,
    DayCount,
    Deadline,
    DeadlineRule,
    Direction,
    GetAdminDeadlinesInput,
} from '../../src/types.js';
import { getAnastoliForRange } from '../../src/utils/anastoli-admin.js';
import { getArgiesForRange, getDateRangeForCalculation } from '../../src/utils/argies.js';

function legacyOrder(rules: readonly DeadlineRule[]): DeadlineRule[] {
    const pending = [...rules];
    const emitted = new Set<string>();
    const ordered: DeadlineRule[] = [];
    while (pending.length > 0) {
        const index = pending.findIndex(rule =>
            !rule.parent_deadline_code || emitted.has(rule.parent_deadline_code)
        );
        if (index < 0) throw new Error('Legacy rules contain an unresolved dependency');
        const [rule] = pending.splice(index, 1);
        ordered.push(rule);
        emitted.add(rule.deadline_code);
    }
    return ordered;
}

export function getLegacyAdminDeadlines(
    input: GetAdminDeadlinesInput,
    databaseRules: readonly DeadlineRule[]
): Deadline[] {
    const rules = legacyOrder(databaseRules);
    const backward = getDateRangeForCalculation(input.dikasimos, 30, 'backward', 365);
    const forward = getDateRangeForCalculation(input.dikasimos, 30, 'forward', 365);
    const nonWorking = {
        argies: getArgiesForRange(backward.startDate, forward.endDate),
        anastoli: getAnastoliForRange(backward.startDate, forward.endDate),
    };
    const calculated = new Map<string, Deadline>();
    const output: Deadline[] = [];

    for (const sourceRule of rules) {
        const rule = input.syntmisi && sourceRule.deadline_code === 'apopseis_fakelos_dioikisis'
            ? { ...sourceRule, days: 8 }
            : sourceRule;
        const parent = rule.parent_deadline_code
            ? calculated.get(rule.parent_deadline_code)
            : undefined;
        const referenceDate = parent?.date ?? input.dikasimos;
        const calculation = getDateCalculation(referenceDate, rule.days, {
            direction: rule.direction === Direction.BEFORE ? 'backward' : 'forward',
            countBehavior: rule.day_count === DayCount.WORKING ? 'workingDaysOnly' : 'standard',
            argiesAndAnastoli: nonWorking,
        });
        const legislation = rule.legislation;
        const deadline: Deadline = {
            name: rule.deadline_name,
            shortName: rule.short_name,
            type: rule.deadline_code as AdminDeadlineCode,
            date: calculation.date,
            nomothesia: legislation ? [legislation] : [],
            formattedNomothesia: legislation ? [{
                article: legislation,
                text: NOMOTHESIA_TEXT[legislation] ?? '',
                highlighted: getHighlighted(legislation, input.syntmisi ?? false, rule.deadline_code),
            }] : [],
            calculation: {
                ...calculation,
                logic: {
                    days: rule.days,
                    day_count: rule.day_count,
                    when: rule.direction === Direction.BEFORE ? 'before' : 'after',
                    reference: rule.parent_deadline_code ?? rule.reference_point,
                    start: referenceDate,
                    name: rule.short_name,
                },
            },
        };
        calculated.set(rule.deadline_code, deadline);
        output.push(deadline);
    }
    return output;
}
