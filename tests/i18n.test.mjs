// Every language has every key, with the same placeholders, and every kind of
// statement renders in every language (plain and negated) without gaps.
import assert from 'node:assert/strict';
import { STRINGS, LANGUAGE_NAMES } from '../js/i18n.js';
import { GRAMMAR, renderStatement, toText, LANGS } from '../js/render.js';
import { generateQuestion, BASE_TYPES, OPS } from '../js/generators.js';
import { createWordPool } from '../js/words.js';

const en = STRINGS.en;
const ph = (s) => (Array.isArray(s) ? `array:${s.length}` : [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(','));
assert.deepEqual(Object.keys(STRINGS).sort(), ['de', 'en', 'es', 'fr', 'it', 'ru']);
assert.deepEqual(LANGS.sort(), Object.keys(STRINGS).sort());
for (const lang of Object.keys(STRINGS)) {
    assert.ok(LANGUAGE_NAMES[lang]);
    const s = STRINGS[lang];
    for (const k of Object.keys(en)) {
        assert.ok(k in s, `${lang}: missing key ${k}`);
        assert.equal(ph(s[k]), ph(en[k]), `${lang}: placeholders differ for ${k}`);
        if (!Array.isArray(s[k])) assert.ok(s[k].trim().length > 0, `${lang}: empty ${k}`);
    }
    for (const k of Object.keys(s)) assert.ok(k in en, `${lang}: extra key ${k}`);
}

let rendered = 0;
const types = [...BASE_TYPES, 'conditional', 'belief', 'analogy', 'binary'];
for (const lang of LANGS) {
    for (const negation of [false, true]) for (const meta of [false, true]) {
        for (const type of types) {
            for (let i = 0; i < 40; i++) {
                const q = generateQuestion(type, type === 'binary' ? 6 : 4, {
                    settings: { enabled: types, negation, meta, ops: OPS, nestedDepth: i % 3 },
                    pool: createWordPool(lang, i % 2 ? 'nouns' : 'nonsense'),
                });
                for (const st of [...q.premises, q.conclusion]) {
                    const html = renderStatement(st, lang);
                    const text = toText(html);
                    assert.ok(!/undefined|null|NaN|\{|\}/.test(text), `${lang} ${type}: bad text "${text}"`);
                    if (st.neg) assert.ok(html.includes('class="neg"'), `${lang}: negated statement without marker: ${text}`);
                    else if (st.kind !== 'tree') assert.ok(!html.includes('class="neg"'), `${lang}: marker on plain statement: ${text}`);
                    rendered++;
                }
            }
        }
    }
}
// spot-check a few phrasings
const S = (txt) => toText(txt);
assert.equal(S(renderStatement({ kind: 'dir', dim: 4, vec: [1, 1, 1], t: 1, a: 'A', b: 'B' }, 'en')), 'A will be above and north-east of B');
assert.equal(S(renderStatement({ kind: 'dir', dim: 4, vec: [0, -1, 0], t: 1, a: 'A', b: 'B' }, 'de')), 'A wird südlich von B sein');
assert.equal(S(renderStatement({ kind: 'dir', dim: 2, vec: [-1, 1, 0], t: 0, a: 'A', b: 'B', neg: true }, 'it')), 'A è a sud-est di B');
assert.equal(S(renderStatement({ kind: 'rel', rel: 'more', a: 'A', b: 'B' }, 'ru')), 'A больше, чем B');
assert.equal(S(renderStatement({ kind: 'syl', form: 'A', s: 'A', p: 'B', neg: true }, 'es')), 'Ningún A es B');
// Symbol style and emoji words: every statement renders without gaps in every
// language, negation stays marked, and every symbol used has a key entry.
const { setStyle, symbolKey } = await import('../js/render.js');
let symRendered = 0;
for (const lang of LANGS) for (const words of ['emoji', 'nonsense']) for (const type of types) for (let i = 0; i < 25; i++) {
    const q = generateQuestion(type, type === 'binary' ? 6 : 4, {
        settings: { enabled: types, negation: true, meta: i % 2 === 0, ops: OPS, nestedDepth: i % 3 },
        pool: createWordPool(lang, words),
    });
    const all = [...q.premises, q.conclusion];
    const key = symbolKey(all, lang);
    for (const st of all) {
        const html = renderStatement(st, lang, 'symbols');
        const text = toText(html);
        assert.ok((st.kind === 'fact' ? text.length > 0 : text.length > 2) && !/undefined|null|NaN|\{|\}/.test(text), lang + ' ' + type + ': bad symbol text ' + text);
        assert.ok(!/<(?!\/?span|\/?div)/.test(html.replace(/&lt;/g, '')), 'unescaped < in ' + html);
        if (st.neg) assert.ok(html.includes('class="neg"'));
        symRendered++;
    }
    for (const k of key) assert.ok(toText(k.sentence).length > 3, 'empty key sentence');
}
setStyle('sentences');
assert.equal(toText(renderStatement({ kind: 'rel', rel: 'less', a: 'A', b: 'B' }, 'en', 'symbols')), 'A < B');
assert.equal(toText(renderStatement({ kind: 'syl', form: 'E', s: 'S', p: 'P' }, 'en', 'symbols')), 'S ∩ P = ∅');
assert.equal(toText(renderStatement({ kind: 'dir', dim: 4, vec: [1, 1, 1], t: -1, a: 'A', b: 'B' }, 'en', 'symbols')), 'A ▲↗ B t−');
console.log('symbols: ' + symRendered + ' statements rendered in symbol style (emoji and nonsense words)');
console.log(`i18n: ${Object.keys(en).length} keys × ${LANGS.length} languages OK; ${rendered} statements rendered`);
