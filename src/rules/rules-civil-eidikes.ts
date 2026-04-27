import {
    CivilAnchorType,
    CivilDeadlineCode,
    CivilDeadlineRule,
    DayCount,
    Direction,
} from '../types.js';

export function getCivilEidikesRules(): CivilDeadlineRule[] {
    return [
        {
            deadline_name: 'Κατάθεση προσθήκης',
            short_name: 'Προσθήκη',
            deadline_code: CivilDeadlineCode.prosthiki,
            days: 5,
            day_count: DayCount.WORKING,
            direction: Direction.AFTER,
            legislation: 'ΚΠολΔ 591 παρ. 1 περ. στ΄ Οι διάδικοι μπορούν έως τη δωδέκατη ώρα της πέμπτης εργάσιμης ημέρας από τη συζήτηση να καταθέσουν προσθήκη στις προτάσεις τους, με την οποία αξιολογούνται οι αποδείξεις, προτείνονται ισχυρισμοί και προσκομίζονται ένορκες βεβαιώσεις, έγγραφα και γνωμοδοτήσεις κατά το άρθρο 390 μόνο για την αντίκρουση ισχυρισμών που προτάθηκαν.',
            anchor_type: CivilAnchorType.DIKASIMOS,
        },
    ];
}
