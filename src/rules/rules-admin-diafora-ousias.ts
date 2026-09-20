import {
    AdminDeadlineCode,
    CourtType,
    DayCount,
    DeadlineRule,
    Direction,
    ProcedureType,
    ReferencePoint,
} from '../types.js';

const rootRule = (
    rule: Omit<DeadlineRule, 'court_type' | 'procedure_type' | 'parent_deadline_code'>
): DeadlineRule => ({
    court_type: CourtType.DP_DE,
    procedure_type: ProcedureType.DIAFORA_OUSIAS,
    parent_deadline_code: null,
    ...rule,
});

/** Active DP/DE difference-of-substance rules, in stable public output order. */
export const ADMIN_DIAFORA_OUSIAS_RULES: readonly DeadlineRule[] = [
    rootRule({
        deadline_name: 'Υποβολή απόψεων & φακέλου της διοίκησης', short_name: 'Φάκελος Διοίκησης',
        deadline_code: AdminDeadlineCode.apopseis_fakelos_dioikisis, days: 30,
        day_count: DayCount.CALENDAR, reference_point: ReferencePoint.DIKASIMOS,
        direction: Direction.BEFORE, legislation: '129 παρ. 2 ΚΔΔ', notification_days: 5,
        notes: '8 ημέρες σε περίπτωση σύντμησης (άρ. 128, 129 παρ. 2 ΚΔΔ)',
    }),
    rootRule({
        deadline_name: 'Ανακοίνωση δίκης & κοινοποίηση δικογράφου σε δικαιούμενους σε παρέμβαση', short_name: 'Ανακοίνωση Δίκης',
        deadline_code: AdminDeadlineCode.anakoinosi_dikis, days: 20,
        day_count: DayCount.FULL, reference_point: ReferencePoint.DIKASIMOS,
        direction: Direction.BEFORE, legislation: '114 παρ. 1 ΚΔΔ', notification_days: 3, notes: null,
    }),
    rootRule({
        deadline_name: 'Κατάθεση & επίδοση πρόσθετων λόγων', short_name: 'Πρόσθετοι Λόγοι',
        deadline_code: AdminDeadlineCode.prostheti_logoi, days: 15,
        day_count: DayCount.CALENDAR, reference_point: ReferencePoint.DIKASIMOS,
        direction: Direction.BEFORE, legislation: '131 παρ. 1 ΚΔΔ', notification_days: 3, notes: null,
    }),
    rootRule({
        deadline_name: 'Προσεπίκληση αναγκαστικώς ομοδίκων', short_name: 'Προσεπίκληση Ομοδίκων',
        deadline_code: AdminDeadlineCode.prosepiklisi_omodikon, days: 15,
        day_count: DayCount.CALENDAR, reference_point: ReferencePoint.DIKASIMOS,
        direction: Direction.BEFORE, legislation: '117 ΚΔΔ', notification_days: 3, notes: null,
    }),
    rootRule({
        deadline_name: 'Κατάθεση & επίδοση παρέμβασης', short_name: 'Παρέμβαση',
        deadline_code: AdminDeadlineCode.paremvasi, days: 6,
        day_count: DayCount.FULL, reference_point: ReferencePoint.DIKASIMOS,
        direction: Direction.BEFORE, legislation: '114 παρ. 2 ΚΔΔ', notification_days: 3, notes: null,
    }),
    rootRule({
        deadline_name: 'Αυτοτελής αίτηση για εξέταση μάρτυρα', short_name: 'Αίτηση Εξέτασης Μάρτυρα',
        deadline_code: AdminDeadlineCode.aitisi_martyra, days: 5,
        day_count: DayCount.CALENDAR, reference_point: ReferencePoint.DIKASIMOS,
        direction: Direction.BEFORE, legislation: '180 παρ. 1 ΚΔΔ', notification_days: 1, notes: null,
    }),
    rootRule({
        deadline_name: 'Κατάθεση δήλωσης, νομιμοποιητικών εγγράφων & αποδεικτικών μέσων', short_name: 'Δήλωση & Αποδεικτικά',
        deadline_code: AdminDeadlineCode.dilosi_nomim_apodeiktika, days: 1,
        day_count: DayCount.CALENDAR, reference_point: ReferencePoint.DIKASIMOS,
        direction: Direction.BEFORE, legislation: '26, 133 παρ. 2, 150 ΚΔΔ', notification_days: 3, notes: null,
    }),
    rootRule({
        deadline_name: 'Κατάθεση & επίδοση δικογράφου συμμετοχής αναγκαστικώς ομοδίκων', short_name: 'Συμμετοχή Ομοδίκων',
        deadline_code: AdminDeadlineCode.dikografo_omodikon, days: 1,
        day_count: DayCount.CALENDAR, reference_point: ReferencePoint.DIKASIMOS,
        direction: Direction.BEFORE, legislation: '118 ΚΔΔ', notification_days: 3, notes: null,
    }),
    rootRule({
        deadline_name: 'Καταβολή & προσκόμιση παραβόλου', short_name: 'Παράβολο',
        deadline_code: AdminDeadlineCode.paravolo, days: 0,
        day_count: DayCount.CALENDAR, reference_point: ReferencePoint.DIKASIMOS,
        direction: Direction.UNTIL, legislation: '277, 150 ΚΔΔ', notification_days: 1,
        notes: 'Φορολογικές: 1/3 στην κατάθεση, 2/3 έως πρώτη συζήτηση',
    }),
    rootRule({
        deadline_name: 'Καταβολή & προσκόμιση δικαστικού ενσήμου (καταψηφιστική αγωγή)', short_name: 'Δικαστικό Ένσημο',
        deadline_code: AdminDeadlineCode.dikastiko_ensimo, days: 0,
        day_count: DayCount.CALENDAR, reference_point: ReferencePoint.DIKASIMOS,
        direction: Direction.UNTIL, legislation: '274 παρ. 3, 150 ΚΔΔ', notification_days: 1,
        notes: 'Μόνο για καταψηφιστική αγωγή/κύρια παρέμβαση',
    }),
    rootRule({
        deadline_name: 'Κατάθεση υπομνήματος', short_name: 'Υπόμνημα',
        deadline_code: AdminDeadlineCode.ypomnima, days: 3,
        day_count: DayCount.WORKING, reference_point: ReferencePoint.DIKASIMOS,
        direction: Direction.AFTER, legislation: '138 παρ. 1 ΚΔΔ', notification_days: 1, notes: null,
    }),
    {
        court_type: CourtType.DP_DE, procedure_type: ProcedureType.DIAFORA_OUSIAS,
        deadline_name: 'Κατάθεση υπομνήματος αντίκρουσης', short_name: 'Υπόμνημα Αντίκρουσης',
        deadline_code: AdminDeadlineCode.ypomnima_antikrousis, days: 3,
        day_count: DayCount.WORKING, reference_point: ReferencePoint.LIXI_YPOMNIMATOS,
        direction: Direction.AFTER, legislation: '138 παρ. 1 ΚΔΔ', notification_days: 1,
        parent_deadline_code: AdminDeadlineCode.ypomnima, notes: 'Αλυσιδωτή προθεσμία',
    },
];
