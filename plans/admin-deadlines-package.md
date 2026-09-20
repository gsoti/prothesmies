# Administrative Deadline Engine Plan

## Goal

Turn the existing administrative calculator into a deterministic, versioned package API comparable to the civil deadline engine. The package owns legal rules and date calculations only; it does not know about application cases, databases, case-category eligibility, or deadline persistence.

## Public Interface

Export this contract from the package root:

```ts
export enum CourtType {
  DP_DE = "DP/DE",
}

export enum ProcedureType {
  DIAFORA_OUSIAS = "DIAFORA_OUSIAS",
}

export interface GetAdminDeadlinesInput {
  court_type: CourtType;
  procedure_type: ProcedureType;
  dikasimos: string; // YYYY-MM-DD
  syntmisi?: boolean; // defaults to false
}

export function getAdminDeadlines(
  input: GetAdminDeadlinesInput,
): Deadline[];
```

Contract details:

- The function is synchronous and deterministic.
- It returns only calculated legal deadlines; it does not return filing or hearing anchors.
- It returns the existing `Deadline[]` shape, including calculation steps and legislation metadata.
- It throws `DeadlineCalculationError` for invalid input or invalid rule dependencies.
- `dikasimos` must be a valid ISO calendar date that falls on a weekday and is not a holiday recognized by the package's Greek holiday calendar.
- A weekend or recognized Greek-holiday `dikasimos` is outside the supported input domain and throws `DeadlineCalculationError`.
- `syntmisi` affects only the rule currently identified as `apopseis_fakelos_dioikisis`.
- Keep `GetDeadlinesInput` as a deprecated type alias if internal or downstream compatibility requires it.

## Responsibility Boundary

The package owns:

- Versioned legal rules.
- Rule dependency ordering.
- Working, full, and calendar-day calculations.
- Greek holidays and administrative summer suspension.
- Shortened-deadline behavior.
- Calculation explanations and legislation metadata.

Consumers own:

- Determining whether an application case is eligible.
- Mapping application court codes to `CourtType.DP_DE`.
- Filing and hearing anchor deadlines.
- Database storage and reconciliation.
- Recording the installed package version as `calculation_version`.

## Implementation

- Move the 12 active administrative rules into a versioned TypeScript rule module.
- Do not include the inactive `fakelos_symvivastikou` rule in calculated output.
- Remove the `"prothesmies-admin"` database lookup and all runtime database access from the administrative calculator.
- Preserve topological ordering, chained calculations, Greek holidays, summer suspension, working/full/calendar-day handling, and legislation parsing.
- Refactor `getAdminDeadlines` to use the bundled rule set and return synchronously.
- Export `getAdminDeadlines`, `GetAdminDeadlinesInput`, `CourtType`, `ProcedureType`, and `DeadlineCalculationError` from the package root.
- Remove database dependencies and configuration from the runtime and published package path. A database client may remain temporarily as a development-only dependency for the test-only legacy parity harness.
- Bump and publish the package version. Consumers must use this version as the authoritative `calculation_version`.

Expected source shape:

```text
src/
├── index.ts                              # public exports
├── deadlines-admin.ts                    # validation and calculation orchestration
├── rules/
│   └── rules-admin-diafora-ousias.ts     # 12 active versioned rules
├── types.ts                              # public input and output types
└── tests/
    └── deadlines-admin.test.ts              # deterministic calculator tests

tests/
└── admin-parity/
    ├── legacy-admin-calculator.ts         # frozen, test-only database implementation
    ├── admin-db-rules.ts                  # one-time rule loading and fingerprint check
    └── admin-parity.test.ts               # property-based old/new comparison
```

## Test Plan

- Snapshot all 12 active deadline results for a fixed hearing date.
- Cover ordinary and shortened calculations.
- Cover calculated deadlines that cross or land on weekends and Greek holidays, summer suspension, and the `ypomnima → ypomnima_antikrousis` chain.
- Verify that returned deadline type codes are unique.
- Verify calculation explanations and legislation metadata.
- Verify malformed dates, impossible calendar dates, weekend or Greek-holiday hearing dates, and unsupported enum values throw `DeadlineCalculationError`.
- Verify missing or circular rule dependencies fail predictably.
- Verify the administrative calculator performs no database or network access.
- Run unit tests, type checking, package build, and package-consumer smoke tests.

### Legacy Database Parity

Before replacing the database-backed implementation, preserve a frozen copy as a test-only reference implementation. It must not be exported from the package root or included in the published `dist` output.

- Load the active `DP_DE` / `DIAFORA_OUSIAS` database rules once per parity test run rather than once per generated input.
- Normalize the fetched rows and verify an expected rule fingerprint before treating the database as the reference oracle. An intentional database rule change therefore requires explicit review.
- Keep the legacy rule traversal and deadline construction independent from the new implementation so a shared orchestration defect cannot make both sides pass together.
- Generate random valid `dikasimos` dates across a representative multi-year range. Generated dates must always be Monday through Friday and must not be Greek holidays.
- Generate both `syntmisi: false` and `syntmisi: true` cases.
- For each generated input, compare the complete legacy and new outputs: codes, dates, names, calculation logic, paused and skipped dates, and legislation metadata.
- Compare semantic output keyed by deadline type because the legacy SQL query has no guaranteed row order. Verify the new implementation's stable output order separately.
- Assert uniqueness and the exact 12-code set before keying results so normalization cannot hide duplicate or missing deadlines.
- Run enough generated cases to exercise calendar, working-day, holiday, year-boundary, and summer-suspension interactions; start with at least 1,000 reproducible FastCheck runs.
- Retain deterministic, independently reviewed boundary examples because legacy parity proves behavioral equivalence, not legal correctness.

The parity suite must use a dedicated command such as `npm run test:admin-parity`. That command must fail when its required database credentials are unavailable; it must never silently skip. The normal unit-test suite remains deterministic and database-free.

Weekend and Greek-holiday `dikasimos` values are deliberately excluded from old/new parity generation because they are outside the new supported input domain. They are covered by direct validation tests against the new API.

## Acceptance Criteria

- A consumer can import every administrative API symbol from the package root.
- `getAdminDeadlines` produces the same result for the same input without database access.
- The output contains the 12 active calculated deadlines and no consumer-owned anchors.
- Valid hearing dates are restricted to non-holiday weekdays, and invalid hearing dates fail predictably.
- Existing civil deadline behavior and exports remain unchanged.
- The published package can be installed and called by both `legalverticalsaas` and `ls-crawler`.

## Assumptions

- The only initially supported engine configuration is `DP_DE` with `DIAFORA_OUSIAS`.
- An administrative `dikasimos` is always expected to be a non-holiday weekday.
- Case eligibility based on category and application court code remains a consumer responsibility.
- Filing and hearing anchors are deliberately excluded from the package output.
