// Independent solvers: each recomputes the answer from the PREMISES ONLY and
// compares it with the generator's isValid. Run: node tests/generators.test.mjs
import assert from 'node:assert/strict';
import { generateQuestion, BASE_TYPES, OPS, evalOp } from '../js/generators.js';
import { createWordPool } from '../js/words.js';

const N = +process.env.N || 400;
const allEnabled = [...BASE_TYPES, 'analogy', 'binary'];
const ctxFor = (extra = {}) => ({
    settings: { enabled: allEnabled, negation: true, meta: false, ops: OPS, nestedDepth: 0, ...extra },
    pool: createWordPool('en', 'nonsense'),
});

// ---- linear & distinction: derive pair relations by propagation ----
function solveRelations(premises, symmetric) {
    // known: Map "x|y" -> rel ('up'/'down' for linear, 'same'/'opposite' for distinction)
    const known = new Map();
    const set = (x, y, r) => {
        const inv = symmetric ? r : (r === 'up' ? 'down' : 'up');
        if (known.get(x + '|' + y) === undefined) { known.set(x + '|' + y, r); known.set(y + '|' + x, inv); return true; }
        assert.equal(known.get(x + '|' + y), r, 'contradiction in premises');
        return false;
    };
    const norm = (rel) => ({ more: 'up', after: 'up', less: 'down', before: 'down', same: 'same', opposite: 'opposite' }[rel]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const p of premises) {
            if (p.kind === 'rel') changed = set(p.a, p.b, norm(p.rel)) || changed;
            if (p.kind === 'meta') {
                const r = known.get(p.a + '|' + p.b);
                if (r) {
                    const flip = symmetric ? (r === 'same' ? 'opposite' : 'same') : (r === 'up' ? 'down' : 'up');
                    changed = set(p.x, p.y, p.same ? r : flip) || changed;
                }
            }
        }
        // transitivity
        const keys = [...known.keys()];
        for (const k1 of keys) for (const k2 of keys) {
            const [a, b] = k1.split('|'); const [b2, c] = k2.split('|');
            if (b !== b2 || a === c) continue;
            const r1 = known.get(k1), r2 = known.get(k2);
            let r;
            if (symmetric) r = r1 === r2 ? 'same' : 'opposite';
            else if (r1 === r2) r = r1; else continue;
            changed = set(a, c, r) || changed;
        }
    }
    return known;
}

function truthOf(stmt, q) {
    if (stmt.kind === 'rel') {
        const symmetric = stmt.rel === 'same' || stmt.rel === 'opposite';
        const known = solveRelations(q.premises, symmetric);
        const r = known.get(stmt.a + '|' + stmt.b);
        assert.ok(r, 'relation not derivable from premises');
        const norm = { more: 'up', after: 'up', less: 'down', before: 'down', same: 'same', opposite: 'opposite' }[stmt.rel];
        return r === norm;
    }
    if (stmt.kind === 'dir') {
        const pos = solveCoords(q.premises);
        const a = pos.get(stmt.a), b = pos.get(stmt.b);
        const s = (v) => Math.sign(v);
        const vecOk = [0, 1, 2].every(i => s(a[i] - b[i]) === stmt.vec[i]);
        const tOk = stmt.dim < 4 || s(a[3] - b[3]) === stmt.t;
        return vecOk && tOk;
    }
    if (stmt.kind === 'syl') return syllogismEntails(q.premises, stmt);
    throw new Error('no solver for ' + stmt.kind);
}

function solveCoords(premises) {
    const pos = new Map([[premises[0].b, [0, 0, 0, 0]]]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const p of premises) {
            const t = p.t || 0;
            if (pos.has(p.b) && !pos.has(p.a)) { const c = pos.get(p.b); pos.set(p.a, [c[0] + p.vec[0], c[1] + p.vec[1], c[2] + p.vec[2], c[3] + t]); changed = true; }
            if (pos.has(p.a) && !pos.has(p.b)) { const c = pos.get(p.a); pos.set(p.b, [c[0] - p.vec[0], c[1] - p.vec[1], c[2] - p.vec[2], c[3] - t]); changed = true; }
        }
    }
    return pos;
}

