import { sql } from './db.js';
import { getDateCalculation, DateCalculationResult, ArgiesAndAnastoli } from './dateCalculation.js';
import { getArgiesForRange, getDateRangeForCalculation } from './utils/argies.js';
import { parseISODate } from './utils/dateUtils.js';
import {
    DeadlineCode,
    CourtType,
    ProcedureType,
    DayCount,
    ReferencePoint,
    Direction,
    DeadlineRule,
    GetDeadlinesInput,
    Deadline,
    DateCalculation,
    Nomothesia
} from './types.js';
import { NOMOTHESIA_TEXT, getHighlighted } from './nomothesiaData.js';

/**
 * Custom error class for deadline calculation errors
 */
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

// Error codes
const ErrorCode = {
    INVALID_INPUT: 'INVALID_INPUT',
    CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
    MAX_CHAIN_DEPTH: 'MAX_CHAIN_DEPTH',
    INVALID_ENUM: 'INVALID_ENUM',
} as const;

const MAX_CHAIN_DEPTH = 10;

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
 * Maps database day_count to date calculation countBehavior
 */
function mapDayCountToBehavior(dayCount: DayCount): 'standard' | 'workingDaysOnly' {
    switch (dayCount) {
        case DayCount.CALENDAR:
        case DayCount.FULL:
            return 'standard';
        case DayCount.WORKING:
            return 'workingDaysOnly';
        default:
            throw new DeadlineCalculationError(
                `Invalid day count: ${dayCount}. Valid values: CALENDAR, FULL, WORKING`,
                ErrorCode.INVALID_ENUM
            );
    }
}

/**
 * Maps database direction to date calculation direction
 */
function mapDirectionToCalculation(direction: Direction): 'forward' | 'backward' {
    switch (direction) {
        case Direction.BEFORE:
            return 'backward';
        case Direction.AFTER:
        case Direction.UNTIL:
            return 'forward';
        default:
            throw new DeadlineCalculationError(
                `Invalid direction: ${direction}. Valid values: BEFORE, AFTER, UNTIL`,
                ErrorCode.INVALID_ENUM
            );
    }
}

/**
 * Maps database direction to logic.when field
 */
function getWhenText(direction: Direction): 'before' | 'after' {
    switch (direction) {
        case Direction.BEFORE:
            return 'before';
        case Direction.AFTER:
        case Direction.UNTIL:
            return 'after';
        default:
            throw new DeadlineCalculationError(
                `Invalid direction: ${direction}. Valid values: BEFORE, AFTER, UNTIL`,
                ErrorCode.INVALID_ENUM
            );
    }
}

/**
 * Parses legislation text and retrieves text/highlighted based on legislation article
 */
