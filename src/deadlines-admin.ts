import { sql } from './db.js';
import { DateCalculationResult, ArgiesAndAnastoli } from './dateCalculation.js';
import { getArgiesForRange, getDateRangeForCalculation } from './utils/argies.js';
import { getAnastoliForRange } from './utils/anastoli-admin.js';
import { parseISODate } from './utils/dateUtils.js';
import {
    AdminDeadlineCode,
    CourtType,
    ProcedureType,
    DayCount,
    ReferencePoint,
    Direction,
    DeadlineRule,
    GetDeadlinesInput,
    Deadline,
    DateCalculation,
} from './types.js';
import {
    DeadlineCalculationError,
    parseLegislation,
    buildCalculationLogic,
    calculateDeadlineDate,
} from './utils/deadlineHelpers.js';
export { DeadlineCalculationError } from './utils/deadlineHelpers.js';
export { getCivilDeadlines } from './deadlines-civil.js';

const ErrorCode = {
    INVALID_INPUT: 'INVALID_INPUT',
    CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
    MAX_CHAIN_DEPTH: 'MAX_CHAIN_DEPTH',
} as const;

const MAX_CHAIN_DEPTH = 10;
const DATE_RANGE_BUFFER_DAYS = 365;

/**
 * Fetches deadline rules from the database
 */
async function fetchDeadlineRules(
    courtType: string,
    procedureType: string
): Promise<DeadlineRule[]> {
    const result = await sql`
        SELECT * FROM "prothesmies-admin"
        WHERE court_type = ${courtType}
        AND procedure_type = ${procedureType}
        AND active = TRUE
    `;

    // Parse numeric fields from strings to numbers
    return result.rows.map(row => ({
        ...row,
        days: Number(row.days),
        notification_days: row.notification_days !== null ? Number(row.notification_days) : null,
    })) as DeadlineRule[];
}

/**
 * Detects circular dependencies in deadline rules using DFS
 * Returns error message with cycle path or null if no cycle
 */
