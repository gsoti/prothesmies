/**
 * Legislation text and highlighted portions keyed by legislation article
 */

import { CivilDeadlineCode } from "./types";

type NomothesiaEntry = {
    text: string;
    highlighted: string[];
};

export function getCivilNomothesiaText(
    code: CivilDeadlineCode.epidosi, 
    dimosio?: boolean, 
    exoteriko?: boolean
): NomothesiaEntry {
    switch (code) {
        case CivilDeadlineCode.epidosi:
            return buildArticle215Text(exoteriko);
        default:
            return {
                text: '',
                highlighted: [],
            };
    }
}

function buildArticle215Text(exoteriko?: boolean): NomothesiaEntry {
    const text = `Αν δεν ορίζεται άλλως, η αγωγή επιδίδεται στον εναγόμενο μέσα σε προθεσμία τριάντα (30) ημερών από την κατάθεσή της. Αν η αγωγή πρέπει να επιδοθεί στο εξωτερικό, εντός του διαστήματος αυτού πρέπει να έχει επιδοθεί στον εισαγγελέα, κατά την παρ. 1 του άρθρου 134. Από την επίδοση της αγωγής μπορεί να ξεκινήσει και η διαδικασία διαμεσολάβησης, όπου προβλέπεται υποχρεωτική αρχική συνεδρία διαμεσολάβησης. Αν η αγωγή δεν επιδοθεί νομίμως μέσα στην προθεσμία αυτή, θεωρείται ως μη ασκηθείσα.`
    const highlighted_default = `Αν δεν ορίζεται άλλως, η αγωγή επιδίδεται στον εναγόμενο μέσα σε προθεσμία τριάντα (30) ημερών από την κατάθεσή της.`
    const highlighted_exoteriko = `Αν δεν ορίζεται άλλως, η αγωγή επιδίδεται στον εναγόμενο μέσα σε προθεσμία τριάντα (30) ημερών από την κατάθεσή της. Αν η αγωγή πρέπει να επιδοθεί στο εξωτερικό, εντός του διαστήματος αυτού πρέπει να έχει επιδοθεί στον εισαγγελέα, κατά την παρ. 1 του άρθρου 134.`

    return {
        text: text,
        highlighted: [
            exoteriko ? highlighted_exoteriko : highlighted_default
        ],
    };
}

