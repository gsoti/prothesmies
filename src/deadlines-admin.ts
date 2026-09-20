import { ArgiesAndAnastoli, DateCalculationResult } from './dateCalculation.js';
import { ADMIN_DIAFORA_OUSIAS_RULES } from './rules/rules-admin-diafora-ousias.js';
import {
    AdminDeadlineCode,
    CourtType,
    DateCalculation,
    Deadline,
    DeadlineRule,
    GetAdminDeadlinesInput,
    ProcedureType,
} from './types.js';
import { getAnastoliForRange } from './utils/anastoli-admin.js';
import { getArgiesForRange, getDateRangeForCalculation } from './utils/argies.js';
import {
    buildCalculationLogic,
    calculateDeadlineDate,
    DeadlineCalculationError,
    parseLegislation,
} from './utils/deadlineHelpers.js';
import { parseISODate, toISODateString } from './utils/dateUtils.js';

export { DeadlineCalculationError } from './utils/deadlineHelpers.js';
// Kept for compatibility with older direct-module imports. Package consumers should use the root export.
export { getCivilDeadlines } from './deadlines-civil.js';

const ErrorCode = {
    INVALID_INPUT: 'INVALID_INPUT',
    INVALID_RULES: 'INVALID_RULES',
    CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
    MAX_CHAIN_DEPTH: 'MAX_CHAIN_DEPTH',
} as const;

const MAX_CHAIN_DEPTH = 10;
const DATE_RANGE_BUFFER_DAYS = 365;

function assertValidISODate(value: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error('Date must use YYYY-MM-DD format');
    }
    if (toISODateString(parseISODate(value)) !== value) {
        throw new Error('Date is not a valid calendar date');
    }
}

function validateInput(input: GetAdminDeadlinesInput): void {
    if (!input || typeof input !== 'object') {
        throw new DeadlineCalculationError('input is required', ErrorCode.INVALID_INPUT);
    }
    if (!input.dikasimos || typeof input.dikasimos !== 'string') {
        throw new DeadlineCalculationError(
            'dikasimos is required and must be a string',
            ErrorCode.INVALID_INPUT
        );
    }
    try {
        assertValidISODate(input.dikasimos);
    } catch (error) {
        throw new DeadlineCalculationError(
            `Invalid dikasimos date format: ${input.dikasimos}. Expected YYYY-MM-DD`,
            ErrorCode.INVALID_INPUT,
            { originalError: error }
        );
    }
    if (!Object.values(CourtType).includes(input.court_type)) {
        throw new DeadlineCalculationError(
            `Invalid court_type: ${input.court_type}`,
            ErrorCode.INVALID_INPUT
        );
    }
    if (!Object.values(ProcedureType).includes(input.procedure_type)) {
        throw new DeadlineCalculationError(
            `Invalid procedure_type: ${input.procedure_type}`,
            ErrorCode.INVALID_INPUT
        );
    }
    if (getArgiesForRange(input.dikasimos, input.dikasimos).includes(input.dikasimos)) {
        throw new DeadlineCalculationError(
            `Invalid dikasimos: ${input.dikasimos} must be a non-holiday weekday`,
            ErrorCode.INVALID_INPUT
        );
    }
}

function detectCircularDependency(rules: readonly DeadlineRule[]): string | null {
    const parents = new Map(rules.map(rule => [rule.deadline_code, rule.parent_deadline_code]));
    const complete = new Set<string>();
    const active = new Set<string>();

    const visit = (code: string, path: string[]): string | null => {
        if (active.has(code)) {
            const start = path.indexOf(code);
            return [...path.slice(start), code].join(' -> ');
        }
        if (complete.has(code)) return null;
        active.add(code);
        const parent = parents.get(code);
        const cycle = parent && parents.has(parent) ? visit(parent, [...path, code]) : null;
        active.delete(code);
        complete.add(code);
        return cycle;
    };

    for (const code of parents.keys()) {
        const cycle = visit(code, []);
        if (cycle) return cycle;
    }
    return null;
}

