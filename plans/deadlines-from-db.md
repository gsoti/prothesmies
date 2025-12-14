# Specification: Build Deadlines from Database Rules

## Goal
Create a function `getDeadlines({court_type, procedure_type, dikasimos})` that:
- Fetches deadline rules from the `prothesmies-admin` database table
- Calculates deadline dates using existing date calculation utilities
- Handles chained deadlines (deadlines that reference other deadlines)
- Returns an array of `Deadline` objects with all required fields

## Key Decisions

### Data Sources
- **Database**: Query `prothesmies-admin` table only
- **Filter**: Only handle deadlines with `reference_point = 'DIKASIMOS'` for now
- **Argies (holidays)**: Use existing `getArgiesForRange()` function (computed, not from DB)
- **Anastoli (suspension periods)**: Empty array for now (future enhancement)

### Type System
- **Replace** existing `DeadlineType` enum entirely with new `DeadlineCode` enum based on DB `deadline_code` values
- **Add** new enums: `CourtType`, `ProcedureType`, `DayCount`, `ReferencePoint`, `Direction`
- **Add** new interfaces: `DeadlineRule` (DB row), `GetDeadlinesInput` (function params)

### DateCalculation Mapping
- Build the `DateCalculation.logic` field when constructing `Deadline` objects (not in `getDateCalculation()`)
- Combine results from `getDateCalculation()` with metadata from `DeadlineRule`

