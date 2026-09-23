import { describe, expect, it } from 'vitest';
import {
    PAREMVASI_HIGHLIGHT,
    buildGeneratedAdminNomothesia,
    normalizeArticle114,
} from './generate-admin-nomothesia.mjs';

const articleBody = `«1. Πρώτη παράγραφος.». 2. «${PAREMVASI_HIGHLIGHT}» Κατά τα λοιπά εφαρμόζεται του άρθρου

126. Συνέχεια της δεύτερης παραγράφου. 3. Τρίτη παράγραφος. 4. Τέταρτη παράγραφος.`;

function validSource() {
    return {
        source: {
            codeId: 'kdiokd',
            sourceUrl: 'https://example.test/kdd',
            scrapedAt: '2026-09-21T11:45:18.965Z',
            latestModification: 'Ν. 5197/2025',
        },
        articles: [{
            articleKey: '114',
            articleNumber: 114,
            bodyText: articleBody,
        }],
    };
}

describe('administrative nomothesia generator', () => {
    it('reconstructs the four real paragraphs and ignores the Article 126 reference', () => {
        const result = normalizeArticle114(articleBody);
        const paragraphs = result.split('\n\n');

        expect(paragraphs).toHaveLength(4);
        expect(paragraphs[0]).toMatch(/^«1\./u);
        expect(paragraphs[1]).toMatch(/^2\./u);
        expect(paragraphs[2]).toMatch(/^3\./u);
        expect(paragraphs[3]).toMatch(/^4\./u);
        expect(result).toContain('άρθρου 126.');
        expect(result).not.toContain('άρθρου\n\n126.');
        expect(result).toContain(PAREMVASI_HIGHLIGHT);
    });

    it('validates the code and requires one unique Article 114 entry', () => {
        const wrongCode = validSource();
        wrongCode.source.codeId = 'kpold';
        expect(() => buildGeneratedAdminNomothesia(wrongCode, 'hash')).toThrow('source.codeId');

        const missing = validSource();
        missing.articles = [];
        expect(() => buildGeneratedAdminNomothesia(missing, 'hash')).toThrow('found 0');

        const duplicate = validSource();
        duplicate.articles.push({ ...duplicate.articles[0] });
        expect(() => buildGeneratedAdminNomothesia(duplicate, 'hash')).toThrow('found 2');
    });

    it('rejects malformed Article 114 paragraph structure', () => {
        expect(() => normalizeArticle114('1. Μόνο μία παράγραφος.')).toThrow(
            'missing sequential paragraph 2'
        );
    });
});
