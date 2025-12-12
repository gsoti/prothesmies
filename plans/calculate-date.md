# Specification: Generalized Legal Deadline Date Calculation

## Overview
A date calculation system for computing legal deadlines that accounts for holidays and suspension periods. The system supports both forward and backward date calculations with two distinct types of non-working periods.

---

## Core Concepts

### 1. **Argies (Holidays)**
- Non-working days that are **skipped** when they fall on the calculated deadline
- If the final calculated date lands on an argia, the deadline moves forward (or backward) to the next working day
- Examples: weekends, national holidays

### 2. **Anastoli (Suspensions)**
- Periods when the deadline counter is **paused**
- Days within suspension periods don't count toward the total
- When encountered during counting, they extend the deadline
- Examples: summer court recess, Christmas break, public sector closures

### 3. **Key Difference**
- **Argies**: Push the final date if it lands on them
- **Anastoli**: Pause the counting process when encountered

---

## Function: Date Calculation

### Signature
```typescript
getDateCalculation(
  start: string,
  noOfDays: number,
  options: {
    direction: 'forward' | 'backward',
    countBehavior: 'standard' | 'workingDaysOnly',
    argiesAndAnastoli: { argies: string[], anastoli: string[] }
  }
): { date: string, paused: string[], skipped: string[] }
```

### Input Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | string | Reference date in ISO format (`YYYY-MM-DD`). **Excluded from count.** |
| `noOfDays` | number | Number of days to add/subtract (must be >= 0) |
| `options.direction` | 'forward' \| 'backward' | Whether to count forward or backward in time |
| `options.countBehavior` | 'standard' \| 'workingDaysOnly' | Whether to pause only on suspensions (standard) or on both holidays and suspensions (workingDaysOnly) |
| `options.argiesAndAnastoli` | object | Contains arrays of holidays and suspension dates |
| `options.argiesAndAnastoli.argies` | string[] | Array of holiday dates in ISO format (`YYYY-MM-DD`) |
| `options.argiesAndAnastoli.anastoli` | string[] | Array of suspension dates in ISO format (`YYYY-MM-DD`) |

### Important Notes
- **Start date is excluded**: The start date itself is not counted. Day 1 begins the day after (forward) or before (backward) the start date.
- **Validation**: If `noOfDays < 0`, the function throws an error.
- **Special case**: If `noOfDays === 0`, returns the start date.

### Algorithm

#### Phase 1: Count Days While Avoiding Suspensions
```
Initialize:
  - dt = start date
  - arr = empty array (to store valid days)
  - paused = empty array (to track paused dates)
  - i = 0 (day counter)
  - step = direction === 'forward' ? +1 day : -1 day
  - pauseCheck = countBehavior === 'standard' ? anastoli : (argies + anastoli)

WHILE i < noOfDays:
  1. Move dt by step (forward: add 1 day, backward: subtract 1 day)

  2. IF dt is NOT in pauseCheck:
       - Add dt to arr
       - Increment i
     ELSE:
       - Add dt to paused array
       - Do NOT increment i (pause the count)

Result: arr contains noOfDays worth of dates, excluding periods based on countBehavior
```

#### Phase 2: Handle Holidays on Final Date
```
Initialize:
  - lastDay = last element in arr
  - skipped = empty array (to track skipped dates)
  - step = direction === 'forward' ? +1 day : -1 day

IF countBehavior === 'standard':
  // The last day can only be an argia (holiday), never anastoli
  // because Phase 1 already skipped all anastoli days

  IF lastDay is in anastoli:
    THROW ERROR: "Invalid state: final date landed on anastoli"

  WHILE lastDay is in argies:
    1. Add lastDay to skipped array
    2. Move lastDay by step
    3. Add lastDay to arr

ELSE IF countBehavior === 'workingDaysOnly':
  // The last day cannot be argia or anastoli
  // because Phase 1 already skipped both

  IF lastDay is in (argies OR anastoli):
    THROW ERROR: "Invalid state: final date landed on non-working day"

Result: lastDay is the first working day in the specified direction
```

### Output Structure

```typescript
{
  date: string,        // Final calculated deadline in ISO format (YYYY-MM-DD)
  paused: string[],    // Dates when count was paused (based on countBehavior)
  skipped: string[]    // Dates that were skipped at the end (argies/anastoli)
}
```

### Example 1: Forward Direction (Standard Behavior)

```
Input:
  start = '2024-01-15'
  noOfDays = 10
  options = {
    direction: 'forward',
    countBehavior: 'standard',
    argiesAndAnastoli: {
      argies: ['2024-01-20', '2024-01-21', '2024-01-25'],  // Sat, Sun, Holiday
      anastoli: ['2024-01-22', '2024-01-23', '2024-01-24']  // 3-day suspension
    }
  }

Execution:
  Phase 1 - Count 10 days forward:
    Day 1: 2024-01-16 ✓
    Day 2: 2024-01-17 ✓
    Day 3: 2024-01-18 ✓
    Day 4: 2024-01-19 ✓
    Day 5: 2024-01-20 ✓
    Day 6: 2024-01-21 ✓
    ----- 2024-01-22 PAUSED (anastoli)
    ----- 2024-01-23 PAUSED (anastoli)
    ----- 2024-01-24 PAUSED (anastoli)
    Day 7: 2024-01-25 ✓
    Day 8: 2024-01-26 ✓
    Day 9: 2024-01-27 ✓
    Day 10: 2024-01-28 ✓

  Phase 2 - Check final date:
    2024-01-28 is NOT in argies/anastoli ✓

Output:
  date: 2024-01-28
  paused: ['2024-01-22', '2024-01-23', '2024-01-24']
  skipped: []
```

