import { CivilDeadlineCode, Nomothesia } from "./types";

const POST_2026_ARTICLE_SUFFIX = " (από 1.1.2026)";

function post2026Article(article: string): string {
    return `${article}${POST_2026_ARTICLE_SUFFIX}`;
}

export function getCivilFormattedNomothesiaPost2026(
    code: CivilDeadlineCode,
    opts?: { exoteriko?: boolean }
): Nomothesia[] {
    switch (code) {
        case CivilDeadlineCode.epidosi:
            return buildArticle215Text(opts?.exoteriko);

        case CivilDeadlineCode.paremvasi:
            return buildArticle238Post2026Text(opts?.exoteriko);

        case CivilDeadlineCode.protaseis:
            return buildArticle238Post2026ProtaseisText(opts?.exoteriko);

        case CivilDeadlineCode.paremvasiProsek:
            return buildArticle238Post2026ProsekText(opts?.exoteriko);

        case CivilDeadlineCode.opsigeneis:
        case CivilDeadlineCode.opsigeneisAntikrousi:
            return [];

        case CivilDeadlineCode.prosthiki:
            return buildArticle237Post2026ProsthikiText(opts?.exoteriko);

        case CivilDeadlineCode.orismos_dikasti_synthesis:
            return buildArticle237Post2026OrismosDikastiText();

        default:
            return [];
    }
}

const articles = {
    "215": {
        "2": `Αν δεν ορίζεται άλλως, η αγωγή επιδίδεται στον εναγόμενο μέσα σε προθεσμία τριάντα (30) ημερών από την κατάθεσή της. Αν η αγωγή πρέπει να επιδοθεί στο εξωτερικό, εντός του διαστήματος αυτού πρέπει να έχει επιδοθεί στον εισαγγελέα, κατά την παρ. 1 του άρθρου 134. Από την επίδοση της αγωγής μπορεί να ξεκινήσει και η διαδικασία διαμεσολάβησης, όπου προβλέπεται υποχρεωτική αρχική συνεδρία διαμεσολάβησης. Αν η αγωγή δεν επιδοθεί νομίμως μέσα στην προθεσμία αυτή, θεωρείται ως μη ασκηθείσα.`,
    },
    "237": {
        "2": `Η προσθήκη-αντίκρουση κατατίθεται εντός των επόμενων δεκαπέντε (15) ημερών από τη λήξη της προθεσμίας κατάθεσης των προτάσεων. Στην ίδια προθεσμία κατατίθεται και το δικαστικό ένσημο. Εντός των επόμενων δέκα (10) ημερών από την τελευταία αυτή προθεσμία ορίζεται ο δικαστής ή, επί πολυμελούς δικαστηρίου, η σύνθεση και ο εισηγητής για την εκδίκαση της διαφοράς.`,
    },
    "238": {
        "1": `Παρεμπίπτουσες αγωγές, ανταγωγές, παρεμβάσεις, προσεπικλήσεις και ανακοινώσεις στην περίπτωση του άρθρου 237 κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία σαράντα (40) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Παρεμβάσεις μετά από προσεπίκληση ή ανακοίνωση κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία εβδομήντα (70) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Αν ο αρχικός εναγόμενος ή κάποιος από τους ομοδίκους του διαμένει στο εξωτερικό ή είναι άγνωστης διαμονής, οι ως άνω προθεσμίες παρατείνονται σε εβδομήντα (70) και εκατό (100) ημέρες, αντίστοιχα, από το πέρας της προθεσμίας επίδοσης της αγωγής. Η κατάθεση των προτάσεων γίνεται σε προθεσμία εκατό (100) ημερών και στην περίπτωση του προηγούμενου εδαφίου σε προθεσμία εκατόν εξήντα (160) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Για την προσθήκη ισχύει η παρ. 2 του άρθρου 237.`,
    },
};

function buildArticle215Text(exoteriko?: boolean): Nomothesia[] {    
    const highlightedDefault = `Αν δεν ορίζεται άλλως, η αγωγή επιδίδεται στον εναγόμενο μέσα σε προθεσμία τριάντα (30) ημερών από την κατάθεσή της.`;
    const highlightedExoteriko = `Αν δεν ορίζεται άλλως, η αγωγή επιδίδεται στον εναγόμενο μέσα σε προθεσμία τριάντα (30) ημερών από την κατάθεσή της. Αν η αγωγή πρέπει να επιδοθεί στο εξωτερικό, εντός του διαστήματος αυτού πρέπει να έχει επιδοθεί στον εισαγγελέα, κατά την παρ. 1 του άρθρου 134.`;
    return [{
        article: post2026Article("Άρθρο 215 §2 ΚΠολΔ"),
        text: articles["215"]["2"],
        highlighted: [exoteriko ? highlightedExoteriko : highlightedDefault],
    }];
}