// ---- syllogisms: brute force over all Venn models, every term non-empty ----
function syllogismEntails(premises, conclusion) {
    const terms = [...new Set(premises.flatMap(p => [p.s, p.p]))];
    assert.ok(terms.includes(conclusion.s) && terms.includes(conclusion.p));
    const k = terms.length, regions = 1 << k;
    const idx = Object.fromEntries(terms.map((t, i) => [t, i]));
    const holds = (st, model) => {
        const S = idx[st.s], P = idx[st.p];
        let sp = false, snp = false;
        for (let r = 0; r < regions; r++) {
            if (!(model >> r & 1)) continue;
            const inS = r >> S & 1, inP = r >> P & 1;
            if (inS && inP) sp = true;
            if (inS && !inP) snp = true;
        }
        return { A: !snp, E: !sp, I: sp, O: snp }[st.form];
    };
    for (let model = 0; model < 2 ** regions; model++) {
        let ok = true;
        for (let t = 0; t < k && ok; t++) { // existential import: every term inhabited
            let inhabited = false;
            for (let r = 0; r < regions; r++) if ((model >> r & 1) && (r >> t & 1)) { inhabited = true; break; }
            ok = inhabited;
        }
        if (!ok) continue;
        if (premises.every(p => holds(p, model)) && !holds(conclusion, model)) return false;
    }
    return true;
}

// ---- analogy ----
function relKey(q, x, y) {
    const base = q.model.base;
    if (base.kind === 'space') {
        const pos = solveCoords(q.premises);
        const a = pos.get(x), b = pos.get(y);
        const v = [0, 1, 2].map(i => Math.sign(a[i] - b[i]));
        return v.join(',') + '|' + (base.dim === 4 ? Math.sign(a[3] - b[3]) : 0);
    }
    const symmetric = base.kind === 'groups';
    return solveRelations(q.premises, symmetric).get(x + '|' + y);
}

// ---- checks ----
let checked = 0;
const ratio = {};
function check(type, level, extra) {
    const q = generateQuestion(type, level, ctxFor(extra));
    let truth;
    if (type === 'analogy') {
        const [a, b, c, d] = [q.conclusion.a, q.conclusion.b, q.conclusion.c, q.conclusion.d];
        assert.equal(new Set([a, b, c, d]).size, 4);
        const same = relKey(q, a, b) === relKey(q, c, d);
        truth = q.conclusion.same === same;
    } else if (type === 'binary') {
        const parts = q.model.parts.map(p => {
            const sub = { premises: q.premises.filter(s => belongs(s, p)), conclusion: p.conclusion, model: p.model };
            return truthOf(p.conclusion, sub);
        });
        // parts must not share words
        const wordSets = q.model.parts.map(p => new Set(q.premises.filter(s => belongs(s, p)).flatMap(words)));
        for (let i = 0; i < wordSets.length; i++) for (let j = i + 1; j < wordSets.length; j++)
            for (const w of wordSets[i]) assert.ok(!wordSets[j].has(w), 'binary parts share a word');
        const ev = (node) => node.kind === 'leaf' ? parts[node.index] : evalOp(node.op, ev(node.left), ev(node.right));
        truth = ev(q.conclusion.tree);
    } else {
        truth = truthOf(q.conclusion, q);
        // conclusion never restates a premise pair
        const cw = words(q.conclusion).sort().join('|');
        if (type !== 'syllogism') for (const p of q.premises) assert.notEqual(words(p).slice(0, 2).sort().join('|'), cw);
    }
    assert.equal(truth, q.isValid, `${type} L${level}: solver says ${truth}, generator says ${q.isValid}`);
    assert.equal(q.premises.length, level, `${type}: expected ${level} premises, got ${q.premises.length}`);
    ratio[type] = ratio[type] || [0, 0];
    ratio[type][0] += q.isValid ? 1 : 0; ratio[type][1]++;
    checked++;
    return q;
}

const words = (s) => s.kind === 'syl' ? [s.s, s.p] : s.kind === 'meta' ? [s.x, s.y, s.a, s.b] : [s.a, s.b];
function belongs(stmt, part) {
    const ws = new Set(collectWords(part.model));
    return words(stmt).every(w => ws.has(w));
}
function collectWords(m) {
    if (m.kind === 'linear') return m.order;
    if (m.kind === 'groups') return [...m.groups[0], ...m.groups[1]];
    if (m.kind === 'space') return m.words;
    if (m.kind === 'syllogism') return null;
    return [];
}

