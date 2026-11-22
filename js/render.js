// Turns structured statements into HTML in the chosen language.
// Grammar choices avoid case endings on the (often nonsense) subject words:
// e.g. Russian uses "X севернее, чем Y" (nominative after "чем").

import { escapeHtml } from './util.js';
import { inverseRel, inverseForm } from './generators.js';

const S = (w) => `<span class="subj">${escapeHtml(w)}</span>`;
const MARK = (t) => `<span class="neg">${t}</span>`;
const PLAIN = (t) => t;

const HKEY = { '0,1': 'n', '1,1': 'ne', '1,0': 'e', '1,-1': 'se', '0,-1': 's', '-1,-1': 'sw', '-1,0': 'w', '-1,1': 'nw' };
export function dirParts(vec) {
    const h = HKEY[vec[0] + ',' + vec[1]] || null;
    const v = vec[2] > 0 ? 'up' : vec[2] < 0 ? 'down' : null;
    return { h, v };
}

export const GRAMMAR = {
    en: {
        rel: {
            same: (a, b, M) => `${a} is ${M('the same as')} ${b}`,
            opposite: (a, b, M) => `${a} is ${M('the opposite of')} ${b}`,
            more: (a, b, M) => `${a} is ${M('more')} than ${b}`,
            less: (a, b, M) => `${a} is ${M('less')} than ${b}`,
            before: (a, b, M) => `${a} is ${M('before')} ${b}`,
            after: (a, b, M) => `${a} is ${M('after')} ${b}`,
        },
        H: { n: 'north', ne: 'north-east', e: 'east', se: 'south-east', s: 'south', sw: 'south-west', w: 'west', nw: 'north-west' },
        V: { up: 'above', down: 'below' },
        phrase: (h, v, H, V) => (h && v ? `${V[v]} and ${H[h]} of` : h ? `${H[h]} of` : V[v]),
        dir: (a, b, p, t, dim, M) => `${a} ${dim === 4 ? ['was', 'is', 'will be'][t + 1] : 'is'} ${M(p)} ${b}`,
        syl: {
            A: (s, p, M) => `${M('All')} ${s} is ${p}`,
            E: (s, p, M) => `${M('No')} ${s} is ${p}`,
            I: (s, p, M) => `Some ${s} ${M('is')} ${p}`,
            O: (s, p, M) => `Some ${s} ${M('is not')} ${p}`,
        },
        meta: {
            same: (x, y, a, b, M) => `${x} is to ${y} ${M('as')} ${a} is to ${b}`,
            reverse: (x, y, a, b, M) => `${x} is to ${y} ${M('the reverse of how')} ${a} is to ${b}`,
        },
        analogy: {
            same: (a, b, c, d, M) => `The relation ${a} → ${b} is ${M('the same as')} the relation ${c} → ${d}`,
            different: (a, b, c, d, M) => `The relation ${a} → ${b} is ${M('different from')} the relation ${c} → ${d}`,
        },
        ops: { and: 'AND', or: 'OR', nand: 'NAND', nor: 'NOR', xor: 'XOR', xnor: 'XNOR' },
    },
    de: {
        rel: {
            same: (a, b, M) => `${a} ist ${M('gleich')} ${b}`,
            opposite: (a, b, M) => `${a} ist ${M('das Gegenteil von')} ${b}`,
            more: (a, b, M) => `${a} ist ${M('mehr')} als ${b}`,
            less: (a, b, M) => `${a} ist ${M('weniger')} als ${b}`,
            before: (a, b, M) => `${a} ist ${M('vor')} ${b}`,
            after: (a, b, M) => `${a} ist ${M('nach')} ${b}`,
        },
        H: { n: 'nördlich', ne: 'nordöstlich', e: 'östlich', se: 'südöstlich', s: 'südlich', sw: 'südwestlich', w: 'westlich', nw: 'nordwestlich' },
        V: { up: 'oberhalb', down: 'unterhalb' },
        phrase: (h, v, H, V) => (h && v ? `${V[v]} und ${H[h]} von` : h ? `${H[h]} von` : `${V[v]} von`),
        dir: (a, b, p, t, dim, M) => dim === 4 && t === 1
            ? `${a} wird ${M(p)} ${b} sein`
            : `${a} ${dim === 4 && t === -1 ? 'war' : 'ist'} ${M(p)} ${b}`,
        syl: {
            A: (s, p, M) => `${M('Alle')} ${s} ${M('sind')} ${p}`,
            E: (s, p, M) => `${M('Kein')} ${s} ${M('ist')} ${p}`,
            I: (s, p, M) => `Einige ${s} ${M('sind')} ${p}`,
            O: (s, p, M) => `Einige ${s} ${M('sind nicht')} ${p}`,
        },
        meta: {
            same: (x, y, a, b, M) => `${x} verhält sich zu ${y} ${M('so wie')} ${a} zu ${b}`,
            reverse: (x, y, a, b, M) => `${x} verhält sich zu ${y} ${M('umgekehrt wie')} ${a} zu ${b}`,
        },
        analogy: {
            same: (a, b, c, d, M) => `Die Beziehung ${a} → ${b} ist ${M('dieselbe wie')} die Beziehung ${c} → ${d}`,
            different: (a, b, c, d, M) => `Die Beziehung ${a} → ${b} ist ${M('eine andere als')} die Beziehung ${c} → ${d}`,
        },
        ops: { and: 'UND', or: 'ODER', nand: 'NAND', nor: 'NOR', xor: 'XOR', xnor: 'XNOR' },
    },
    fr: {
        rel: {
            same: (a, b, M) => `${a} est ${M('identique à')} ${b}`,
            opposite: (a, b, M) => `${a} est ${M("l'opposé de")} ${b}`,
            more: (a, b, M) => `${a} est ${M('plus')} que ${b}`,
            less: (a, b, M) => `${a} est ${M('moins')} que ${b}`,
            before: (a, b, M) => `${a} est ${M('avant')} ${b}`,
            after: (a, b, M) => `${a} est ${M('après')} ${b}`,
        },
        H: { n: 'au nord', ne: 'au nord-est', e: "à l'est", se: 'au sud-est', s: 'au sud', sw: 'au sud-ouest', w: "à l'ouest", nw: 'au nord-ouest' },
        V: { up: 'au-dessus', down: 'au-dessous' },
        phrase: (h, v, H, V) => (h && v ? `${V[v]} et ${H[h]} de` : h ? `${H[h]} de` : `${V[v]} de`),
        dir: (a, b, p, t, dim, M) => `${a} ${dim === 4 ? ['était', 'est', 'sera'][t + 1] : 'est'} ${M(p)} ${b}`,
        syl: {
            A: (s, p, M) => `${M('Tous les')} ${s} ${M('sont')} ${p}`,
            E: (s, p, M) => `${M('Aucun')} ${s} ${M("n'est")} ${p}`,
            I: (s, p, M) => `Certains ${s} ${M('sont')} ${p}`,
            O: (s, p, M) => `Certains ${s} ${M('ne sont pas')} ${p}`,
        },
        meta: {
            same: (x, y, a, b, M) => `${x} est à ${y} ${M('ce que')} ${a} est à ${b}`,
            reverse: (x, y, a, b, M) => `${x} est à ${y} ${M("l'inverse de ce que")} ${a} est à ${b}`,
        },
        analogy: {
            same: (a, b, c, d, M) => `La relation ${a} → ${b} est ${M('la même que')} la relation ${c} → ${d}`,
            different: (a, b, c, d, M) => `La relation ${a} → ${b} est ${M('différente de')} la relation ${c} → ${d}`,
        },
        ops: { and: 'ET', or: 'OU', nand: 'NAND', nor: 'NOR', xor: 'XOR', xnor: 'XNOR' },
    },
    it: {
        rel: {
            same: (a, b, M) => `${a} è ${M('uguale a')} ${b}`,
            opposite: (a, b, M) => `${a} è ${M("l'opposto di")} ${b}`,
            more: (a, b, M) => `${a} è ${M('più')} di ${b}`,
            less: (a, b, M) => `${a} è ${M('meno')} di ${b}`,
            before: (a, b, M) => `${a} è ${M('prima di')} ${b}`,
            after: (a, b, M) => `${a} è ${M('dopo')} ${b}`,
        },
        H: { n: 'a nord', ne: 'a nord-est', e: 'a est', se: 'a sud-est', s: 'a sud', sw: 'a sud-ovest', w: 'a ovest', nw: 'a nord-ovest' },
        V: { up: 'più in alto', down: 'più in basso' },
        phrase: (h, v, H, V) => (h && v ? `${V[v]} e ${H[h]} di` : h ? `${H[h]} di` : `${V[v]} di`),
        dir: (a, b, p, t, dim, M) => `${a} ${dim === 4 ? ['era', 'è', 'sarà'][t + 1] : 'è'} ${M(p)} ${b}`,
        syl: {
            A: (s, p, M) => `${M('Ogni')} ${s} è ${p}`,
            E: (s, p, M) => `${M('Nessun')} ${s} è ${p}`,
            I: (s, p, M) => `Qualche ${s} ${M('è')} ${p}`,
            O: (s, p, M) => `Qualche ${s} ${M('non è')} ${p}`,
        },
        meta: {
            same: (x, y, a, b, M) => `${x} sta a ${y} ${M('come')} ${a} sta a ${b}`,
            reverse: (x, y, a, b, M) => `${x} sta a ${y} ${M("all'opposto di come")} ${a} sta a ${b}`,
        },
        analogy: {
            same: (a, b, c, d, M) => `La relazione ${a} → ${b} è ${M('uguale alla')} relazione ${c} → ${d}`,
            different: (a, b, c, d, M) => `La relazione ${a} → ${b} è ${M('diversa dalla')} relazione ${c} → ${d}`,
        },
        ops: { and: 'E', or: 'O', nand: 'NAND', nor: 'NOR', xor: 'XOR', xnor: 'XNOR' },
    },
    es: {
        rel: {
            same: (a, b, M) => `${a} es ${M('igual a')} ${b}`,
            opposite: (a, b, M) => `${a} es ${M('lo opuesto a')} ${b}`,
            more: (a, b, M) => `${a} es ${M('más')} que ${b}`,
            less: (a, b, M) => `${a} es ${M('menos')} que ${b}`,
            before: (a, b, M) => `${a} es ${M('anterior a')} ${b}`,
            after: (a, b, M) => `${a} es ${M('posterior a')} ${b}`,
        },
        H: { n: 'al norte', ne: 'al noreste', e: 'al este', se: 'al sureste', s: 'al sur', sw: 'al suroeste', w: 'al oeste', nw: 'al noroeste' },
        V: { up: 'por encima', down: 'por debajo' },
        phrase: (h, v, H, V) => (h && v ? `${V[v]} y ${H[h]} de` : h ? `${H[h]} de` : `${V[v]} de`),
        dir: (a, b, p, t, dim, M) => `${a} ${dim === 4 ? ['estaba', 'está', 'estará'][t + 1] : 'está'} ${M(p)} ${b}`,
        syl: {
            A: (s, p, M) => `${M('Todo')} ${s} es ${p}`,
            E: (s, p, M) => `${M('Ningún')} ${s} es ${p}`,
            I: (s, p, M) => `Algún ${s} ${M('es')} ${p}`,
            O: (s, p, M) => `Algún ${s} ${M('no es')} ${p}`,
        },
        meta: {
            same: (x, y, a, b, M) => `${x} es a ${y} ${M('lo que')} ${a} es a ${b}`,
            reverse: (x, y, a, b, M) => `${x} es a ${y} ${M('lo contrario de lo que')} ${a} es a ${b}`,
        },
        analogy: {
            same: (a, b, c, d, M) => `La relación ${a} → ${b} es ${M('igual a')} la relación ${c} → ${d}`,
            different: (a, b, c, d, M) => `La relación ${a} → ${b} es ${M('distinta de')} la relación ${c} → ${d}`,
        },
        ops: { and: 'Y', or: 'O', nand: 'NAND', nor: 'NOR', xor: 'XOR', xnor: 'XNOR' },
    },
    ru: {
        rel: {
            same: (a, b, M) => `${a} и ${b} — ${M('одно и то же')}`,
            opposite: (a, b, M) => `${a} и ${b} — ${M('противоположности')}`,
            more: (a, b, M) => `${a} ${M('больше')}, чем ${b}`,
            less: (a, b, M) => `${a} ${M('меньше')}, чем ${b}`,
            before: (a, b, M) => `${a} ${M('раньше')}, чем ${b}`,
            after: (a, b, M) => `${a} ${M('позже')}, чем ${b}`,
        },
        H: { n: 'севернее', ne: 'северо-восточнее', e: 'восточнее', se: 'юго-восточнее', s: 'южнее', sw: 'юго-западнее', w: 'западнее', nw: 'северо-западнее' },
        V: { up: 'выше', down: 'ниже' },
        phrase: (h, v, H, V) => (h && v ? `${V[v]} и ${H[h]}` : h ? H[h] : V[v]),
        dir: (a, b, p, t, dim, M) => `${a} ${dim === 4 ? ['в прошлом ', 'сейчас ', 'в будущем '][t + 1] : ''}${M(p)}, чем ${b}`,
        syl: {
            A: (s, p, M) => `${M('Все')} ${s} — ${p}`,
            E: (s, p, M) => `${M('Ни один')} ${s} — ${M('не')} ${p}`,
            I: (s, p, M) => `Некоторые ${s} — ${M('это')} ${p}`,
            O: (s, p, M) => `Некоторые ${s} — ${M('это не')} ${p}`,
        },
        meta: {
            same: (x, y, a, b, M) => `${x} относится к ${y} ${M('так же, как')} ${a} к ${b}`,
            reverse: (x, y, a, b, M) => `${x} относится к ${y} ${M('обратно тому, как')} ${a} к ${b}`,
        },
        analogy: {
            same: (a, b, c, d, M) => `Отношение ${a} → ${b} ${M('такое же, как')} отношение ${c} → ${d}`,
            different: (a, b, c, d, M) => `Отношение ${a} → ${b} ${M('иное, чем')} отношение ${c} → ${d}`,
        },
        ops: { and: 'И', or: 'ИЛИ', nand: 'NAND', nor: 'NOR', xor: 'XOR', xnor: 'XNOR' },
    },
};

