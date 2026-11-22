// Turns structured statements into HTML in the chosen language.
// Grammar choices avoid case endings on the (often nonsense) subject words:
// e.g. Russian uses "X севернее, чем Y" (nominative after "чем").

import { escapeHtml } from './util.js';
import { inverseRel, inverseForm } from './generators.js';
import { renderBelief } from './belief.js';

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
        fact: (w, on) => `${w} is ${on ? 'on' : 'off'}`,
        cond: (a, ao, b, bo) => `If ${a} is ${ao ? 'on' : 'off'}, then ${b} is ${bo ? 'on' : 'off'}`,
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
        fact: (w, on) => `${w} ist ${on ? 'an' : 'aus'}`,
        cond: (a, ao, b, bo) => `Wenn ${a} ${ao ? 'an' : 'aus'} ist, dann ist ${b} ${bo ? 'an' : 'aus'}`,
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
        fact: (w, on) => `${w} est ${on ? 'allumé' : 'éteint'}`,
        cond: (a, ao, b, bo) => `Si ${a} est ${ao ? 'allumé' : 'éteint'}, alors ${b} est ${bo ? 'allumé' : 'éteint'}`,
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
        fact: (w, on) => `${w} è ${on ? 'acceso' : 'spento'}`,
        cond: (a, ao, b, bo) => `Se ${a} è ${ao ? 'acceso' : 'spento'}, allora ${b} è ${bo ? 'acceso' : 'spento'}`,
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
        fact: (w, on) => `${w} está ${on ? 'encendido' : 'apagado'}`,
        cond: (a, ao, b, bo) => `Si ${a} está ${ao ? 'encendido' : 'apagado'}, entonces ${b} está ${bo ? 'encendido' : 'apagado'}`,
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
        fact: (w, on) => `${w} ${on ? 'включён' : 'выключен'}`,
        cond: (a, ao, b, bo) => `Если ${a} ${ao ? 'включён' : 'выключен'}, то ${b} ${bo ? 'включён' : 'выключен'}`,
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

// ---------- symbol style ----------
// A language-free notation: the relation only, no sentence. A key under the
// question translates every symbol into a sentence in the chosen language.
export const SYMBOLS = {
    rel: { same: '=', opposite: '≠', more: '>', less: '<', before: '≺', after: '≻' },
    H: { n: '↑', ne: '↗', e: '→', se: '↘', s: '↓', sw: '↙', w: '←', nw: '↖' },
    V: { up: '▲', down: '▼' },
    T: ['t−', 't=', 't+'],
    ops: { and: '∧', or: '∨', nand: '⊼', nor: '⊽', xor: '⊕', xnor: '↔' },
};
const symDir = (vec) => { const { h, v } = dirParts(vec); return (v ? SYMBOLS.V[v] : '') + (h ? SYMBOLS.H[h] : ''); };

let currentStyle = 'sentences';
export const setStyle = (style) => { currentStyle = style === 'symbols' ? 'symbols' : 'sentences'; };
export const getStyle = () => currentStyle;

function renderSymbols(st, lang) {
    const M = st.neg ? MARK : PLAIN;
    switch (st.kind) {
        case 'rel': {
            const shown = st.neg ? inverseRel(st.rel) : st.rel;
            return `${S(st.a)} ${M(escapeHtml(SYMBOLS.rel[shown]))} ${S(st.b)}`;
        }
        case 'dir': {
            const vec = st.neg ? negateVec(st.vec) : st.vec;
            const time = st.dim === 4 ? ` <span class="sym-time">${SYMBOLS.T[st.t + 1]}</span>` : '';
            return `${S(st.a)} ${M(symDir(vec))} ${S(st.b)}${time}`;
        }
        case 'syl': {
            const form = st.neg ? inverseForm(st.form) : st.form;
            const s = S(st.s), p = S(st.p);
            if (form === 'A') return `${s} ${M('⊆')} ${p}`;
            if (form === 'E') return `${s} ${M('∩')} ${p} ${M('= ∅')}`;
            if (form === 'I') return `${s} ∩ ${p} ${M('≠ ∅')}`;
            return `${s} ${M('⊈')} ${p}`;
        }
        case 'meta': {
            const same = st.neg ? !st.same : st.same;
            return `${S(st.x)}:${S(st.y)} ${M(same ? '=' : '= ¬')} ${S(st.a)}:${S(st.b)}`;
        }
        case 'analogy': {
            const same = st.neg ? !st.same : st.same;
            return `${S(st.a)}:${S(st.b)} ${M(same ? '=' : '≠')} ${S(st.c)}:${S(st.d)}`;
        }
        case 'fact':
            return symLit(st.w, st.on);
        case 'cond':
            return `${symLit(st.a.w, st.a.on)} → ${symLit(st.b.w, st.b.on)}`;
        case 'bsyl':
            return renderBelief(st.form, st.s, st.p, lang);
        case 'tree':
            return renderTree(st.tree, st.leaves, lang, 0, 'symbols');
    }
    throw new Error('Cannot render ' + st.kind);
}

