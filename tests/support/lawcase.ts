const LAWCASE_BASE_URL = 'https://lawcase.gr';

export const LAWCASE_TAKTIKI_ENDPOINT = `${LAWCASE_BASE_URL}/Ajax_taktikh/request`;

/**
 * Defendant residence.
 *
 * Values:
 * - "1": Ελλάδας
 * - "2": εξωτερικού
 */
export type LawcaseTaktikiKat = '1' | '2';

/**
 * Whether the party is Δημόσιο / ΝΠΔΔ.
 *
 * Values:
 * - "1": Όχι
 * - "2": Ναι
 */
export type LawcaseTaktikiDhmosio = '1' | '2';

/**
 * Subject-matter court competence.
 *
 * Values:
 * - "Eir": Ειρηνοδικείο
 * - "Mon": Μον. Πρωτοδικείο
 * - "Pol": Πολ. Πρωτοδικείο
 */
export type LawcaseTaktikiKathulhn = 'Eir' | 'Mon' | 'Pol';

/**
 * Generic yes/no radio value used by the LawCase taktiki form.
 *
 * Values:
 * - "0": Όχι
 * - "1": Ναι
 */
export type LawcaseTaktikiBooleanFlag = '0' | '1';

export interface LawcaseTaktikiRequestParams {
    /**
     * Ημερομηνία κατάθεσης.
     *
     * LawCase expects DD-MM-YYYY, for example "25-06-2026".
     */
    date: string;

    /**
     * Είδος δικογράφου.
     *
     * The taktiki page exposes this as a fixed value:
     * - "1": Αγωγή
     */
    eidos?: '1';

    /**
     * Διαδικασία.
     *
     * The taktiki page exposes this as a fixed value:
     * - "1": τακτική
     */
    diad?: '1';

    /**
     * Εναγόμενος κάτοικος.
     *
     * Values:
     * - "1": Ελλάδας
     * - "2": εξωτερικού
     */
    kat: LawcaseTaktikiKat;

    /**
     * Διάδικος Δημόσιο / ΝΠΔΔ.
     *
     * Values:
     * - "1": Όχι
     * - "2": Ναι
     */
    dhmosio: LawcaseTaktikiDhmosio;

    /**
     * Δωσιδικία.
     *
     * Numeric option id from the LawCase municipality/jurisdiction list.
     * Known examples:
     * - "0": Επιλέξτε από την λίστα
     * - "193": Αθηναίων (Κεντρικού Τομέα Αθηνών)
     * - "31": Θεσσαλονίκης (Θεσσαλονίκης)
     * - "231": Πειραιώς (Πειραιώς)
     * - "134": Πατρέων (Αχαΐας)
     */
    dwsidikia: string;

    /**
     * Καθ' ύλην αρμοδιότητα.
     *
     * Values:
     * - "Eir": Ειρηνοδικείο
     * - "Mon": Μον. Πρωτοδικείο
     * - "Pol": Πολ. Πρωτοδικείο
     */
    kathulhn: LawcaseTaktikiKathulhn;

    /**
     * Αφορά παρεμπίπτουσες αγωγές, ανταγωγές, παρεμβάσεις,
     * προσεπικλήσεις και ανακοινώσεις; (238 §1 ΚΠολΔ)
     *
     * Values:
     * - "0": Όχι
     * - "1": Ναι
     */
    agwghpar: LawcaseTaktikiBooleanFlag;

    /**
     * Είναι γνωστή η ημερομηνία δικασίμου;
     *
     * Values:
     * - "0": Όχι
     * - "1": Ναι
     */
    hmerdik: LawcaseTaktikiBooleanFlag;

    /**
     * Ημερομηνία δικασίμου.
     *
     * LawCase sends this field even when hmerdik is "0".
     * Expected format is DD-MM-YYYY, for example "25-06-2026".
     */
    hm_dikasimou: string;

    /**
     * Εφαρμογή του Ν. 4842/2021 αυτόματα όταν απαιτείται;
     *
     * Values:
     * - "1": Ναι
     * - "0": Όχι
     *
     * Note: LawCase uses the exact form key "Ν4842", where the first
     * character is Greek capital Nu (Ν), not Latin capital N.
     */
    n4842: LawcaseTaktikiBooleanFlag;

    /**
     * Αφορά προσδιορισμό με κλήση; (237 §3 ΚΠολΔ)
     *
     * Values:
     * - "0": Όχι
     * - "1": Ναι
     */
    klhsh: LawcaseTaktikiBooleanFlag;
}

export interface LawcaseClientOptions {
    /**
     * Override the LawCase endpoint, mainly for tests or captured fixtures.
     */
    endpoint?: string;

    /**
     * Custom fetch implementation. Defaults to globalThis.fetch.
     */
    fetch?: typeof fetch;
}

export interface LawcaseTaktikiResponse {
    /**
     * LawCase returns a JSON object with numeric string keys consumed directly
     * by the website. The object contains HTML snippets, calculation ids,
     * branch markers such as "before22" / "after26", and explanatory text.
     */
    data: Record<string, unknown>;
}

export function buildLawcaseTaktikiBody(params: LawcaseTaktikiRequestParams): URLSearchParams {
    return new URLSearchParams({
        date: params.date,
        eidos: params.eidos ?? '1',
        diad: params.diad ?? '1',
        kat: params.kat,
        dhmosio: params.dhmosio,
        dwsidikia: params.dwsidikia,
        kathulhn: params.kathulhn,
        agwghpar: params.agwghpar,
        hmerdik: params.hmerdik,
        hm_dikasimou: params.hm_dikasimou,
        Ν4842: params.n4842,
        klhsh: params.klhsh,
    });
}

export async function computeLawcaseTaktiki(
    params: LawcaseTaktikiRequestParams,
    options: LawcaseClientOptions = {},
): Promise<LawcaseTaktikiResponse> {
    const fetchImpl = options.fetch ?? globalThis.fetch;

    if (!fetchImpl) {
        throw new Error('No fetch implementation is available');
    }

    const response = await fetchImpl(options.endpoint ?? LAWCASE_TAKTIKI_ENDPOINT, {
        method: 'POST',
        headers: {
            Accept: 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Referer: `${LAWCASE_BASE_URL}/compute/taktikh`,
        },
        body: buildLawcaseTaktikiBody(params),
    });

    if (!response.ok) {
        throw new Error(`LawCase taktiki request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!isRecord(data)) {
        throw new Error('LawCase taktiki response was not a JSON object');
    }

    return { data };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
