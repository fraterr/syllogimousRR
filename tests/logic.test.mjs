// Conditional and belief-bias questions, checked by brute force:
//  * conditionals: every truth assignment of every item (lamp on/off);
//  * belief bias: every Venn model (all terms non-empty), plus the real-world
//    truth of the conclusion recomputed from the taxonomy, and a balance check
//    so that believability carries no information about the answer.
import assert from 'node:assert/strict';
import { generateQuestion, OPS, condStatus } from '../js/generators.js';
import { TAXONOMY, CATEGORIES } from '../js/belief.js';
import { renderStatement, toText, LANGS } from '../js/render.js';
import { createWordPool } from '../js/words.js';

const N = +process.env.N || 400;
const ctx = (extra = {}, lang = 'en') => ({
    settings: { enabled: [], negation: false, meta: false, ops: OPS, nestedDepth: 0, premiseOrder: 'scrambled', ...extra },
    pool: createWordPool(lang, 'nonsense'),
});

// ---------- conditional ----------
function bruteStatus(premises, claim) {
    const atoms = [...new Set(premises.flatMap(p => (p.kind === 'fact' ? [p.w] : [p.a.w, p.b.w])).concat(claim.kind === 'fact' ? [claim.w] : [claim.a.w, claim.b.w]))];
    const holds = (st, v) => {
        const L = (l) => v[l.w] === l.on;
        return st.kind === 'fact' ? v[st.w] === st.on : (!L(st.a) || L(st.b));
    };
    let models = 0, claimTrue = 0;
    for (let m = 0; m < 1 << atoms.length; m++) {
        const v = Object.fromEntries(atoms.map((a, i) => [a, !!(m >> i & 1)]));
        if (!premises.every(p => holds(p, v))) continue;
        models++;
        if (holds(claim, v)) claimTrue++;
    }
    assert.ok(models > 0, 'inconsistent premises');
    return claimTrue === models ? 'valid' : claimTrue === 0 ? 'contradicted' : 'open';
}
const EXPECT = { MP: 'valid', MT: 'valid', HS: 'valid', CP: 'valid', AC: 'open', DA: 'open', CONV: 'open', INV: 'open', CONTRA: 'contradicted' };
const key = (st) => JSON.stringify(st);
const patterns = {};
let condTrue = 0, condChecked = 0;
for (let i = 0; i < N * 3; i++) {
    const level = 2 + (i % 9);
    const q = generateQuestion('conditional', level, ctx({ negation: i % 2 === 0, premiseOrder: ['ordered', 'p50', 'scrambled'][i % 3] }));
    assert.equal(q.premises.length, level, 'conditional: wrong number of premises');
    const status = bruteStatus(q.premises, q.conclusion);
    assert.equal(status, condStatus(q.premises, q.conclusion), '2-SAT and brute force disagree');
    assert.equal(status === 'valid', q.isValid, `conditional L${level} ${q.model.pattern}: brute force says ${status}`);
    assert.equal(status, EXPECT[q.model.pattern], `pattern ${q.model.pattern} should be ${EXPECT[q.model.pattern]}, is ${status}`);
    assert.ok(!q.premises.some(p => key(p) === key(q.conclusion)), 'conclusion repeats a premise');
    patterns[q.model.pattern] = (patterns[q.model.pattern] || 0) + 1;
    condTrue += q.isValid ? 1 : 0; condChecked++;
}
assert.deepEqual(Object.keys(patterns).sort(), Object.keys(EXPECT).sort(), 'some conditional pattern never appears');
assert.ok(condTrue / condChecked > 0.42 && condTrue / condChecked < 0.58, 'conditional TRUE ratio unbalanced');
// the 2-SAT checker on its own, against brute force, on random clause sets
for (let i = 0; i < 2000; i++) {
    const atoms = ['A', 'B', 'C', 'D'].slice(0, 2 + (i % 3));
    const L = () => ({ w: atoms[Math.floor(Math.random() * atoms.length)], on: Math.random() < 0.5 });
    const prem = Array.from({ length: 1 + (i % 5) }, () => (Math.random() < 0.3 ? { kind: 'fact', ...L() } : { kind: 'cond', a: L(), b: L() }));
    const claim = Math.random() < 0.5 ? { kind: 'fact', ...L() } : { kind: 'cond', a: L(), b: L() };
    let consistent = true;
    try { bruteStatus(prem, claim); } catch { consistent = false; }
    if (consistent) assert.equal(condStatus(prem, claim), bruteStatus(prem, claim), '2-SAT wrong on ' + JSON.stringify([prem, claim]));
}