function detectCircularDependency(rules: DeadlineRule[]): string | null {
    const graph = new Map<string, string | null>();

    // Build adjacency list
    for (const rule of rules) {
        graph.set(rule.deadline_code, rule.parent_deadline_code);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    function dfs(node: string, path: string[]): string | null {
        if (recStack.has(node)) {
            // Found a cycle - build the cycle path
            const cycleStart = path.indexOf(node);
            const cycle = [...path.slice(cycleStart), node];
            return cycle.join(' -> ');
        }

        if (visited.has(node)) {
            return null;
        }

        visited.add(node);
        recStack.add(node);
        path.push(node);

        const parent = graph.get(node);
        if (parent && graph.has(parent)) {
            const result = dfs(parent, path);
            if (result) return result;
        }

        path.pop();
        recStack.delete(node);
        return null;
    }

    // Check each node
    for (const node of graph.keys()) {
        const cycle = dfs(node, []);
        if (cycle) {
            return cycle;
        }
    }

    return null;
}

/**
 * Sorts deadline rules topologically using Kahn's algorithm
 * Filters out rules with missing parents (logs warning)
 * Throws error if circular dependency detected
 */
function sortDeadlineRules(rules: DeadlineRule[]): DeadlineRule[] {
    // First check for circular dependencies
    const cycle = detectCircularDependency(rules);
    if (cycle) {
        throw new DeadlineCalculationError(
            `Circular dependency detected: ${cycle}`,
            ErrorCode.CIRCULAR_DEPENDENCY,
            { cycle }
        );
    }

    // Build map of deadline_code -> rule
    const ruleMap = new Map<string, DeadlineRule>();
    for (const rule of rules) {
        ruleMap.set(rule.deadline_code, rule);
    }

    // Filter out rules with missing parents
    const validRules: DeadlineRule[] = [];
    for (const rule of rules) {
        if (rule.parent_deadline_code && !ruleMap.has(rule.parent_deadline_code)) {
            console.warn(
                `Skipping deadline '${rule.deadline_code}' because parent '${rule.parent_deadline_code}' is missing`
            );
            continue;
        }
        validRules.push(rule);
    }

    // Topological sort using Kahn's algorithm
    const inDegree = new Map<string, number>();
    const children = new Map<string, string[]>();

    // Initialize
    for (const rule of validRules) {
        if (!inDegree.has(rule.deadline_code)) {
            inDegree.set(rule.deadline_code, 0);
        }
        if (rule.parent_deadline_code) {
            inDegree.set(rule.deadline_code, (inDegree.get(rule.deadline_code) || 0) + 1);

            if (!children.has(rule.parent_deadline_code)) {
                children.set(rule.parent_deadline_code, []);
            }
            children.get(rule.parent_deadline_code)!.push(rule.deadline_code);
        }
    }

    // Queue of nodes with no dependencies
    const queue: string[] = [];
    for (const rule of validRules) {
        if (inDegree.get(rule.deadline_code) === 0) {
            queue.push(rule.deadline_code);
        }
    }

    const sorted: DeadlineRule[] = [];
    let depth = 0;

    while (queue.length > 0) {
        const levelSize = queue.length;
        depth++;

        if (depth > MAX_CHAIN_DEPTH) {
            throw new DeadlineCalculationError(
                `Maximum chain depth of ${MAX_CHAIN_DEPTH} exceeded`,
                ErrorCode.MAX_CHAIN_DEPTH
            );
        }

        for (let i = 0; i < levelSize; i++) {
            const code = queue.shift()!;
            const rule = ruleMap.get(code)!;
            sorted.push(rule);

            // Reduce in-degree of children
            const childCodes = children.get(code) || [];
            for (const childCode of childCodes) {
                const newDegree = inDegree.get(childCode)! - 1;
                inDegree.set(childCode, newDegree);
                if (newDegree === 0) {
                    queue.push(childCode);
                }
            }
        }
    }

    return sorted;
}

/**
 * Calculates the longest dependency path in nominal days.
 * sortedRules must already be topologically sorted so parents appear before children.
 */
function getMaxTraversalDays(sortedRules: DeadlineRule[]): number {
    const traversalDaysByCode = new Map<string, number>();
    let maxTraversalDays = 0;

    for (const rule of sortedRules) {
        const parentTraversalDays = rule.parent_deadline_code
            ? (traversalDaysByCode.get(rule.parent_deadline_code) ?? 0)
            : 0;
        const traversalDays = parentTraversalDays + rule.days;

        traversalDaysByCode.set(rule.deadline_code, traversalDays);
        maxTraversalDays = Math.max(maxTraversalDays, traversalDays);
    }

    return maxTraversalDays;
}

/**
 * Builds a complete Deadline object from a rule and calculation result
 */
function buildDeadline(
    rule: Pick<DeadlineRule, 'deadline_name' | 'short_name' | 'deadline_code' | 'legislation'>,
    calculatedResult: DateCalculationResult,
    logic: DateCalculation['logic'],
    syntmisi: boolean
): Deadline {
    const { plain, formatted } = parseLegislation(rule.legislation, syntmisi, rule.deadline_code);

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
        type: rule.deadline_code as AdminDeadlineCode,
        // NOT USED
        nomothesia: plain,

    };
}

/**
 * Validates input parameters
 */
function validateInput(input: GetDeadlinesInput): void {
    if (!input.dikasimos || typeof input.dikasimos !== 'string') {
        throw new DeadlineCalculationError(
            'dikasimos is required and must be a string',
            ErrorCode.INVALID_INPUT
        );
    }

    // Validate date format
    try {
        parseISODate(input.dikasimos);
    } catch (error) {
        throw new DeadlineCalculationError(
            `Invalid dikasimos date format: ${input.dikasimos}. Expected YYYY-MM-DD`,
            ErrorCode.INVALID_INPUT,
            { originalError: error }
        );
    }

    // Validate court_type
    if (!Object.values(CourtType).includes(input.court_type)) {
        throw new DeadlineCalculationError(
            `Invalid court_type: ${input.court_type}`,
            ErrorCode.INVALID_INPUT
        );
    }

    // Validate procedure_type
    if (!Object.values(ProcedureType).includes(input.procedure_type)) {
        throw new DeadlineCalculationError(
            `Invalid procedure_type: ${input.procedure_type}`,
            ErrorCode.INVALID_INPUT
        );
    }
}

