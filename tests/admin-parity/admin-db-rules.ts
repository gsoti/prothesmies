import { createHash } from 'node:crypto';
import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';
import { DeadlineRule } from '../../src/types.js';

dotenv.config();

const EXPECTED_RULE_FINGERPRINT = 'e63925019e4c0857f769a3b4226997828209dd70a2233ad79eab9b0030403ef2';

export async function loadAdminDbRules(): Promise<DeadlineRule[]> {
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
        throw new Error('Administrative parity requires POSTGRES_URL or DATABASE_URL');
    }

    const result = await sql.query(`
        SELECT court_type, procedure_type, deadline_name, short_name, deadline_code,
               days, day_count, reference_point, direction, legislation,
               notification_days, parent_deadline_code, notes
        FROM "prothesmies-admin"
        WHERE court_type = 'DP/DE'
          AND procedure_type = 'DIAFORA_OUSIAS'
          AND active = TRUE
        ORDER BY deadline_code
    `);
    const rules = result.rows.map(row => ({
        ...row,
        days: Number(row.days),
        notification_days: row.notification_days === null ? null : Number(row.notification_days),
    })) as DeadlineRule[];
    const fingerprint = createHash('sha256').update(JSON.stringify(rules)).digest('hex');

    if (fingerprint !== EXPECTED_RULE_FINGERPRINT) {
        throw new Error(
            `Administrative reference rules changed: expected ${EXPECTED_RULE_FINGERPRINT}, received ${fingerprint}`
        );
    }
    return rules;
}
