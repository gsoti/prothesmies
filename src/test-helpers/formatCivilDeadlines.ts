import type { getCivilDeadlines } from '../deadlines-admin.js';
import { DeadlineStatus } from '../types.js';

export function formatCivilDeadlines(deadlines: Awaited<ReturnType<typeof getCivilDeadlines>>['deadlines']): string {
    const sorted = [...deadlines].sort((a, b) => {
        const left = a.date || '9999-12-31';
        const right = b.date || '9999-12-31';
        return left.localeCompare(right);
    });

    const maxFirstColLength = Math.max(
        ...sorted.map(d => `${d.date || 'PENDING'} - ${d.shortName}`.length)
    );

    return sorted
        .map(d => {
            const firstCol = `${d.date || 'PENDING'} - ${d.shortName}`.padEnd(maxFirstColLength);

            if (d.status === DeadlineStatus.PENDING) {
                return `${firstCol}  pending (${d.missingAnchor})`;
            }

            const days = d.calculation!.logic.days;
            const dayCount = d.calculation!.logic.day_count === 'CALENDAR'
                ? ''
                : d.calculation!.logic.day_count === 'FULL'
                    ? ' ΠΛΗΡΕΙΣ'
                    : ' ΕΡΓΑΣΙΜΕΣ';
            const when = d.calculation!.logic.when === 'before' ? 'πριν' : 'μετά';
            const ref = d.calculation!.logic.reference;
            const paused = d.calculation!.paused.length > 0 ? ` [paused: ${d.calculation!.paused.length}]` : '';
            const skipped = d.calculation!.skipped.length > 0 ? ` [skipped: ${d.calculation!.skipped.join(', ')}]` : '';
            return `${firstCol}  ${days}${dayCount} ημέρες ${when} ${ref}${paused}${skipped}`;
        })
        .join('\n');
}