const symLit = (w, on) => (on ? S(w) : `¬${S(w)}`);

/** Name of a logic operator in the given style. */
export const opName = (op, lang, style = currentStyle) => (style === 'symbols' ? SYMBOLS.ops[op] : G(lang).ops[op]);

/**
 * Key to the symbols used by some statements: [{ symbol, sentence }] built from
 * placeholder letters, so the meaning is shown in the user's language.
 */
export function symbolKey(statements, lang) {
    const out = new Map();
    const add = (sample) => {
        const plain = { ...sample, neg: false };
        const symbol = renderSymbols(plain, lang);
        if (!out.has(symbol)) out.set(symbol, renderStatement(plain, lang, 'sentences'));
    };
    const visit = (st) => {
        if (st.kind === 'tree') { st.leaves.forEach(visit); return; }
        if (st.kind === 'rel') add({ kind: 'rel', rel: st.neg ? inverseRel(st.rel) : st.rel, a: 'A', b: 'B' });
        if (st.kind === 'dir') add({ kind: 'dir', dim: st.dim, vec: st.neg ? negateVec(st.vec) : st.vec, t: st.t, a: 'A', b: 'B' });
        if (st.kind === 'syl') add({ kind: 'syl', form: st.neg ? inverseForm(st.form) : st.form, s: 'S', p: 'P' });
        if (st.kind === 'meta') add({ kind: 'meta', same: st.neg ? !st.same : st.same, x: 'X', y: 'Y', a: 'A', b: 'B' });
        if (st.kind === 'analogy') add({ kind: 'analogy', same: st.neg ? !st.same : st.same, a: 'A', b: 'B', c: 'C', d: 'D' });
        if (st.kind === 'fact') add({ kind: 'fact', w: 'A', on: st.on });
        if (st.kind === 'cond') add({ kind: 'cond', a: { w: 'A', on: true }, b: { w: 'B', on: true } });
        if (st.kind === 'cond') { if (!st.a.on || !st.b.on) add({ kind: 'fact', w: 'A', on: false }); }
    };
    statements.forEach(visit);
    return [...out].map(([symbol, sentence]) => ({ symbol, sentence }));
}

/**
 * Render a statement. A negated statement shows the INVERSE relation with the
 * distinguishing words (or symbol) marked; its meaning is unchanged.
 */
export function renderStatement(st, lang, style = currentStyle) {
    if (style === 'symbols') return renderSymbols(st, lang);
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
        case 'fact':
            return g.fact(S(st.w), st.on);
        case 'cond':
            return g.cond(S(st.a.w), st.a.on, S(st.b.w), st.b.on);
        case 'bsyl':
            return renderBelief(st.form, st.s, st.p, lang);
        case 'tree':
            return renderTree(st.tree, st.leaves, lang, 0, 'sentences');
    }
    throw new Error('Cannot render ' + st.kind);
}

function renderTree(node, leaves, lang, depth, style) {
    if (node.kind === 'leaf') return `<div class="leaf">${renderStatement(leaves[node.index], lang, style)}</div>`;
    return `<div class="op-group depth-${depth % 3}" role="group">`
        + renderTree(node.left, leaves, lang, depth + 1, style)
        + `<div class="op-name" data-op="${node.op}">${opName(node.op, lang, style)}</div>`
        + renderTree(node.right, leaves, lang, depth + 1, style)
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
export const toText = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