for (const type of ['distinction', 'comparison', 'temporal', 'direction', 'direction3D', 'direction4D']) {
    for (let i = 0; i < N; i++) check(type, 2 + (i % 9));
    for (let i = 0; i < N / 4; i++) check(type, 2 + (i % 9), { negation: false });
}
for (const type of ['distinction', 'comparison', 'temporal']) for (let i = 0; i < N / 2; i++) check(type, 2 + (i % 9), { meta: true });
for (let i = 0; i < N; i++) check('syllogism', 2);
for (let i = 0; i < N / 4; i++) check('syllogism', 3);
for (let i = 0; i < N; i++) check('analogy', 3 + (i % 6));
for (let i = 0; i < N / 2; i++) check('analogy', 3 + (i % 6), { meta: true });

// Binary: restrict to non-syllogism bases so the part-membership helper above is exact.
const nonSyl = BASE_TYPES.filter(t => t !== 'syllogism');
for (let d = 0; d <= 3; d++) for (let i = 0; i < N / 2; i++) check('binary', 4 + (i % 8), { enabled: nonSyl, nestedDepth: d });

// Premises are shuffled: for comparison, chain order should be rare.
let chainOrdered = 0;
for (let i = 0; i < 300; i++) {
    const q = generateQuestion('comparison', 5, ctxFor({ negation: false }));
    const order = q.model.order;
    const inChain = q.premises.every((p, k) => {
        const ws = [p.a, p.b];
        return ws.includes(order[k]) && ws.includes(order[k + 1]);
    });
    if (inChain) chainOrdered++;
}
assert.ok(chainOrdered < 10, `premises look unshuffled (${chainOrdered}/300 in chain order)`);

// Balanced answers
for (const [t, [v, n]] of Object.entries(ratio)) {
    const r = v / n;
    assert.ok(r > 0.38 && r < 0.62, `${t}: TRUE ratio ${r.toFixed(2)} is unbalanced`);
}

// Syllogism with binary (word separation) – just make sure it generates without errors.
for (let i = 0; i < 200; i++) generateQuestion('binary', 4 + (i % 6), ctxFor({ nestedDepth: i % 4 }));

// Premise order: "ordered" gives a connected sequence (each premise shares a
// word with an earlier one); partial modes keep answers correct and scramble.
const connected = (premises) => premises.every((p, i) => i === 0 || premises.slice(0, i).some(q => words(q).some(w => words(p).includes(w))));
for (const type of ['distinction', 'comparison', 'temporal', 'syllogism', 'direction', 'direction3D', 'direction4D', 'analogy']) {
    for (let i = 0; i < 150; i++) {
        const q = generateQuestion(type, type === 'analogy' ? 3 + (i % 6) : 2 + (i % 9), ctxFor({ premiseOrder: 'ordered', meta: i % 2 === 0 }));
        assert.ok(connected(q.premises), `${type}: ordered premises are not connected`);
    }
}
for (const order of ['p50', 'p80']) for (const type of ['distinction', 'comparison', 'direction']) for (let i = 0; i < 100; i++) check(type, 3 + (i % 7), { premiseOrder: order });
let disconnected = 0;
for (let i = 0; i < 300; i++) if (!connected(generateQuestion('comparison', 6, ctxFor({ premiseOrder: 'p80' })).premises)) disconnected++;
assert.ok(disconnected > 60, `80% scrambling barely changes the order (${disconnected}/300 disconnected)`);

// The guide's hand-written worked examples must be correct too.
const { KINDS } = await import('../js/guide.js');
const SYM = ['same', 'opposite'];
let guideChecked = 0;
for (const kind of KINDS) for (const ex of kind.examples) {
    let truth;
    const c = ex.conclusion;
    if (c.kind === 'analogy') truth = c.same === (relKey(ex, c.a, c.b) === relKey(ex, c.c, c.d));
    else if (c.kind === 'tree') {
        const leaf = (st) => truthOf(st, { premises: ex.premises.filter(p => SYM.includes(p.rel) === SYM.includes(st.rel)) });
        const ev = (n) => n.kind === 'leaf' ? leaf(c.leaves[n.index]) : evalOp(n.op, ev(n.left), ev(n.right));
        truth = ev(c.tree);
    } else truth = truthOf(c, ex);
    assert.equal(truth, ex.isValid, 'guide example ' + kind.id + ' is wrong');
    guideChecked++;
}
console.log('guide: ' + guideChecked + ' worked examples verified');

console.log(`generators: ${checked} questions verified; TRUE ratios:`,
    Object.fromEntries(Object.entries(ratio).map(([t, [v, n]]) => [t, +(v / n).toFixed(2)])), `chain-ordered: ${chainOrdered}/300`);
