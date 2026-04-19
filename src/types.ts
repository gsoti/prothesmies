// Database-driven deadline codes
export enum DeadlineCode {
    apopseis_fakelos_dioikisis = "apopseis_fakelos_dioikisis",
    anakoinosi_dikis = "anakoinosi_dikis",
    prostheti_logoi = "prostheti_logoi",
    prosepiklisi_omodikon = "prosepiklisi_omodikon",
    fakelos_symvivastikou = "fakelos_symvivastikou",
    paremvasi = "paremvasi",
    aitisi_martyra = "aitisi_martyra",
    ypomnima = "ypomnima",
    ypomnima_antikrousis = "ypomnima_antikrousis",
    dikografo_omodikon = "dikografo_omodikon",
    dilosi_nomim_apodeiktika = "dilosi_nomim_apodeiktika",
    paravolo = "paravolo",
    dikastiko_ensimo = "dikastiko_ensimo",
    dikasimos = "dikasimos"
}

export enum CivilDeadlineCode {
    epidosi = "epidosi",
    paremptiptouses_antagogi_paremvasi_prosepiklisi_anakoinosi = "paremptiptouses_antagogi_paremvasi_prosepiklisi_anakoinosi",
    paremvasi_prosepikaloumenou = "paremvasi_prosepikaloumenou",
    protaseis_kai_apodeiktika = "protaseis_kai_apodeiktika",
    prosthiki_antikrousi = "prosthiki_antikrousi",
    orismos_dikasti_synthesis = "orismos_dikasti_synthesis",
    ekdosi_diataxis_dikasti = "ekdosi_diataxis_dikasti",
    aitisi_meta_apo_aparadekto = "aitisi_meta_apo_aparadekto"
}

export enum CourtType {
    DP_DE = "DP/DE"
}

export enum ProcedureType {
    DIAFORA_OUSIAS = "DIAFORA_OUSIAS"
}

export enum DayCount {
    CALENDAR = "CALENDAR",
    FULL = "FULL",
    WORKING = "WORKING"
}

export enum ReferencePoint {
    DIKASIMOS = "DIKASIMOS",
    ORISMOS_EISIGITI = "ORISMOS_EISIGITI",
    LIXI_YPOMNIMATOS = "LIXI_YPOMNIMATOS"
}

export enum Direction {
    BEFORE = "BEFORE",
    AFTER = "AFTER",
    UNTIL = "UNTIL"
}

export enum DeadlineStatus {
    CALCULATED = "calculated",
    PENDING = "pending"
}

export enum CivilAnchorType {
    IMEROMINIA_KATATHESIS = "imerominia_katathesis",
    LIXI_EPIDOSIS_AGOGIS = "lixi_epidosis_agogis",
    LIXI_PROTASEON = "lixi_protaseon",
    LIXI_PROSTHIKIS_ANTIKROUSIS = "lixi_prosthikis_antikrousis",
    ORISMOS_DIKASTI = "orismos_dikasti",
    EKDOSI_DIATAXIS = "ekdosi_diataxis"
}

export interface DateCalculation {
    date: string;
    paused: string[];
    skipped: string[];
    logic: {
        days: number;
        day_count: DayCount;
        when: 'before' | 'after';
        reference: string;
        start: string;
        name: string;
    }
}

export interface Deadline {
    name: string;
    shortName: string;
    type: DeadlineCode | CivilDeadlineCode;
    date: string;
    nomothesia: string[];
    formattedNomothesia: Nomothesia[];
    ypologismos: string[];
    imeres: string[];
    calculation: DateCalculation | null;
    status?: DeadlineStatus;
    anchorType?: CivilAnchorType;
    missingAnchor?: CivilAnchorType;
}

export interface NomothesiaCore {
    article: string;
    text: string;
}

export interface Nomothesia extends NomothesiaCore {
    highlighted: string[];
}

// Database table row representing a deadline rule
export interface DeadlineRule {
    court_type: string;
    procedure_type: string;
    deadline_name: string;
    short_name: string;
    deadline_code: string;
    days: number;
    day_count: DayCount;
    reference_point: ReferencePoint;
    direction: Direction;
    legislation: string | null;
    notification_days: number | null;
    parent_deadline_code: string | null;
    notes: string | null;
}

// Input parameters for getDeadlines function
export interface GetDeadlinesInput {
    court_type: CourtType;
    procedure_type: ProcedureType;
    dikasimos: string; // ISO date format (YYYY-MM-DD)
    syntmisi?: boolean; // Whether deadlines are shortened
}

export interface GetCivilDeadlinesInput {
    imerominia_katathesis: string; // ISO date format (YYYY-MM-DD)
    diadikasia: string;
}

export interface CivilDeadlinesResult {
    deadlines: Deadline[];
    status: 'success' | 'not_supported';
}

export interface CivilDeadlineRule {
    deadline_name: string;
    short_name: string;
    deadline_code: CivilDeadlineCode;
    days: number;
    day_count: DayCount;
    direction: Direction;
    legislation: string;
    anchor_type: CivilAnchorType;
}