### Chained Deadlines
- **Missing parent**: Skip the rule and log a warning (don't throw error)
- **Circular dependency**: Detect and throw error with cycle path (e.g., "A -> B -> C -> A")
- **Resolution order**: Use topological sort to ensure parents are calculated before children

### Field Population
- **Legislation**: Plain text from DB, just use the legislation column
- **Ypologismos**: Empty array for now (can auto-generate later)
- **Imeres**: Map `day_count` to Greek descriptions

## Database Schema Reference

### prothesmies-admin table
| Field | Type | Example Values |
|-------|------|----------------|
| court_type | text | "DP/DE" |
| procedure_type | text | "DIAFORA_OUSIAS" |
| deadline_name | text | "Κατάθεση υπομνήματος" |
| deadline_code | text | "ypomnima" |
| days | bigint | 30 |
| day_count | text | "CALENDAR", "FULL", "WORKING" |
| reference_point | text | "DIKASIMOS", "ORISMOS_EISIGITI", "LIXI_YPOMNIMATOS" |
| direction | text | "BEFORE", "AFTER", "UNTIL" |
| legislation | text | "Άρθρο 237 ΚΠολΔ" |
| notification_days | bigint | 0 |
| parent_deadline_code | text / null | "ypomnima" or null |
| notes | text / null | Free text |

## Mapping Rules

### Day Count → Count Behavior
- `CALENDAR` → `'standard'`
- `FULL` → `'standard'`
- `WORKING` → `'workingDaysOnly'`

### Direction → Calculation Direction
- `BEFORE` → `'backward'`
- `AFTER` → `'forward'`
- `UNTIL` → `'forward'` (treat this the same way as `BEFORE`)

### Direction → Logic.when Field
- `BEFORE` → `'before'`
- `AFTER` → `'after'`
- `UNTIL` → `'after'`

### Day Count → Greek Description (imeres field)
- `CALENDAR` → "Ημερολογιακές ημέρες"
- `FULL` → "Πλήρεις ημέρες"
- `WORKING` → "Εργάσιμες ημέρες"

## Implementation Components

### 1. Type Updates (`src/types.ts`)

**Remove**:
- Old `DeadlineType` enum (lines 1-21)

**Add**:
- `DeadlineCode` enum with values: `apopseis_fakelos_dioikisis`, `anakoinosi_dikis`, `prostheti_logoi`, `prosepiklisi_omodikon`, `fakelos_symvivastikou`, `paremvasi`, `aitisi_martyra`, `ypomnima`, `ypomnima_antikrousis`, `dikografo_omodikon`, `dilosi_nomim_apodeiktika`, `paravolo`, `dikastiko_ensimo`, `dikasimos`
- `CourtType` enum with value: `DP_DE = "DP/DE"`
- `ProcedureType` enum with value: `DIAFORA_OUSIAS = "DIAFORA_OUSIAS"`
- `DayCount` enum with values: `CALENDAR`, `FULL`, `WORKING`
- `ReferencePoint` enum with values: `DIKASIMOS`, `ORISMOS_EISIGITI`, `LIXI_YPOMNIMATOS`
- `Direction` enum with values: `BEFORE`, `AFTER`, `UNTIL`
- `DeadlineRule` interface (matches DB schema)
- `GetDeadlinesInput` interface (court_type, procedure_type, dikasimos)

**Update**:
- `Deadline.type` field to use `DeadlineCode` instead of `DeadlineType`

### 2. Main Module (`src/deadlines.ts`)

**Functions to create**:

#### Database Query
- `fetchDeadlineRules(courtType, procedureType)`: Query DB for rules matching court/procedure, filtered to DIKASIMOS reference point

#### Mapping Helpers
- `mapDayCountToBehavior(dayCount)`: Convert DB day_count to countBehavior for getDateCalculation
- `mapDirectionToCalculation(direction)`: Convert DB direction to forward/backward
- `getWhenText(direction)`: Convert direction to 'before'/'after' for logic field

#### Legislation Parser
- `parseLegislation(legislation)`: Use the DB value to populate article, use empty string for text and empty array for highlighted (for now)

#### Chained Deadline Resolution
- `detectCircularDependency(rules)`: Check for cycles, return error message if found
- `sortDeadlineRules(rules)`: Topological sort ensuring parents before children, filter out rules with missing parents

#### Calculation and Construction
- `buildCalculationLogic(rule, referenceDate, referenceName)`: Create DateCalculation.logic field
- `calculateDeadlineDate(rule, referenceDate, referenceName, argiesAndAnastoli)`: Calculate date using getDateCalculation, handle UNTIL special case
- `buildDeadline(rule, calculatedDate, calculationResult, referenceDate, referenceName)`: Construct full Deadline object

#### Main Orchestration
- `getDeadlines(input)`: Main exported function that coordinates all steps

**Flow**:
1. Fetch rules from DB (filtered to DIKASIMOS)
2. Sort rules topologically (validate, skip missing parents, error on circular deps)
3. Calculate argies for needed date range (both forward and backward from dikasimos)
4. For each rule in sorted order:
   - Determine reference date (dikasimos for roots, parent's calculated date for children)
   - Calculate deadline date
   - Build full Deadline object with DateCalculation.logic
   - Store in map for children to reference
5. Return array of Deadline objects

### 3. Tests (`src/deadlines.test.ts`)

**Test Categories**:

1. **Basic functionality**
   - Empty result when no rules found
   - Single deadline calculation
   - DateCalculation.logic field populated correctly

2. **Chained deadlines**
   - Simple parent-child resolution
   - Multi-level chains (grandparent → parent → child)
   - Missing parent skipped with warning

3. **Error scenarios**
   - Circular dependency throws error with cycle path
   - Invalid dikasimos date throws error

4. **Mapping correctness**
   - CALENDAR/FULL → 'standard'
   - WORKING → 'workingDaysOnly'
   - BEFORE → 'backward', AFTER → 'forward'
   - UNTIL → reference date exactly

5. **Legislation parsing**
   - Extract article number from Greek text
   - Handle missing article gracefully

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Missing parent | Skip rule with console warning |
| Circular dependency | Throw error with cycle path |
| Invalid dikasimos | Throw error (from getDateCalculation) |
| Empty DB result | Return empty array |
| Unknown enum value | Throw error in mapping function |

## Edge Cases

1. **UNTIL direction**: Returns reference date exactly (equivalent to days=0)
2. **Multiple parents**: Not supported (DB schema allows only one parent_deadline_code)
3. **Very long deadlines**: Max 365 days considered for argies calculation
4. **Argies**: Computed programmatically (Orthodox Easter, fixed holidays, weekends)
5. **Anastoli**: Always empty array (future: fetch from DB)

## Deadline Object Field Mapping

| DB Field → Deadline Field | Notes |
|---------------------------|-------|
| deadline_name → name | Direct mapping |
| deadline_code → shortName | Direct mapping |
| deadline_code → type | Cast to DeadlineCode enum |
| calculated date → date | From getDateCalculation result |
| legislation → nomothesia | Wrap in array |
| parsed legislation → formattedNomothesia | Extract article + wrap in array |
| (empty) → ypologismos | Empty array for now |
| day_count description → imeres | Convert to Greek text, wrap in array |
| calculation result → calculation | Build DateCalculation with logic field |

## DateCalculation.logic Field Structure

The logic field contains metadata about how the date was calculated:

```
logic: {
  days: number;           // From rule.days
  when: 'before'|'after'; // From rule.direction
  reference: string;      // Greek text (e.g., "δικάσιμο" or parent name)
  start: string;          // ISO date used as reference
  name: string;           // From rule.deadline_name
}
```

## Critical Files

1. **`src/types.ts`** - Type definitions (remove old enum, add 6 new enums, add 2 interfaces)
2. **`src/deadlines.ts`** - New file with all deadline logic
3. **`src/deadlines.test.ts`** - New file with comprehensive tests
4. **`src/dateCalculation.ts`** - Existing (no changes, used as-is)
5. **`src/utils/argies.ts`** - Existing (no changes, used as-is)

## Future Enhancements

- Support anastoli table (suspension periods from DB)
- Support multiple reference points (ORISMOS_EISIGITI, LIXI_YPOMNIMATOS)
- Enhanced legislation parsing for complex article references
- Auto-generate ypologismos descriptions
- Notification days calculation
- Caching for argies and DB queries

## Validation Checklist

- [ ] DeadlineType enum removed, DeadlineCode added
- [ ] All 6 new enums added
- [ ] DeadlineRule and GetDeadlinesInput interfaces added
- [ ] Deadline.type uses DeadlineCode
- [ ] getDeadlines() function implemented and exported
- [ ] fetchDeadlineRules() queries prothesmies-admin correctly
- [ ] All mapping helpers implemented
- [ ] Circular dependency detection works
- [ ] Missing parent rules are skipped
- [ ] DateCalculation.logic field populated correctly
- [ ] UNTIL direction returns reference date
- [ ] Comprehensive tests written and passing