// ---------- belief bias ----------
const ancestors = (c) => { const out = []; for (let x = c; x; x = TAXONOMY[x]) out.push(x); return out; };
function realWorld(form, s, p) {
    const sub = ancestors(s).includes(p), sup = ancestors(p).includes(s);
    return { A: sub, E: !(sub || sup), I: sub || sup, O: !sub }[form];
}
function vennValid(premises, conclusion) {
    const terms = [...new Set(premises.flatMap(p => [p.s, p.p]))];
    const k = terms.length, regions = 1 << k, idx = Object.fromEntries(terms.map((t, i) => [t, i]));
    const holds = (st, model) => {
        let sp = false, snp = false;
        for (let r = 0; r < regions; r++) {
            if (!(model >> r & 1)) continue;
            const inS = r >> idx[st.s] & 1, inP = r >> idx[st.p] & 1;
            if (inS && inP) sp = true;
            if (inS && !inP) snp = true;
        }
        return { A: !snp, E: !sp, I: sp, O: snp }[st.form];
    };
    for (let model = 0; model < 2 ** regions; model++) {
        let ok = true;
        for (let t = 0; t < k && ok; t++) {
            let inhabited = false;
            for (let r = 0; r < regions; r++) if ((model >> r & 1) && (r >> t & 1)) { inhabited = true; break; }
            ok = inhabited;
        }
        if (ok && premises.every(p => holds(p, model)) && !holds(conclusion, model)) return false;
    }
    return true;
}
const cells = {};
let falsePremiseValid = 0, falsePremiseAll = 0;
for (let i = 0; i < N * 2; i++) {
    const level = i % 4 === 0 ? 3 : 2;
    const q = generateQuestion('belief', level, ctx());
    assert.equal(q.premises.length, level);
    for (const st of [...q.premises, q.conclusion]) assert.ok(CATEGORIES.includes(st.s) && CATEGORIES.includes(st.p) && st.s !== st.p);
    assert.equal(vennValid(q.premises, q.conclusion), q.isValid, 'belief: Venn check disagrees');
    const believable = realWorld(q.conclusion.form, q.conclusion.s, q.conclusion.p);
    assert.equal(believable, q.model.believable, 'belief: real-world truth wrong');
    const c = (q.isValid ? 'valid' : 'invalid') + '-' + (believable ? 'believable' : 'unbelievable');
    cells[c] = (cells[c] || 0) + 1;
    if (level === 2) {
        const someFalse = q.premises.some(p => !realWorld(p.form, p.s, p.p));
        if (someFalse) { falsePremiseAll++; if (q.isValid) falsePremiseValid++; }
    }
}
for (const c of ['valid-believable', 'valid-unbelievable', 'invalid-believable', 'invalid-unbelievable'])
    assert.ok(cells[c] / (N * 2) > 0.18 && cells[c] / (N * 2) < 0.32, `belief cell ${c} unbalanced: ${cells[c]}`);
// a false premise must not give the answer away
assert.ok(falsePremiseValid / falsePremiseAll < 0.66, 'false premises predict validity too well');
// rendering spot checks
const R = (st, lang) => renderStatement(st, lang).replace(/<[^>]+>/g, '');
assert.equal(R({ kind: 'bsyl', form: 'E', s: 'sharks', p: 'mammals' }, 'it'), 'Nessuno squalo è un mammifero');
assert.equal(R({ kind: 'bsyl', form: 'E', s: 'eagles', p: 'cars' }, 'it'), 'Nessun’aquila è un’automobile');
assert.equal(R({ kind: 'bsyl', form: 'A', s: 'roses', p: 'flowers' }, 'it'), 'Tutte le rose sono fiori');
assert.equal(R({ kind: 'bsyl', form: 'A', s: 'animals', p: 'birds' }, 'fr'), 'Tous les animaux sont des oiseaux');
assert.equal(R({ kind: 'bsyl', form: 'E', s: 'bees', p: 'birds' }, 'fr'), 'Aucune abeille n’est un oiseau');
assert.equal(R({ kind: 'bsyl', form: 'O', s: 'birds', p: 'fish' }, 'es'), 'Algunas aves no son peces');
assert.equal(R({ kind: 'bsyl', form: 'E', s: 'whales', p: 'fish' }, 'ru'), 'Среди китов нет рыб');
assert.equal(R({ kind: 'bsyl', form: 'O', s: 'dogs', p: 'cats' }, 'de'), 'Einige Hunde sind keine Katzen');
assert.equal(R({ kind: 'cond', a: { w: 'A', on: true }, b: { w: 'B', on: false } }, 'de'), 'Wenn A an ist, dann ist B aus');
assert.equal(R({ kind: 'cond', a: { w: 'A', on: false }, b: { w: 'B', on: true } }, 'en'), 'If A is off, then B is on');
assert.equal(renderStatement({ kind: 'cond', a: { w: 'A', on: false }, b: { w: 'B', on: true } }, 'en', 'symbols').replace(/<[^>]+>/g, ''), '¬A → B');
for (const lang of LANGS) for (let i = 0; i < 60; i++) for (const type of ['conditional', 'belief']) {
    const q = generateQuestion(type, 2 + (i % 5), ctx({ negation: true }, lang));
    for (const st of [...q.premises, q.conclusion]) for (const style of ['sentences', 'symbols']) {
        const text = toText(renderStatement(st, lang, style));
        assert.ok(text.length > 0 && !/undefined|null|NaN|\{|\}/.test(text), `${lang} ${type}: bad text "${text}"`);
    }
}
console.log(`logic: ${condChecked} conditionals verified by truth table, patterns:`, patterns);
console.log('belief cells:', cells, `false-premise items valid: ${(falsePremiseValid / falsePremiseAll).toFixed(2)}`);