function parseLegislation(legislation: string | null, syntmisi: boolean, deadlineCode?: string): {
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
 * Builds the logic object for DateCalculation
 */
function buildCalculationLogic(
    rule: DeadlineRule,
    referenceDate: string
): DateCalculation['logic'] {
    return {
        days: rule.days,
        day_count: rule.day_count,
        when: getWhenText(rule.direction),
        reference: rule.reference_point,
        start: referenceDate,
        name: rule.short_name,
    };
    /*
    "logic": Object {
        "days": 5,
        "name": "Δικάσιμος",
        "reference": "dikasimos",
        "start": "2024-07-08",
        "when": "after",
      }
        */
}

/**
 * Calculates the deadline date for a rule
 */
function calculateDeadlineDate(
    rule: DeadlineRule,
    referenceDate: string,    
    argiesAndAnastoli: ArgiesAndAnastoli
): DateCalculationResult {
    return getDateCalculation(referenceDate, rule.days, {
        direction: mapDirectionToCalculation(rule.direction),
        countBehavior: mapDayCountToBehavior(rule.day_count),
        argiesAndAnastoli,
    });
}

/**
 * Builds a complete Deadline object from a rule and calculation result
 */
function buildDeadline(
    rule: DeadlineRule,
    calculatedResult: DateCalculationResult,
    logic: DateCalculation['logic'],
    syntmisi: boolean
): Deadline {
    const { plain, formatted } = parseLegislation(rule.legislation, syntmisi, rule.deadline_code);

    /*
    Object {
    "calculation": Object {
      "date": "2024-07-15",
      "logic": Object {
        "days": 5,
        "name": "Δικάσιμος",
        "reference": "dikasimos",
        "start": "2024-07-08",
        "when": "after",
      },
      "paused": Array [
        "2024-07-13",
        "2024-07-14",
      ],
      "skipped": Array [],
    },
    "date": "2024-07-15",
    "formattedNomothesia": Array [
      Object {
        "article": "ΚΠολΔ 591 παρ. 1 περ. στ΄",
        "highlighted": Array [
          "Οι διάδικοι μπορούν έως τη δωδέκατη ώρα της πέμπτης εργάσιμης ημέρας από τη συζήτηση να καταθέσουν προσθήκη στις προτάσεις τους",
        ],
        "text": "Οι διάδικοι μπορούν έως τη δωδέκατη ώρα της πέμπτης εργάσιμης ημέρας από τη συζήτηση να καταθέσουν προσθήκη στις προτάσεις τους, με την οποία αξιολογούνται οι αποδείξεις, προτείνονται ισχυρισμοί και προσκομίζονται ένορκες βεβαιώσεις, έγγραφα και γνωμοδοτήσεις κατά το άρθρο 390 μόνο για την αντίκρουση ισχυρισμών που προτάθηκαν.",
      },
    ],
    "imeres": Array [
      "5 εργάσιμες ημέρες από την συζήτηση.",
    ],
    "name": "Κατάθεση προσθήκης",
    "nomothesia": Array [
      "ΚΠολΔ 591 παρ. 1 περ. στ΄ Οι διάδικοι μπορούν έως τη δωδέκατη ώρα της πέμπτης εργάσιμης ημέρας από τη συζήτηση να καταθέσουν προσθήκη στις προτάσεις τους, με την οποία αξιολογούνται οι αποδείξεις, προτείνονται ισχυρισμοί και προσκομίζονται ένορκες βεβαιώσεις, έγγραφα και γνωμοδοτήσεις κατά το άρθρο 390 μόνο για την αντίκρουση ισχυρισμών που προτάθηκαν.",
    ],
    "shortName": "Προσθήκη",
    "type": "prosthiki",
    "ypologismos": Array [
      "5 εργάσιμες ημέρες μετά την συζήτηση (2024-07-08)",
    ],
  }
    */

    const f = {
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
        type: rule.deadline_code as DeadlineCode,
        // NOT USED
        nomothesia: plain,
        ypologismos: [], // Empty for now
        imeres: [], // not used
    };
    return f;
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

    // 5. Calculate date range for argies
    // Find max days needed (both forward and backward)
    let maxDays = 0;
    for (const rule of sortedRules) {
        if (rule.days > maxDays) {
            maxDays = rule.days;
        }
    }

    // Get date range with buffer
    const forwardRange = getDateRangeForCalculation(input.dikasimos, maxDays, 'forward', 60);
    const backwardRange = getDateRangeForCalculation(input.dikasimos, maxDays, 'backward', 60);

    // 6. Fetch argies once for entire range
    const argies = getArgiesForRange(backwardRange.startDate, forwardRange.endDate);

    // 7. Create empty anastoli array
    const argiesAndAnastoli: ArgiesAndAnastoli = {
        argies,
        anastoli: [],
    };

    // 8. Calculate deadlines in sorted order
    const calculatedDeadlines = new Map<string, Deadline>();
    const deadlines: Deadline[] = [];

    for (const rule of sortedRules) {
        // Determine reference date and name
        let referenceDate: string;

        if (rule.parent_deadline_code) {
            // Child deadline - use parent's calculated date
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
            // Root deadline - use dikasimos
            referenceDate = input.dikasimos;            
        }

        // Override days for apopseis_fakelos_dioikisis when syntmisi is true
        const effectiveRule = (syntmisi && rule.deadline_code === 'apopseis_fakelos_dioikisis')
            ? { ...rule, days: 8 }
            : rule;

        // Calculate deadline date
        const calculatedResult = calculateDeadlineDate(
            effectiveRule,
            referenceDate,
            argiesAndAnastoli
        );

        // Build calculation logic
        const logic = buildCalculationLogic(effectiveRule, referenceDate);

        // Build full Deadline object
        const deadline = buildDeadline(rule, calculatedResult, logic, syntmisi);

        // Store for children to reference
        calculatedDeadlines.set(rule.deadline_code, deadline);
        deadlines.push(deadline);
    }

    return deadlines;
}