### Example 2: Backward Direction (Standard Behavior)

```
Input:
  start = '2024-01-28'
  noOfDays = 10
  options = {
    direction: 'backward',
    countBehavior: 'standard',
    argiesAndAnastoli: {
      argies: ['2024-01-20', '2024-01-21'],  // Sat, Sun
      anastoli: ['2024-01-22', '2024-01-23', '2024-01-24']  // 3-day suspension
    }
  }

Execution:
  Phase 1 - Count 10 days backward:
    Day 1: 2024-01-27 ✓
    Day 2: 2024-01-26 ✓
    Day 3: 2024-01-25 ✓
    ----- 2024-01-24 PAUSED (anastoli)
    ----- 2024-01-23 PAUSED (anastoli)
    ----- 2024-01-22 PAUSED (anastoli)
    Day 4: 2024-01-21 ✓
    Day 5: 2024-01-20 ✓
    Day 6: 2024-01-19 ✓
    Day 7: 2024-01-18 ✓
    Day 8: 2024-01-17 ✓
    Day 9: 2024-01-16 ✓
    Day 10: 2024-01-15 ✓

  Phase 2 - Check final date:
    2024-01-15 is NOT in argies/anastoli ✓

Output:
  date: 2024-01-15
  paused: ['2024-01-24', '2024-01-23', '2024-01-22']
  skipped: []
```

### Example 3: Working Days Only Behavior

```
Input:
  start = '2024-01-15'
  noOfDays = 10
  options = {
    direction: 'forward',
    countBehavior: 'workingDaysOnly',
    argiesAndAnastoli: {
      argies: ['2024-01-20', '2024-01-21'],  // Sat, Sun
      anastoli: ['2024-01-24', '2024-01-25']  // 2-day suspension
    }
  }

Execution:
  Phase 1 - Count 10 working days forward:
    Day 1: 2024-01-16 ✓
    Day 2: 2024-01-17 ✓
    Day 3: 2024-01-18 ✓
    Day 4: 2024-01-19 ✓
    ----- 2024-01-20 PAUSED (argia - counted as working day only)
    ----- 2024-01-21 PAUSED (argia - counted as working day only)
    Day 5: 2024-01-22 ✓
    Day 6: 2024-01-23 ✓
    ----- 2024-01-24 PAUSED (anastoli)
    ----- 2024-01-25 PAUSED (anastoli)
    Day 7: 2024-01-26 ✓
    Day 8: 2024-01-27 ✓
    Day 9: 2024-01-28 ✓
    Day 10: 2024-01-29 ✓

  Phase 2 - Check final date:
    2024-01-29 is NOT in argies/anastoli ✓

Output:
  date: 2024-01-29
  paused: ['2024-01-20', '2024-01-21', '2024-01-24', '2024-01-25']
  skipped: []
```

**Key Difference**: With `workingDaysOnly`, both holidays (argies) AND suspensions (anastoli) pause the counter during Phase 1, whereas `standard` only pauses on suspensions.

### Use Cases
- **Forward + Standard**: "File response within 30 days after service"
- **Backward + Standard**: "File documents 10 days before the hearing"
- **Forward + WorkingDaysOnly**: "File within 10 working days (excluding weekends and holidays)"

---

## Implementation Notes

### Date Format Consistency
- All input dates: ISO format strings `YYYY-MM-DD`
- Internal processing: JavaScript `Date` objects
- Output dates: ISO format strings `YYYY-MM-DD` (convert with `.toISOString().split('T')[0]`)

### Time Zone Handling
- All date operations use midnight UTC
- Adding days: `dt.setTime(dt.getTime() + 24 * 3600 * 1000)`
- Subtracting days: `dt.setTime(dt.getTime() - 24 * 3600 * 1000)`

### Validation
- **Negative days**: If `noOfDays < 0`, throw an error
- **Invalid dates**: Validate that start date and all argies/anastoli dates are valid ISO format
- **Phase 2 invariants**:
  - **Standard mode**: If final date is in anastoli, throw error (logic bug - Phase 1 should have skipped it)
  - **WorkingDaysOnly mode**: If final date is in argies or anastoli, throw error (logic bug - Phase 1 should have skipped it)

### Edge Cases
1. **Zero days** (`noOfDays === 0`): Returns the start date
2. **Empty argies/anastoli**: Behaves like simple day addition (excluding start date)
3. **Overlapping argies and anastoli**: Treated the same (both cause skipping in Phase 2)
4. **Consecutive suspensions**: Automatically handled by the loop

---

## Summary Table

| countBehavior | Direction | Pause On (Phase 1) | Skip On Final (Phase 2) |
|---------------|-----------|-------------------|------------------------|
| `standard` | Forward / Backward | Anastoli only | Argies only (error if anastoli) |
| `workingDaysOnly` | Forward / Backward | Argies + Anastoli | None (error if either found) |
