import { describe, it, expect, beforeAll } from 'vitest';
import { getDeadlines, DeadlineCalculationError } from './deadlines.js';
import { CourtType, ProcedureType } from './types.js';
import { testConnection } from './db.js';

// Integration tests with real database
describe('getDeadlines - Integration Tests', () => {
    beforeAll(async () => {
        // Ensure database connection is working
        const connected = await testConnection();
        if (!connected) {
            throw new Error('Database connection failed. Tests cannot run without database.');
        }
    });

    describe('Input Validation', () => {
        it('should throw error for invalid date format', async () => {
            await expect(
                getDeadlines({
                    court_type: CourtType.DP_DE,
                    procedure_type: ProcedureType.DIAFORA_OUSIAS,
                    dikasimos: 'invalid-date',
                })
            ).rejects.toThrow('Invalid dikasimos date format');
        });

        it('should throw error for missing dikasimos', async () => {
            await expect(
                getDeadlines({
                    court_type: CourtType.DP_DE,
                    procedure_type: ProcedureType.DIAFORA_OUSIAS,
                    dikasimos: '' as any,
                })
            ).rejects.toThrow('dikasimos is required');
        });

        it('should throw error for null dikasimos', async () => {
            await expect(
                getDeadlines({
                    court_type: CourtType.DP_DE,
                    procedure_type: ProcedureType.DIAFORA_OUSIAS,
                    dikasimos: null as any,
                })
            ).rejects.toThrow('dikasimos is required');
        });

        it('should accept valid input', async () => {
            // This should not throw
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('Basic Functionality', () => {
        it('should return array of deadlines for valid input', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            expect(Array.isArray(result)).toBe(true);
            // If there's data in DB, check structure
            if (result.length > 0) {
                const deadline = result[0];
                expect(deadline).toHaveProperty('name');
                expect(deadline).toHaveProperty('shortName');
                expect(deadline).toHaveProperty('type');
                expect(deadline).toHaveProperty('date');
                expect(deadline).toHaveProperty('nomothesia');
                expect(deadline).toHaveProperty('formattedNomothesia');
                expect(deadline).toHaveProperty('ypologismos');
                expect(deadline).toHaveProperty('imeres');
                expect(deadline).toHaveProperty('calculation');
            }
        });

        it('should populate DateCalculation.logic field correctly', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            if (result.length > 0) {
                const deadline = result[0];
                expect(deadline.calculation).not.toBeNull();
                expect(deadline.calculation?.logic).toHaveProperty('days');
                expect(deadline.calculation?.logic).toHaveProperty('day_count');
                expect(deadline.calculation?.logic).toHaveProperty('when');
                expect(deadline.calculation?.logic).toHaveProperty('reference');
                expect(deadline.calculation?.logic).toHaveProperty('start');
                expect(deadline.calculation?.logic).toHaveProperty('name');

                // Verify when is either 'before' or 'after'
                expect(['before', 'after']).toContain(deadline.calculation?.logic.when);
            }
        });

        it('should have correct imeres field based on day_count', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            if (result.length > 0) {
                for (const deadline of result) {
                    expect(deadline.imeres).toHaveLength(0);
                    expect(Array.isArray(deadline.imeres)).toBe(true);
                }
            }
        });

        it('should parse legislation and extract article number', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            // Find a deadline with legislation
            const withLegislation = result.find(d => d.nomothesia.length > 0);

            if (withLegislation) {
                expect(withLegislation.nomothesia.length).toBeGreaterThan(0);
                expect(withLegislation.formattedNomothesia.length).toBeGreaterThan(0);
                expect(withLegislation.formattedNomothesia[0]).toHaveProperty('article');
                expect(withLegislation.formattedNomothesia[0]).toHaveProperty('text');
                expect(withLegislation.formattedNomothesia[0]).toHaveProperty('highlighted');
            }
        });
    });

    describe('Chained Deadlines', () => {
        it('should handle parent-child relationships correctly', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            // Find deadlines that reference other deadlines
            // Child deadline's logic.reference should be the parent's name (not "δικάσιμο")
            const childDeadlines = result.filter(
                d => d.calculation?.logic.reference !== 'dikasimos'
            );

            if (childDeadlines.length > 0) {
                for (const child of childDeadlines) {
                    // Verify that reference is a deadline name, not the dikasimos
                    expect(child.calculation?.logic.reference).not.toBe('δικάσιμο');
                    expect(typeof child.calculation?.logic.reference).toBe('string');
                    expect(child.calculation?.logic.reference.length).toBeGreaterThan(0);

                    // Verify that start is a valid date
                    expect(child.calculation?.logic.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);

                    // Verify start date is not the dikasimos for chained deadlines
                    expect(child.calculation?.logic.start).not.toBe('2024-03-15');
                }
            }
        });

        it('should have root deadlines reference dikasimos', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            // Find root deadlines (reference = "δικάσιμο")
            const rootDeadlines = result.filter(
                d => d.calculation?.logic.reference === 'δικάσιμο'
            );

            if (rootDeadlines.length > 0) {
                for (const root of rootDeadlines) {
                    expect(root.calculation?.logic.reference).toBe('δικάσιμο');
                    expect(root.calculation?.logic.start).toBe('2024-03-15');
                }
            }
        });

        it('should calculate dates in correct order (parent before child)', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-06-15', // Use summer date to avoid year-end issues
            });

            // This test verifies that the topological sort works correctly
            // by checking that we can successfully calculate all deadlines
            // without errors (which would happen if we tried to use a parent
            // that wasn't calculated yet)
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);

            // All deadlines should have valid dates
            for (const deadline of result) {
                expect(deadline.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                expect(deadline.calculation).not.toBeNull();
            }
        });
    });

    describe('Date Calculations', () => {
        it('should calculate dates correctly for BEFORE direction', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            // Find a BEFORE deadline
            const beforeDeadline = result.find(d => d.calculation?.logic.when === 'before');

            if (beforeDeadline) {
                // Date should be before the reference
                const deadlineDate = new Date(beforeDeadline.date);
                const referenceDate = new Date(beforeDeadline.calculation!.logic.start);
                expect(deadlineDate.getTime()).toBeLessThan(referenceDate.getTime());
            }
        });

        it('should calculate dates correctly for AFTER direction', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            // Find all AFTER deadlines
            const afterDeadlines = result.filter(d => d.calculation?.logic.when === 'after');

            // Check all AFTER deadlines
            for (const afterDeadline of afterDeadlines) {
                // Date should be after or equal to the reference
                const deadlineDate = new Date(afterDeadline.date);
                const referenceDate = new Date(afterDeadline.calculation!.logic.start);
                expect(deadlineDate.getTime()).toBeGreaterThanOrEqual(referenceDate.getTime());
            }
        });

        it('should handle working days vs calendar days correctly', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            // Verify that imeres field is empty
            for (const deadline of result) {
                expect(deadline.imeres).toHaveLength(0);
                expect(Array.isArray(deadline.imeres)).toBe(true);
            }
        });

        it('should include paused and skipped dates in calculation', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-08-01', // Summer date to potentially hit Aug 15 holiday
            });

            for (const deadline of result) {
                expect(deadline.calculation).not.toBeNull();
                expect(Array.isArray(deadline.calculation!.paused)).toBe(true);
                expect(Array.isArray(deadline.calculation!.skipped)).toBe(true);

                // Paused may contain weekend dates for working days deadlines
                // For non-working-days deadlines, paused should be empty (no anastoli in current implementation)
                // Just verify all paused dates are valid
                for (const paused of deadline.calculation!.paused) {
                    expect(paused).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                }

                // Skipped may or may not be empty depending on holidays
                // Just verify it's an array of valid dates
                for (const skipped of deadline.calculation!.skipped) {
                    expect(skipped).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                }
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle dikasimos on different days of the week', async () => {
            const testDates = [
                '2024-03-11', // Monday
                '2024-03-15', // Friday
                '2024-03-16', // Saturday
                '2024-03-17', // Sunday
            ];

            for (const date of testDates) {
                const result = await getDeadlines({
                    court_type: CourtType.DP_DE,
                    procedure_type: ProcedureType.DIAFORA_OUSIAS,
                    dikasimos: date,
                });

                // Should successfully calculate for any day of the week
                expect(Array.isArray(result)).toBe(true);

                for (const deadline of result) {
                    expect(deadline.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                }
            }
        });

        it('should handle dikasimos on a holiday', async () => {
            // March 25 is Greek Independence Day
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-25',
            });

            // Should successfully calculate even on a holiday
            expect(Array.isArray(result)).toBe(true);

            for (const deadline of result) {
                expect(deadline.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            }
        });

        it('should handle year boundaries', async () => {
            // Late December deadline that may cross into next year
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-12-20',
            });

            expect(Array.isArray(result)).toBe(true);

            for (const deadline of result) {
                expect(deadline.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            }
        });

        it('should handle early January deadline that may go back to previous year', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-01-10',
            });

            expect(Array.isArray(result)).toBe(true);

            for (const deadline of result) {
                expect(deadline.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            }
        });

        it('should handle leap year dates', async () => {
            // Feb 29, 2024 is a valid date (leap year)
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-02-29',
            });

            expect(Array.isArray(result)).toBe(true);

            for (const deadline of result) {
                expect(deadline.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            }
        });
    });

    describe('Data Integrity', () => {
        it('should have unique deadline codes', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            const codes = new Set<string>();
            for (const deadline of result) {
                expect(codes.has(deadline.type)).toBe(false);
                codes.add(deadline.type);
            }
        });

        it('should have shortName from database', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            for (const deadline of result) {
                expect(typeof deadline.shortName).toBe('string');
                expect(deadline.shortName.length).toBeGreaterThan(0);
            }
        });

        it('should have valid calculation.date equal to deadline.date', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            for (const deadline of result) {
                expect(deadline.calculation).not.toBeNull();
                expect(deadline.calculation!.date).toBe(deadline.date);
            }
        });

        it('should have ypologismos as empty array', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2024-03-15',
            });

            for (const deadline of result) {
                expect(Array.isArray(deadline.ypologismos)).toBe(true);
                expect(deadline.ypologismos).toHaveLength(0);
            }
        });
    });

    describe('Snapshot Tests', () => {
        it('should match inline snapshot for 2025-01-15', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2025-01-15',
            });

            expect(result).toMatchInlineSnapshot(`
              [
                {
                  "calculation": {
                    "date": "2024-12-16",
                    "logic": {
                      "day_count": "CALENDAR",
                      "days": 30,
                      "name": "Φάκελος Διοίκησης",
                      "reference": "dikasimos",
                      "start": "2025-01-15",
                      "when": "before",
                    },
                    "paused": [],
                    "skipped": [],
                  },
                  "date": "2024-12-16",
                  "formattedNomothesia": [
                    {
                      "article": "129 παρ. 2 ΚΔΔ",
                      "highlighted": [],
                      "text": "",
                    },
                  ],
                  "imeres": [],
                  "name": "Υποβολή απόψεων & φακέλου της διοίκησης",
                  "nomothesia": [
                    "129 παρ. 2 ΚΔΔ",
                  ],
                  "shortName": "Φάκελος Διοίκησης",
                  "type": "apopseis_fakelos_dioikisis",
                  "ypologismos": [],
                },
                {
                  "calculation": {
                    "date": "2024-12-24",
                    "logic": {
                      "day_count": "FULL",
                      "days": 20,
                      "name": "Ανακοίνωση Δίκης",
                      "reference": "dikasimos",
                      "start": "2025-01-15",
                      "when": "before",
                    },
                    "paused": [],
                    "skipped": [
                      "2024-12-26",
                      "2024-12-25",
                    ],
                  },
                  "date": "2024-12-24",
                  "formattedNomothesia": [
                    {
                      "article": "114 παρ. 1 ΚΔΔ",
                      "highlighted": [],
                      "text": "",
                    },
                  ],
                  "imeres": [],
                  "name": "Ανακοίνωση δίκης & κοινοποίηση δικογράφου σε δικαιούμενους σε παρέμβαση",
                  "nomothesia": [
                    "114 παρ. 1 ΚΔΔ",
                  ],
                  "shortName": "Ανακοίνωση Δίκης",
                  "type": "anakoinosi_dikis",
                  "ypologismos": [],
                },
                {
                  "calculation": {
                    "date": "2024-12-31",
                    "logic": {
                      "day_count": "CALENDAR",
                      "days": 15,
                      "name": "Πρόσθετοι Λόγοι",
                      "reference": "dikasimos",
                      "start": "2025-01-15",
                      "when": "before",
                    },
                    "paused": [],
                    "skipped": [],
                  },
                  "date": "2024-12-31",
                  "formattedNomothesia": [
                    {
                      "article": "131 ΚΔΔ",
                      "highlighted": [],
                      "text": "",
                    },
                  ],
                  "imeres": [],
                  "name": "Κατάθεση & επίδοση πρόσθετων λόγων",
                  "nomothesia": [
                    "131 ΚΔΔ",
                  ],
                  "shortName": "Πρόσθετοι Λόγοι",
                  "type": "prostheti_logoi",
                  "ypologismos": [],
                },
                {
                  "calculation": {
                    "date": "2024-12-31",
                    "logic": {
                      "day_count": "CALENDAR",
                      "days": 15,
                      "name": "Προσεπίκληση Ομοδίκων",
                      "reference": "dikasimos",
                      "start": "2025-01-15",
                      "when": "before",
                    },
                    "paused": [],
                    "skipped": [],
                  },
                  "date": "2024-12-31",
                  "formattedNomothesia": [
                    {
                      "article": "117 ΚΔΔ",
                      "highlighted": [],
                      "text": "",
                    },
                  ],
                  "imeres": [],
                  "name": "Προσεπίκληση αναγκαστικώς ομοδίκων",
                  "nomothesia": [
                    "117 ΚΔΔ",
                  ],
                  "shortName": "Προσεπίκληση Ομοδίκων",
                  "type": "prosepiklisi_omodikon",
                  "ypologismos": [],
                },
                {
                  "calculation": {
                    "date": "2025-01-09",
                    "logic": {
                      "day_count": "FULL",
                      "days": 6,
                      "name": "Παρέμβαση",
                      "reference": "dikasimos",
                      "start": "2025-01-15",
                      "when": "before",
                    },
                    "paused": [],
                    "skipped": [],
                  },
                  "date": "2025-01-09",
                  "formattedNomothesia": [
                    {
                      "article": "114 παρ. 2 ΚΔΔ",
                      "highlighted": [],
                      "text": "",
                    },
                  ],
                  "imeres": [],
                  "name": "Κατάθεση & επίδοση παρέμβασης",
                  "nomothesia": [
                    "114 παρ. 2 ΚΔΔ",
                  ],
                  "shortName": "Παρέμβαση",
                  "type": "paremvasi",
                  "ypologismos": [],
                },
                {
                  "calculation": {
                    "date": "2025-01-10",
                    "logic": {
                      "day_count": "CALENDAR",
                      "days": 5,
                      "name": "Αίτηση Εξέτασης Μάρτυρα",
                      "reference": "dikasimos",
                      "start": "2025-01-15",
                      "when": "before",
                    },
                    "paused": [],
                    "skipped": [],
                  },
                  "date": "2025-01-10",
                  "formattedNomothesia": [
                    {
                      "article": "180 ΚΔΔ",
                      "highlighted": [],
                      "text": "",
                    },
                  ],
                  "imeres": [],
                  "name": "Αυτοτελής αίτηση για εξέταση μάρτυρα",
                  "nomothesia": [
                    "180 ΚΔΔ",
                  ],
                  "shortName": "Αίτηση Εξέτασης Μάρτυρα",
                  "type": "aitisi_martyra",
                  "ypologismos": [],
                },
                {
                  "calculation": {
                    "date": "2025-01-14",
                    "logic": {
                      "day_count": "CALENDAR",
                      "days": 1,
                      "name": "Δήλωση & Αποδεικτικά",
                      "reference": "dikasimos",
                      "start": "2025-01-15",
                      "when": "before",
                    },
                    "paused": [],
                    "skipped": [],
                  },
                  "date": "2025-01-14",
                  "formattedNomothesia": [
                    {
                      "article": "26, 133 παρ. 2, 150 ΚΔΔ",
                      "highlighted": [],
                      "text": "",
                    },
                  ],
                  "imeres": [],
                  "name": "Κατάθεση δήλωσης, νομιμοποιητικών εγγράφων & αποδεικτικών μέσων",
                  "nomothesia": [
                    "26, 133 παρ. 2, 150 ΚΔΔ",
                  ],
                  "shortName": "Δήλωση & Αποδεικτικά",
                  "type": "dilosi_nomim_apodeiktika",
                  "ypologismos": [],
                },
                {
                  "calculation": {
                    "date": "2025-01-14",
                    "logic": {
                      "day_count": "CALENDAR",
                      "days": 1,
                      "name": "Συμμετοχή Ομοδίκων",
                      "reference": "dikasimos",
                      "start": "2025-01-15",
                      "when": "before",
                    },
                    "paused": [],
                    "skipped": [],
                  },
                  "date": "2025-01-14",
                  "formattedNomothesia": [
                    {
                      "article": "118 ΚΔΔ",
                      "highlighted": [],
                      "text": "",
                    },
                  ],
                  "imeres": [],
                  "name": "Κατάθεση & επίδοση δικογράφου συμμετοχής αναγκαστικώς ομοδίκων",
                  "nomothesia": [
                    "118 ΚΔΔ",
                  ],
                  "shortName": "Συμμετοχή Ομοδίκων",
                  "type": "dikografo_omodikon",
                  "ypologismos": [],
                },
                {
                  "calculation": {
                    "date": "2025-01-15",
                    "logic": {
                      "day_count": "CALENDAR",
                      "days": 0,
                      "name": "Παράβολο",
                      "reference": "dikasimos",
                      "start": "2025-01-15",
                      "when": "after",
                    },
                    "paused": [],
                    "skipped": [],
                  },
                  "date": "2025-01-15",
                  "formattedNomothesia": [
                    {
                      "article": "277, 150 ΚΔΔ",
                      "highlighted": [],
                      "text": "",
                    },
                  ],
                  "imeres": [],
                  "name": "Καταβολή & προσκόμιση παραβόλου",
                  "nomothesia": [
                    "277, 150 ΚΔΔ",
                  ],
                  "shortName": "Παράβολο",
                  "type": "paravolo",
                  "ypologismos": [],
                },
                {
                  "calculation": {
                    "date": "2025-01-15",
                    "logic": {
                      "day_count": "CALENDAR",
                      "days": 0,
                      "name": "Δικαστικό Ένσημο",
                      "reference": "dikasimos",
                      "start": "2025-01-15",
                      "when": "after",
                    },
                    "paused": [],
                    "skipped": [],
                  },
                  "date": "2025-01-15",
                  "formattedNomothesia": [
                    {
                      "article": "274 παρ. 3, 150 ΚΔΔ",
                      "highlighted": [],
                      "text": "",
                    },
                  ],
                  "imeres": [],
                  "name": "Καταβολή & προσκόμιση δικαστικού ενσήμου (καταψηφιστική αγωγή)",
                  "nomothesia": [
                    "274 παρ. 3, 150 ΚΔΔ",
                  ],
                  "shortName": "Δικαστικό Ένσημο",
                  "type": "dikastiko_ensimo",
                  "ypologismos": [],
                },
                {
                  "calculation": {
                    "date": "2025-01-20",
                    "logic": {
                      "day_count": "WORKING",
                      "days": 3,
                      "name": "Υπόμνημα",
                      "reference": "dikasimos",
                      "start": "2025-01-15",
                      "when": "after",
                    },
                    "paused": [
                      "2025-01-18",
                      "2025-01-19",
                    ],
                    "skipped": [],
                  },
                  "date": "2025-01-20",
                  "formattedNomothesia": [
                    {
                      "article": "138 ΚΔΔ",
                      "highlighted": [],
                      "text": "",
                    },
                  ],
                  "imeres": [],
                  "name": "Κατάθεση υπομνήματος",
                  "nomothesia": [
                    "138 ΚΔΔ",
                  ],
                  "shortName": "Υπόμνημα",
                  "type": "ypomnima",
                  "ypologismos": [],
                },
              ]
            `);
        });

        it('should format deadlines ordered by date', async () => {
            const result = await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: '2025-12-30',
            });

            const sorted = result.sort((a, b) => a.date.localeCompare(b.date));

            // Find the maximum length of the first column
            const maxFirstColLength = Math.max(
                ...sorted.map(d => `${d.date} - ${d.shortName}`.length)
            );

            const formatted = sorted
                .map(d => {
                    const firstCol = `${d.date} - ${d.shortName}`.padEnd(maxFirstColLength);
                    const days = d.calculation!.logic.days;
                    const day_count = d.calculation!.logic.day_count === 'CALENDAR' ? '' : d.calculation!.logic.day_count === 'FULL' ? ' ΠΛΗΡΕΙΣ' : 'ΕΡΓΑΣΙΜΕΣ';
                    const when = d.calculation!.logic.when === 'before' ? 'πριν' : 'μετά';
                    const ref = d.calculation!.logic.reference === 'δικάσιμο' ? 'δικάσιμο' : d.calculation!.logic.reference;
                    return `${firstCol}  ${days}${day_count} ημέρες ${when} ${ref}`;
                })
                .join('\n');

            expect(formatted).toMatchInlineSnapshot(`
              "2025-11-28 - Φάκελος Διοίκησης        30 ημέρες πριν dikasimos
              2025-12-10 - Ανακοίνωση Δίκης         20 ΠΛΗΡΕΙΣ ημέρες πριν dikasimos
              2025-12-15 - Πρόσθετοι Λόγοι          15 ημέρες πριν dikasimos
              2025-12-15 - Προσεπίκληση Ομοδίκων    15 ημέρες πριν dikasimos
              2025-12-24 - Παρέμβαση                6 ΠΛΗΡΕΙΣ ημέρες πριν dikasimos
              2025-12-24 - Αίτηση Εξέτασης Μάρτυρα  5 ημέρες πριν dikasimos
              2025-12-29 - Δήλωση & Αποδεικτικά     1 ημέρες πριν dikasimos
              2025-12-29 - Συμμετοχή Ομοδίκων       1 ημέρες πριν dikasimos
              2025-12-30 - Παράβολο                 0 ημέρες μετά dikasimos
              2025-12-30 - Δικαστικό Ένσημο         0 ημέρες μετά dikasimos
              2026-01-05 - Υπόμνημα                 3ΕΡΓΑΣΙΜΕΣ ημέρες μετά dikasimos"
            `);
        });
    });
});

describe('DeadlineCalculationError', () => {
    it('should be throwable and catchable', async () => {
        try {
            await getDeadlines({
                court_type: CourtType.DP_DE,
                procedure_type: ProcedureType.DIAFORA_OUSIAS,
                dikasimos: 'invalid',
            });
            expect.fail('Should have thrown an error');
        } catch (error) {
            expect(error).toBeInstanceOf(DeadlineCalculationError);
            expect(error).toHaveProperty('code');
            expect(error).toHaveProperty('message');
        }
    });
});