/** Internal rule validation and ordering, exported for deterministic graph tests. */
export function sortAdminDeadlineRules(rules: readonly DeadlineRule[]): DeadlineRule[] {
    const ruleMap = new Map<string, DeadlineRule>();
    for (const rule of rules) {
        if (ruleMap.has(rule.deadline_code)) {
            throw new DeadlineCalculationError(
                `Duplicate deadline code: ${rule.deadline_code}`,
                ErrorCode.INVALID_RULES
            );
        }
        ruleMap.set(rule.deadline_code, rule);
    }
    for (const rule of rules) {
        if (rule.parent_deadline_code && !ruleMap.has(rule.parent_deadline_code)) {
            throw new DeadlineCalculationError(
                `Missing parent '${rule.parent_deadline_code}' for '${rule.deadline_code}'`,
                ErrorCode.INVALID_RULES
            );
        }
    }

    const cycle = detectCircularDependency(rules);
    if (cycle) {
        throw new DeadlineCalculationError(
            `Circular dependency detected: ${cycle}`,
            ErrorCode.CIRCULAR_DEPENDENCY,
            { cycle }
        );
    }

    const inDegree = new Map<string, number>();
    const children = new Map<string, string[]>();
    for (const rule of rules) {
        inDegree.set(rule.deadline_code, rule.parent_deadline_code ? 1 : 0);
        if (rule.parent_deadline_code) {
            const existing = children.get(rule.parent_deadline_code) ?? [];
            existing.push(rule.deadline_code);
            children.set(rule.parent_deadline_code, existing);
        }
    }

    const queue = rules
        .filter(rule => inDegree.get(rule.deadline_code) === 0)
        .map(rule => ({ code: rule.deadline_code, depth: 1 }));
    const sorted: DeadlineRule[] = [];
    while (queue.length > 0) {
        const { code, depth } = queue.shift()!;
        if (depth > MAX_CHAIN_DEPTH) {
            throw new DeadlineCalculationError(
                `Maximum chain depth of ${MAX_CHAIN_DEPTH} exceeded`,
                ErrorCode.MAX_CHAIN_DEPTH
            );
        }
        sorted.push(ruleMap.get(code)!);
        for (const child of children.get(code) ?? []) {
            const degree = inDegree.get(child)! - 1;
            inDegree.set(child, degree);
            if (degree === 0) queue.push({ code: child, depth: depth + 1 });
        }
    }
    return sorted;
}

function getMaxTraversalDays(rules: readonly DeadlineRule[]): number {
    const traversalByCode = new Map<string, number>();
    let maximum = 0;
    for (const rule of rules) {
        const parentDays = rule.parent_deadline_code
            ? (traversalByCode.get(rule.parent_deadline_code) ?? 0)
            : 0;
        const traversalDays = parentDays + rule.days;
        traversalByCode.set(rule.deadline_code, traversalDays);
        maximum = Math.max(maximum, traversalDays);
    }
    return maximum;
}

function buildDeadline(
    rule: DeadlineRule,
    calculatedResult: DateCalculationResult,
    logic: DateCalculation['logic'],
    syntmisi: boolean
): Deadline {
    const { plain, formatted } = parseLegislation(rule.legislation, syntmisi, rule.deadline_code);
    return {
        calculation: { ...calculatedResult, logic },
        date: calculatedResult.date,
        name: rule.deadline_name,
        formattedNomothesia: formatted,
        shortName: rule.short_name,
        type: rule.deadline_code as AdminDeadlineCode,
        nomothesia: plain,
    };
}

function rulesForInput(input: GetAdminDeadlinesInput): readonly DeadlineRule[] {
    if (
        input.court_type === CourtType.DP_DE &&
        input.procedure_type === ProcedureType.DIAFORA_OUSIAS
    ) {
        return ADMIN_DIAFORA_OUSIAS_RULES;
    }
    throw new DeadlineCalculationError('Unsupported administrative rule set', ErrorCode.INVALID_INPUT);
}

/** Calculate all administrative deadlines without database or network access. */
export function getAdminDeadlines(input: GetAdminDeadlinesInput): Deadline[] {
    validateInput(input);
    const syntmisi = input.syntmisi ?? false;
    const sortedRules = sortAdminDeadlineRules(rulesForInput(input));
    const maxTraversalDays = getMaxTraversalDays(sortedRules);
    const forwardRange = getDateRangeForCalculation(
        input.dikasimos, maxTraversalDays, 'forward', DATE_RANGE_BUFFER_DAYS
    );
    const backwardRange = getDateRangeForCalculation(
        input.dikasimos, maxTraversalDays, 'backward', DATE_RANGE_BUFFER_DAYS
    );
    const argiesAndAnastoli: ArgiesAndAnastoli = {
        argies: getArgiesForRange(backwardRange.startDate, forwardRange.endDate),
        anastoli: getAnastoliForRange(backwardRange.startDate, forwardRange.endDate),
    };

    const calculatedByCode = new Map<string, Deadline>();
    const deadlines: Deadline[] = [];
    for (const rule of sortedRules) {
        const parent = rule.parent_deadline_code
            ? calculatedByCode.get(rule.parent_deadline_code)
            : undefined;
        if (rule.parent_deadline_code && !parent) {
            throw new DeadlineCalculationError(
                `Parent '${rule.parent_deadline_code}' was not calculated for '${rule.deadline_code}'`,
                ErrorCode.INVALID_RULES
            );
        }

        const referenceDate = parent?.date ?? input.dikasimos;
        const referenceLabel = rule.parent_deadline_code ?? 'dikasimos';
        const effectiveRule = syntmisi && rule.deadline_code === AdminDeadlineCode.apopseis_fakelos_dioikisis
            ? { ...rule, days: 8 }
            : rule;
        const result = calculateDeadlineDate(effectiveRule, referenceDate, argiesAndAnastoli);
        const logic = buildCalculationLogic(effectiveRule, referenceDate, referenceLabel);
        const deadline = buildDeadline(rule, result, logic, syntmisi);
        calculatedByCode.set(rule.deadline_code, deadline);
        deadlines.push(deadline);
    }
    return deadlines;
}