/**
 * Main function to get all deadlines for a given case
 *
 * @param input - Court type, procedure type, and dikasimos date
 * @returns Array of calculated deadlines
 * @throws {DeadlineCalculationError} If circular dependency detected or invalid input
 *
 * @example
 * ```typescript
 * const deadlines = await getDeadlines({
 *   court_type: CourtType.DP_DE,
 *   procedure_type: ProcedureType.DIAFORA_OUSIAS,
 *   dikasimos: '2024-03-15'
 * });
 * ```
 */
export async function getAdminDeadlines(input: GetDeadlinesInput): Promise<Deadline[]> {
    const syntmisi = input.syntmisi ?? false;
    // 1. Validate input
    validateInput(input);

    // 2. Fetch rules from database
    const rules = await fetchDeadlineRules(input.court_type, input.procedure_type);

    // 3. Return empty array if no rules found
    if (rules.length === 0) {
        return [];
    }

    // 4. Sort rules topologically (validates and filters)
    const sortedRules = sortDeadlineRules(rules);

    // 5. Calculate date range for argies.
    // Administrative deadlines can cross the 77-day summer suspension and still need
    // final weekend/holiday skips beyond the nominal day count, so preload a wide
    // enough window on both sides of the reference date.
    const maxTraversalDays = getMaxTraversalDays(sortedRules);
    const forwardRange = getDateRangeForCalculation(
        input.dikasimos,
        maxTraversalDays,
        'forward',
        DATE_RANGE_BUFFER_DAYS
    );
    const backwardRange = getDateRangeForCalculation(
        input.dikasimos,
        maxTraversalDays,
        'backward',
        DATE_RANGE_BUFFER_DAYS
    );

    // 6. Fetch argies once for entire range
    const argies = getArgiesForRange(backwardRange.startDate, forwardRange.endDate);

    // 7. Fetch anastoli (summer suspension: July 1 - September 15) for entire range
    const anastoli = getAnastoliForRange(backwardRange.startDate, forwardRange.endDate);

    const argiesAndAnastoli: ArgiesAndAnastoli = {
        argies,
        anastoli,
    };

    // 8. Calculate deadlines in sorted order
    const calculatedDeadlines = new Map<string, Deadline>();
    const deadlines: Deadline[] = [];

    for (const rule of sortedRules) {
        let referenceDate: string;
        const referenceLabel = rule.reference_point;

        if (rule.parent_deadline_code) {
            const parent = calculatedDeadlines.get(rule.parent_deadline_code);
            if (!parent) {
                // This shouldn't happen due to topological sort, but handle gracefully
                console.warn(
                    `Parent '${rule.parent_deadline_code}' not found for '${rule.deadline_code}', using dikasimos`
                );
                referenceDate = input.dikasimos;
            } else {
                referenceDate = parent.date;
            }
        } else {
            referenceDate = input.dikasimos;
        }

        const effectiveRule = (syntmisi && rule.deadline_code === 'apopseis_fakelos_dioikisis')
            ? { ...rule, days: 8 }
            : rule;

        const calculatedResult = calculateDeadlineDate(
            effectiveRule,
            referenceDate,
            argiesAndAnastoli
        );

        const logic = buildCalculationLogic(
            effectiveRule,
            referenceDate,
            referenceLabel
        );

        const deadline = buildDeadline(rule, calculatedResult, logic, syntmisi);

        calculatedDeadlines.set(rule.deadline_code, deadline);
        deadlines.push(deadline);
    }

    return deadlines;
}