export const LANGS = Object.keys(GRAMMAR);
const G = (lang) => GRAMMAR[lang] || GRAMMAR.en;

/** Direction phrase only (e.g. "north-east of"), used by explanations. */
export function dirPhrase(vec, lang) {
    const g = G(lang);
    const { h, v } = dirParts(vec);
    return g.phrase(h, v, g.H, g.V);
}

const negateVec = (v) => [-v[0], -v[1], -v[2]];

/**
 * Render a statement. A negated statement shows the INVERSE relation with the
 * distinguishing words marked; its meaning is unchanged.
 */
export function renderStatement(st, lang) {
    const g = G(lang);
    const M = st.neg ? MARK : PLAIN;
    switch (st.kind) {
        case 'rel': {
            const shown = st.neg ? inverseRel(st.rel) : st.rel;
            return g.rel[shown](S(st.a), S(st.b), M);
        }
        case 'dir': {
            const vec = st.neg ? negateVec(st.vec) : st.vec;
            const { h, v } = dirParts(vec);
            return g.dir(S(st.a), S(st.b), g.phrase(h, v, g.H, g.V), st.t, st.dim, M);
        }
        case 'syl': {
            const form = st.neg ? inverseForm(st.form) : st.form;
            return g.syl[form](S(st.s), S(st.p), M);
        }
        case 'meta': {
            const same = st.neg ? !st.same : st.same;
            return g.meta[same ? 'same' : 'reverse'](S(st.x), S(st.y), S(st.a), S(st.b), M);
        }
        case 'analogy': {
            const same = st.neg ? !st.same : st.same;
            return g.analogy[same ? 'same' : 'different'](S(st.a), S(st.b), S(st.c), S(st.d), M);
        }
        case 'tree':
            return renderTree(st.tree, st.leaves, lang);
    }
    throw new Error('Cannot render ' + st.kind);
}

function renderTree(node, leaves, lang, depth = 0) {
    if (node.kind === 'leaf') return `<div class="leaf">${renderStatement(leaves[node.index], lang)}</div>`;
    const name = G(lang).ops[node.op];
    return `<div class="op-group depth-${depth % 3}" role="group">`
        + renderTree(node.left, leaves, lang, depth + 1)
        + `<div class="op-name" data-op="${node.op}">${name}</div>`
        + renderTree(node.right, leaves, lang, depth + 1)
        + `</div>`;
}

/** Operators used anywhere in a tree, for the legend. */
export function opsInTree(node, acc = new Set()) {
    if (node.kind === 'op') { acc.add(node.op); opsInTree(node.left, acc); opsInTree(node.right, acc); }
    return acc;
}

export const hasNegation = (q) => [...q.premises, q.conclusion].some(function check(s) {
    if (s.kind === 'tree') return s.leaves.some(check);
    return !!s.neg;
});

/** Plain-text version (for CSV export and screen-reader summaries). */
export const toText = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