function buildArticle238Post2026Text(exoteriko?: boolean): Nomothesia[] {
    const highlightedDefault = `Παρεμπίπτουσες αγωγές, ανταγωγές, παρεμβάσεις, προσεπικλήσεις και ανακοινώσεις στην περίπτωση του άρθρου 237 κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία σαράντα (40) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής`;
    const highlightedExoteriko = `Παρεμπίπτουσες αγωγές, ανταγωγές, παρεμβάσεις, προσεπικλήσεις και ανακοινώσεις στην περίπτωση του άρθρου 237 κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία σαράντα (40) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Αν ο αρχικός εναγόμενος ή κάποιος από τους ομοδίκους του διαμένει στο εξωτερικό ή είναι άγνωστης διαμονής, οι ως άνω προθεσμίες παρατείνονται σε εβδομήντα (70) και εκατό (100) ημέρες, αντίστοιχα, από το πέρας της προθεσμίας επίδοσης της αγωγής`;
    return [{
        article: post2026Article("Άρθρο 238 §1 ΚΠολΔ"),
        text: articles["238"]["1"],
        highlighted: exoteriko ? [highlightedExoteriko] : [highlightedDefault],
    }];
}

function buildArticle238Post2026ProsekText(exoteriko?: boolean): Nomothesia[] {
    const highlightedDefault = `Παρεμβάσεις μετά από προσεπίκληση ή ανακοίνωση κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία εβδομήντα (70) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής`;
    const highlightedExoteriko = `Παρεμβάσεις μετά από προσεπίκληση ή ανακοίνωση κατατίθενται και επιδίδονται σε όλους τους διαδίκους μέσα σε προθεσμία εβδομήντα (70) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής. Αν ο αρχικός εναγόμενος ή κάποιος από τους ομοδίκους του διαμένει στο εξωτερικό ή είναι άγνωστης διαμονής, οι ως άνω προθεσμίες παρατείνονται σε εβδομήντα (70) και εκατό (100) ημέρες, αντίστοιχα, από το πέρας της προθεσμίας επίδοσης της αγωγής`;
    return [{
        article: post2026Article("Άρθρο 238 §1 ΚΠολΔ"),
        text: articles["238"]["1"],
        highlighted: exoteriko ? [highlightedExoteriko] : [highlightedDefault],
    }];
}

function buildArticle238Post2026ProtaseisText(exoteriko?: boolean): Nomothesia[] {
    const highlightedDefault = [
        "Η κατάθεση των προτάσεων γίνεται σε προθεσμία εκατό (100) ημερών",
        "από το πέρας της προθεσμίας επίδοσης της αγωγής",
    ];
    const highlightedExoteriko = [
        "Η κατάθεση των προτάσεων γίνεται",
        "και στην περίπτωση του προηγούμενου εδαφίου σε προθεσμία εκατόν εξήντα (160) ημερών από το πέρας της προθεσμίας επίδοσης της αγωγής",
    ];
    return [{
        article: post2026Article("Άρθρο 238 §1 ΚΠολΔ"),
        text: articles["238"]["1"],
        highlighted: exoteriko ? highlightedExoteriko : highlightedDefault,
    }];
}

function buildArticle237Post2026ProsthikiText(exoteriko?: boolean): Nomothesia[] {
    const highlightedDefault = [
        "Η προσθήκη-αντίκρουση κατατίθεται εντός των επόμενων δεκαπέντε (15) ημερών από τη λήξη της προθεσμίας κατάθεσης των προτάσεων",
        "Στην ίδια προθεσμία κατατίθεται και το δικαστικό ένσημο",
    ];
    const highlightedExoteriko = [
        "Η προσθήκη-αντίκρουση κατατίθεται εντός των επόμενων δεκαπέντε (15) ημερών από τη λήξη της προθεσμίας κατάθεσης των προτάσεων",
        "Στην ίδια προθεσμία κατατίθεται και το δικαστικό ένσημο",
    ];
    return [{
        article: post2026Article("Άρθρο 237 §2 ΚΠολΔ"),
        text: articles["237"]["2"],
        highlighted: exoteriko ? highlightedExoteriko : highlightedDefault,
    }];
}

function buildArticle237Post2026OrismosDikastiText(): Nomothesia[] {
    return [{
        article: post2026Article("Άρθρο 237 §2 ΚΠολΔ"),
        text: articles["237"]["2"],
        highlighted: [
            "Εντός των επόμενων δέκα (10) ημερών από την τελευταία αυτή προθεσμία ορίζεται ο δικαστής ή, επί πολυμελούς δικαστηρίου, η σύνθεση και ο εισηγητής για την εκδίκαση της διαφοράς",
        ],
    }];
}
