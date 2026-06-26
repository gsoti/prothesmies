import { CivilDeadlineCode, Nomothesia } from "./types.js";
import { getCivilFormattedNomothesiaPost2026, getCivilNomothesiaPost2026 } from "./nomothesia-civil-post2026.js";
import { getCivilFormattedNomothesiaPre2026, getCivilNomothesiaPre2026 } from "./nomothesia-civil-pre2026.js";

export function getCivilNomothesia(
    code: CivilDeadlineCode,
    opts?: { isPost2026?: boolean; variant?: "taktiki" | "mikrodiafores" | "eidikes" }
): string[] | null {
    if (opts?.isPost2026) {
        return getCivilNomothesiaPost2026(code, { variant: opts?.variant });
    }
    return getCivilNomothesiaPre2026(code, { variant: opts?.variant });
}

export function getCivilFormattedNomothesia(
    code: CivilDeadlineCode,
    opts?: { exoteriko?: boolean; isPost2026?: boolean; variant?: "taktiki" | "mikrodiafores" | "eidikes" }
): Nomothesia[] {
    if (opts?.isPost2026) {
        return getCivilFormattedNomothesiaPost2026(code, { 
            exoteriko: opts?.exoteriko, 
            variant: opts?.variant 
        });
    }

    return getCivilFormattedNomothesiaPre2026(code, {
        exoteriko: opts?.exoteriko,
        variant: opts?.variant,
    });
}
