// Question generators.
//
// Every question is a plain, language-independent object:
//   { type, level, premises: Statement[], conclusion: Statement, isValid, model }
// Statements are structured (see the constructors below) and are turned into
// text by render.js in the user's language. `model` holds what is needed to
// explain the answer afterwards (explain.js).
//
// Design rules that fix shortcuts present in the original app:
//  * premises are always shuffled (Fisher–Yates, return value used);
//  * the conclusion is about a random pair of items that are NOT adjacent in the
//    underlying chain, so it never restates a premise and is not always
//    "first vs last";
//  * TRUE/FALSE is decided by a fair coin before the conclusion is phrased;
//  * false spatial conclusions use any wrong direction, not only the exact opposite;
//  * one word pool per question, shared by all sub-questions.

import { randInt, coin, pick, shuffle, sample, sign } from './util.js';
import { CATEGORIES, realTruth } from './belief.js';

export const BASE_TYPES = ['distinction', 'comparison', 'temporal', 'syllogism', 'direction', 'direction3D', 'direction4D'];
export const ANALOGY_BASES = ['distinction', 'comparison', 'temporal', 'direction', 'direction3D', 'direction4D'];
export const TYPES = [...BASE_TYPES, 'conditional', 'belief', 'analogy', 'binary', 'sorting'];
export const OPS = ['and', 'or', 'nand', 'nor', 'xor', 'xnor'];

export const MIN_LEVEL = {
    distinction: 2, comparison: 2, temporal: 2, syllogism: 2,
    direction: 2, direction3D: 2, direction4D: 2,
    conditional: 2, belief: 2, analogy: 3, binary: 4, sorting: 2,
};
export const MAX_LEVEL = 20;
/** Types with a lower ceiling than MAX_LEVEL (belief bias runs out of real categories). */
export const TYPE_MAX = { belief: 8 };
export const maxLevelOf = (type) => Math.min(MAX_LEVEL, TYPE_MAX[type] || MAX_LEVEL);

// ---------- statement constructors ----------

export const relStmt = (rel, a, b, neg = false) => ({ kind: 'rel', rel, a, b, neg });
export const dirStmt = (dim, vec, t, a, b, neg = false) => ({ kind: 'dir', dim, vec, t, a, b, neg });
export const sylStmt = (form, s, p, neg = false) => ({ kind: 'syl', form, s, p, neg });
export const metaStmt = (same, x, y, a, b, neg = false) => ({ kind: 'meta', same, x, y, a, b, neg });
export const analogyStmt = (same, a, b, c, d, neg = false) => ({ kind: 'analogy', same, a, b, c, d, neg });
export const opNode = (op, left, right) => ({ kind: 'op', op, left, right });
/** A literal: item `w` is on (true) or off (false). */
export const lit = (w, on) => ({ w, on });
export const factStmt = (w, on) => ({ kind: 'fact', w, on });
export const condStmt = (a, b) => ({ kind: 'cond', a, b });
export const beliefStmt = (form, s, p) => ({ kind: 'bsyl', form, s, p });

const INVERSE_REL = { same: 'opposite', opposite: 'same', more: 'less', less: 'more', before: 'after', after: 'before' };
export const inverseRel = (r) => INVERSE_REL[r];

const neg = (ctx) => !!ctx.settings.negation && coin();

/** Share of premises that get scrambled for each "premise order" setting. */
export const SCRAMBLE = { ordered: 0, p50: 0.5, p80: 0.8, scrambled: 1 };

/**
 * Put premises in the order chosen by the user. Premises arrive from the
 * generators in a CONNECTED order: each one shares a subject with an earlier
 * one. "ordered" keeps that (a chain may also be read backwards, which keeps
 * it connected); 50% / 80% scramble that share of positions; "scrambled"
 * shuffles everything (Fisher–Yates).
 */
export function arrange(premises, ctx, { reversible = true } = {}) {
    const frac = SCRAMBLE[ctx.settings.premiseOrder] ?? 1;
    if (frac >= 1) return shuffle(premises);
    const list = reversible && coin() ? [...premises].reverse() : [...premises];
    const k = Math.round(frac * list.length);
    if (k < 2) return list;
    const idx = sample(list.map((_, i) => i), k).sort((a, b) => a - b);
    let moved = shuffle(idx.map(i => list[i]));
    for (let tries = 0; tries < 5 && moved.every((p, j) => p === list[idx[j]]); tries++) moved = shuffle(moved);
    idx.forEach((i, j) => { list[i] = moved[j]; });
    return list;
}

// ---------- direction vectors ----------

// x = east, y = north, z = up. 2D uses z = 0.
export const DIRS2 = [[0, 1, 0], [1, 1, 0], [1, 0, 0], [1, -1, 0], [0, -1, 0], [-1, -1, 0], [-1, 0, 0], [-1, 1, 0]];
export const DIRS3 = [];
for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1])
    if (x || y || z) DIRS3.push([x, y, z]);

const sameVec = (u, v) => u[0] === v[0] && u[1] === v[1] && u[2] === v[2];
const isZero = (v) => !v[0] && !v[1] && !v[2];

/** Pairs (i, j) of chain positions that are at least 2 apart. */
function distantPairs(count) {
    const pairs = [];
    for (let i = 0; i < count; i++)
        for (let j = i + 2; j < count; j++) pairs.push([i, j]);
    return pairs;
}

const orderPair = ([i, j]) => (coin() ? [i, j] : [j, i]);

// ---------- linear: comparison & temporal ----------

const LINEAR = {
    comparison: { up: 'more', down: 'less' },
    temporal: { up: 'after', down: 'before' },
};

function genLinear(type, n, ctx) {
    const { up, down } = LINEAR[type];
    const words = ctx.pool.take(n + 1); // words[i] has rank i
    let premises = [];
    for (let i = 0; i < n; i++) {
        // "higher is up of lower" or "lower is down of higher"
        premises.push(coin()
            ? phraseRel(up, words[i + 1], words[i], ctx)
            : phraseRel(down, words[i], words[i + 1], ctx));
    }
    if (ctx.settings.meta) premises = addMeta(premises, ctx);

    const [x, y] = orderPair(pick(distantPairs(n + 1)));
    const truth = x > y ? up : down;
    const isValid = coin();
    const claim = isValid ? truth : (truth === up ? down : up);
    return {
        type, level: n,
        premises: arrange(premises, ctx),
        conclusion: phraseRel(claim, words[x], words[y], ctx),
        isValid,
        model: { kind: 'linear', type, order: words, pair: [words[x], words[y]] },
    };
}

/** A relation statement whose *meaning* is `rel`; with negation it is shown as the marked inverse. */
function phraseRel(rel, a, b, ctx) {
    return relStmt(rel, a, b, neg(ctx));
}

// ---------- distinction ----------

function genDistinction(n, ctx) {
    const words = ctx.pool.take(n + 1);
    const group = [0];
    let premises = [];
    for (let i = 1; i <= n; i++) {
        const same = coin();
        group[i] = same ? group[i - 1] : 1 - group[i - 1];
        const [a, b] = coin() ? [words[i - 1], words[i]] : [words[i], words[i - 1]];
        premises.push(phraseRel(same ? 'same' : 'opposite', a, b, ctx));
    }
    if (ctx.settings.meta) premises = addMeta(premises, ctx);

    const [x, y] = orderPair(pick(distantPairs(n + 1)));
    const truth = group[x] === group[y] ? 'same' : 'opposite';
    const isValid = coin();
    const claim = isValid ? truth : inverseRel(truth);
    return {
        type: 'distinction', level: n,
        premises: arrange(premises, ctx),
        conclusion: phraseRel(claim, words[x], words[y], ctx),
        isValid,
        model: {
            kind: 'groups',
            groups: [words.filter((_, i) => group[i] === 0), words.filter((_, i) => group[i] === 1)],
            pair: [words[x], words[y]],
        },
    };
}

/**
 * Replace some premises by meta-relations: "X is to Y as A is to B" where
 * "A ? B" is another (kept) premise. Meaning is derived from the structured
 * relations, not by parsing text.
 */
function addMeta(premises, ctx) {
    const pairsCount = 1 + randInt(Math.floor(premises.length / 2));
    const idx = shuffle(premises.map((_, i) => i)).slice(0, pairsCount * 2);
    const out = [...premises];
    for (let k = 0; k < idx.length; k += 2) {
        const ref = premises[idx[k]];
        const target = premises[idx[k + 1]];
        out[idx[k + 1]] = metaStmt(target.rel === ref.rel, target.a, target.b, ref.a, ref.b, neg(ctx));
    }
    return out;
}

// ---------- space: 2D, 3D, space-time ----------

function genDirection(dim, n, ctx) {
    const type = dim === 2 ? 'direction' : dim === 3 ? 'direction3D' : 'direction4D';
    const dirs = dim === 2 ? DIRS2 : DIRS3;
    const words = ctx.pool.take(n + 1);
    for (let attempt = 0; attempt < 100; attempt++) {
        const coords = [[0, 0, 0, 0]];
        const premises = [];
        for (let i = 1; i <= n; i++) {
            const vec = pick(dirs);
            const t = dim === 4 ? pick([-1, 0, 1]) : 0;
            const p = coords[i - 1];
            coords[i] = [p[0] + vec[0], p[1] + vec[1], p[2] + vec[2], p[3] + t];
            premises.push(dirStmt(dim, vec, t, words[i], words[i - 1], neg(ctx)));
        }
        const pairs = distantPairs(n + 1)
            .map(orderPair)
            .filter(([x, y]) => !isZero(spatialDiff(coords[x], coords[y])));
        if (!pairs.length) continue;
        const [x, y] = pick(pairs);
        const trueVec = spatialDiff(coords[x], coords[y]);
        const trueT = sign(coords[x][3] - coords[y][3]);
        const isValid = coin();
        let vec = trueVec, t = trueT;
        if (!isValid) {
            const changeSpace = dim < 4 || coin();
            const changeTime = dim === 4 && (!changeSpace || coin());
            if (changeSpace) vec = pick(dirs.filter(d => !sameVec(d, trueVec)));
            if (changeTime) t = pick([-1, 0, 1].filter(v => v !== trueT));
        }
        return {
            type, level: n,
            premises: arrange(premises, ctx),
            conclusion: dirStmt(dim, vec, t, words[x], words[y], neg(ctx)),
            isValid,
            model: { kind: 'space', dim, words, coords, pair: [words[x], words[y]] },
        };
    }
    throw new Error('Could not build a spatial question');
}

const spatialDiff = (a, b) => [sign(a[0] - b[0]), sign(a[1] - b[1]), sign(a[2] - b[2])];

// ---------- syllogism ----------

// Forms: A = All S is P, E = No S is P, I = Some S is P, O = Some S is not P.
// Rule string: major form, minor form, conclusion form, figure (1–4).
export const VALID_SYLLOGISMS = {
    AAA1: 'Barbara', EAE1: 'Celarent', AII1: 'Darii', EIO1: 'Ferio', AAI1: 'Barbari', EAO1: 'Celaront',
    EAE2: 'Cesare', AEE2: 'Camestres', EIO2: 'Festino', AOO2: 'Baroco', EAO2: 'Cesaro', AEO2: 'Camestros',
    AAI3: 'Darapti', IAI3: 'Disamis', AII3: 'Datisi', EAO3: 'Felapton', OAO3: 'Bocardo', EIO3: 'Ferison',
    AAI4: 'Bramantip', AEE4: 'Camenes', IAI4: 'Dimaris', EAO4: 'Fesapo', EIO4: 'Fresison', AEO4: 'Camenos',
};
const FORMS = ['A', 'E', 'I', 'O'];
const INVERSE_FORM = { A: 'E', E: 'A', I: 'O', O: 'I' };
export const inverseForm = (f) => INVERSE_FORM[f];

function randomInvalidRule() {
    for (;;) {
        const r = pick(FORMS) + pick(FORMS) + pick(FORMS) + (1 + randInt(4));
        if (!VALID_SYLLOGISMS[r]) return r;
    }
}

/** Premises for a rule with subject s, predicate p, middle m. */
export function syllogismFromRule(rule, s, p, m) {
    const [maj, min, con] = rule;
    const fig = +rule[3];
    const major = fig === 1 || fig === 3 ? [maj, m, p] : [maj, p, m];
    const minor = fig === 1 || fig === 2 ? [min, s, m] : [min, m, s];
    return { major, minor, conclusion: [con, s, p] };
}

function genSyllogism(n, ctx) {
    const words = ctx.pool.take(n + 1);
    const [s, p, m] = words;
    const isValid = coin();
    const rule = isValid ? pick(Object.keys(VALID_SYLLOGISMS)) : randomInvalidRule();
    const { major, minor, conclusion } = syllogismFromRule(rule, s, p, m);
    const mk = ([f, a, b]) => sylStmt(f, a, b, neg(ctx));
    const premises = [mk(major), mk(minor)];
    // Extra premises attach a NEW term to an existing one: a new leaf term cannot
    // change whether the conclusion follows, so they are pure distractors.
    for (let i = 3; i <= n; i++) {
        const other = words[randInt(i)];
        const [a, b] = coin() ? [words[i], other] : [other, words[i]];
        premises.push(sylStmt(pick(FORMS), a, b, neg(ctx)));
    }
    return {
        type: 'syllogism', level: n,
        premises: arrange(premises, ctx, { reversible: false }),
        conclusion: mk(conclusion),
        isValid,
        model: { kind: 'syllogism', rule, mood: VALID_SYLLOGISMS[rule] || null, terms: { s, p, m }, distractors: n - 2 },
    };
}

// ---------- conditional (if… then) ----------
//
// Items are lamps that are on or off. Premises are a chain of conditionals
// L0 → L1 → … → Lk between literals, plus (in "fact" questions) one fact.
// Valid patterns: modus ponens, modus tollens, chain rule, contrapositive.
// Invalid ones: affirming the consequent, denying the antecedent, converse,
// inverse, and a conclusion the premises contradict. Extra premises link a
// NEW item to the chain with a single conditional, so they never change the
// answer. The answer is checked with a 2-SAT solver, not assumed.

const negLit = (l) => lit(l.w, !l.on);
const litKey = (l) => (l.on ? '+' : '-') + l.w;

/** Satisfiable? `clauses` are pairs of literals (a ∨ b); a unit clause is [a, a]. */
export function sat2(clauses) {
    const nodes = new Map();
    const id = (k) => { if (!nodes.has(k)) nodes.set(k, nodes.size); return nodes.get(k); };
    const edges = [];
    const add = (a, b) => edges.push([id(litKey(a)), id(litKey(b))]);
    for (const [a, b] of clauses) { add(negLit(a), b); add(negLit(b), a); }
    for (const [a] of clauses) { id(litKey(negLit(a))); }
    const n = nodes.size;
    const out = Array.from({ length: n }, () => []), inn = Array.from({ length: n }, () => []);
    for (const [a, b] of edges) { out[a].push(b); inn[b].push(a); }
    // Kosaraju (iterative)
    const order = [], seen = new Array(n).fill(false);
    for (let v = 0; v < n; v++) {
        if (seen[v]) continue;
        const stack = [[v, 0]]; seen[v] = true;
        while (stack.length) {
            const top = stack[stack.length - 1];
            if (top[1] < out[top[0]].length) {
                const w = out[top[0]][top[1]++];
                if (!seen[w]) { seen[w] = true; stack.push([w, 0]); }
            } else { order.push(top[0]); stack.pop(); }
        }
    }
    const comp = new Array(n).fill(-1);
    let c = 0;
    for (let i = n - 1; i >= 0; i--) {
        const v = order[i];
        if (comp[v] !== -1) continue;
        const stack = [v]; comp[v] = c;
        while (stack.length) { const x = stack.pop(); for (const w of inn[x]) if (comp[w] === -1) { comp[w] = c; stack.push(w); } }
        c++;
    }
    for (const [k, v] of nodes) {
        if (k[0] !== '+') continue;
        const other = nodes.get('-' + k.slice(1));
        if (other !== undefined && comp[v] === comp[other]) return false;
    }
    return true;
}

/** Clauses for conditional/fact statements. */
export function condClauses(statements) {
    return statements.map(st => (st.kind === 'fact' ? [lit(st.w, st.on), lit(st.w, st.on)] : [negLit(st.a), st.b]));
}

/** 'valid' (follows), 'contradicted' (its negation follows) or 'open' (neither). */
export function condStatus(premises, claim) {
    const base = condClauses(premises);
    // claim C is entailed iff premises ∧ ¬C is unsatisfiable
    const notClaim = claim.kind === 'fact'
        ? [[lit(claim.w, !claim.on), lit(claim.w, !claim.on)]]
        : [[claim.a, claim.a], [negLit(claim.b), negLit(claim.b)]];
    const withClaim = claim.kind === 'fact'
        ? [[lit(claim.w, claim.on), lit(claim.w, claim.on)]]
        : [[negLit(claim.a), claim.b]];
    if (!sat2([...base, ...notClaim])) return 'valid';
    if (!sat2([...base, ...withClaim])) return 'contradicted';
    return 'open';
}

const COND_VALID = { fact: ['MP', 'MT'], chain: ['HS', 'CP'] };
const COND_INVALID = { fact: ['AC', 'DA', 'AC', 'DA', 'CONTRA'], chain: ['CONV', 'INV'] };

function genConditional(n, ctx) {
    const pNeg = ctx.settings.negation ? 0.45 : 0.25;
    const isValid = coin();
    for (let attempt = 0; attempt < 50; attempt++) {
        let mode = Math.random() < 0.6 ? 'fact' : 'chain';
        const condCount = mode === 'fact' ? n - 1 : n;
        let distractors = Math.floor((n - 2) / 3);
        let k = condCount - distractors;              // conditionals in the chain
        let patterns = (isValid ? COND_VALID : COND_INVALID)[mode];
        if (mode === 'chain' && k < 2) patterns = patterns.filter(p => p !== 'HS');
        if (k < 1) continue;
        const pattern = pick(patterns);
        const words = ctx.pool.take(k + 1 + distractors);
        const chain = words.slice(0, k + 1).map(w => lit(w, Math.random() >= pNeg));
        const premises = [];
        for (let i = 0; i < k; i++) premises.push(condStmt(chain[i], chain[i + 1]));
        for (let d = 0; d < distractors; d++) {
            const x = chain[randInt(k + 1)];
            const fresh = lit(words[k + 1 + d], Math.random() >= pNeg);
            premises.push(coin() ? condStmt(fresh, x) : condStmt(x, fresh));
        }
        // i < j: chain positions
        const i = randInt(k), j = i + 1 + randInt(k - i);
        const L = (x) => factStmt(x.w, x.on), NL = (x) => factStmt(x.w, !x.on);
        let fact = null, claim;
        switch (pattern) {
            case 'MP': fact = L(chain[i]); claim = L(chain[j]); break;
            case 'MT': fact = NL(chain[j]); claim = NL(chain[i]); break;
            case 'AC': fact = L(chain[j]); claim = L(chain[i]); break;
            case 'DA': fact = NL(chain[i]); claim = NL(chain[j]); break;
            case 'CONTRA':
                if (coin()) { fact = L(chain[i]); claim = NL(chain[j]); } else { fact = NL(chain[j]); claim = L(chain[i]); }
                break;
            case 'HS': {
                const a = randInt(k - 1), b = a + 2 + randInt(k - a - 1);
                claim = condStmt(chain[a], chain[b]); break;
            }
            case 'CP': claim = condStmt(negLit(chain[j]), negLit(chain[i])); break;
            case 'CONV': claim = condStmt(chain[j], chain[i]); break;
            case 'INV': claim = condStmt(negLit(chain[i]), negLit(chain[j])); break;
        }
        if (fact) premises.push(fact);
        const status = condStatus(premises, claim);
        if ((status === 'valid') !== isValid) continue; // never happens by construction; kept as a guard
        return {
            type: 'conditional', level: n,
            premises: arrange(premises, ctx, { reversible: !fact }),
            conclusion: claim,
            isValid,
            model: { kind: 'conditional', chain, fact, pattern, status, distractors },
        };
    }
    throw new Error('Could not build a conditional question');
}

// ---------- belief bias ----------
//
// A syllogism with real categories. Validity (coin) and the real-world truth
// of the conclusion (coin) are independent, so believability carries no
// information about the answer: half the questions are conflict items.

function genBelief(n, ctx) {
    const isValid = coin();
    const believable = coin();
    const rule = isValid ? pick(Object.keys(VALID_SYLLOGISMS)) : randomInvalidRule();
    // Sometimes every premise is true in reality too (the classic trap when the
    // argument is invalid). A valid argument with true premises cannot have a
    // false conclusion, so that cell always has at least one false premise.
    const wantTrue = !(isValid && !believable) && Math.random() < 0.4;
    const real = ([f, a, b]) => realTruth(f, a, b);
    let found = null;
    for (let tries = 0; tries < 4000 && !found; tries++) {
        const [s, p, m] = sample(CATEGORIES, 3);
        const parts = syllogismFromRule(rule, s, p, m);
        if (real(parts.conclusion) !== believable) continue;
        if (tries < 3000 && (real(parts.major) && real(parts.minor)) !== wantTrue) continue;
        found = { s, p, m, ...parts };
    }
    const { s, p, m, major, minor, conclusion } = found;
    const used = [s, p, m];
    const mk = ([f, a, b]) => beliefStmt(f, a, b);
    const premises = [mk(major), mk(minor)];
    const free = shuffle(CATEGORIES.filter(c => !used.includes(c)));
    for (let i = 3; i <= n && free.length; i++) {
        const other = pick(used), fresh = free.pop();
        used.push(fresh);
        premises.push(coin() ? beliefStmt(pick(FORMS), fresh, other) : beliefStmt(pick(FORMS), other, fresh));
    }
    return {
        type: 'belief', level: premises.length,
        premises: arrange(premises, ctx, { reversible: false }),
        conclusion: mk(conclusion),
        isValid,
        model: { kind: 'belief', rule, mood: VALID_SYLLOGISMS[rule] || null, terms: { s, p, m }, distractors: premises.length - 2, believable },
    };
}

// ---------- analogy ----------

/** Relation between two items of a base model, as a comparable key (or null if undefined). */
export function relationKey(model, x, y) {
    if (model.kind === 'groups') {
        const g = (w) => (model.groups[0].includes(w) ? 0 : 1);
        return g(x) === g(y) ? 'same' : 'opposite';
    }
    if (model.kind === 'linear') {
        return model.order.indexOf(x) > model.order.indexOf(y) ? 'up' : 'down';
    }
    if (model.kind === 'space') {
        const cx = model.coords[model.words.indexOf(x)];
        const cy = model.coords[model.words.indexOf(y)];
        const v = spatialDiff(cx, cy);
        if (isZero(v)) return null;
        const t = model.dim === 4 ? sign(cx[3] - cy[3]) : 0;
        return v.join(',') + '|' + t;
    }
    return null;
}

function genAnalogy(n, ctx) {
    const bases = ANALOGY_BASES.filter(t => ctx.settings.enabled.includes(t));
    const baseType = pick(bases.length ? bases : ANALOGY_BASES);
    const wantSame = coin();
    for (let attempt = 0; attempt < 30; attempt++) {
        const base = generateBase(baseType, n, ctx);
        const words = base.model.kind === 'space' ? base.model.words
            : base.model.kind === 'linear' ? base.model.order
            : [...base.model.groups[0], ...base.model.groups[1]];
        for (let k = 0; k < 300; k++) {
            const [a, b, c, d] = sample(words, 4);
            const r1 = relationKey(base.model, a, b);
            const r2 = relationKey(base.model, c, d);
            if (r1 === null || r2 === null) continue;
            if ((r1 === r2) !== wantSame) continue;
            const isValid = coin();
            const claimSame = isValid ? wantSame : !wantSame;
            return {
                type: 'analogy', subtype: baseType, level: n,
                premises: base.premises,
                conclusion: analogyStmt(claimSame, a, b, c, d, neg(ctx)),
                isValid,
                model: { kind: 'analogy', base: base.model, baseType, quad: [a, b, c, d], same: wantSame },
            };
        }
    }
    throw new Error('Could not build an analogy');
}

// ---------- binary ----------

export function evalOp(op, a, b) {
    switch (op) {
        case 'and': return a && b;
        case 'or': return a || b;
        case 'nand': return !(a && b);
        case 'nor': return !(a || b);
        case 'xor': return a !== b;
        case 'xnor': return a === b;
    }
    throw new Error('Unknown op ' + op);
}

export function evalTree(node, parts) {
    if (node.kind === 'leaf') return parts[node.index].isValid;
    return evalOp(node.op, evalTree(node.left, parts), evalTree(node.right, parts));
}

function buildTree(lo, hi, ops) {
    if (lo === hi) return { kind: 'leaf', index: lo };
    const mid = lo + randInt(hi - lo);
    return { kind: 'op', op: pick(ops), left: buildTree(lo, mid, ops), right: buildTree(mid + 1, hi, ops) };
}

function genBinary(n, ctx) {
    const ops = ctx.settings.ops.length ? ctx.settings.ops : OPS;
    const bases = BASE_TYPES.filter(t => ctx.settings.enabled.includes(t));
    const pool = bases.length ? bases : BASE_TYPES;
    const partCount = Math.max(2, Math.min(2 + (ctx.settings.nestedDepth || 0), Math.floor(n / 2)));
    const sizes = Array(partCount).fill(Math.floor(n / partCount));
    for (let i = 0; i < n % partCount; i++) sizes[i]++;
    const wanted = coin();
    for (let attempt = 0; attempt < 60; attempt++) {
        const types = partCount === 2 && pool.length > 1 ? sample(pool, 2) : sizes.map(() => pick(pool));
        const parts = sizes.map((size, i) => generateBase(types[i], size, ctx));
        const tree = buildTree(0, partCount - 1, ops);
        const isValid = evalTree(tree, parts);
        if (isValid !== wanted && attempt < 59) continue;
        return {
            type: 'binary', level: n,
            premises: (SCRAMBLE[ctx.settings.premiseOrder] ?? 1) >= 1 ? shuffle(parts.flatMap(p => p.premises)) : parts.flatMap(p => p.premises),
            conclusion: { kind: 'tree', tree, leaves: parts.map(p => p.conclusion) },
            isValid,
            model: { kind: 'binary', tree, parts: parts.map(p => ({ type: p.type, isValid: p.isValid, conclusion: p.conclusion, model: p.model })) },
        };
    }
}

// ---------- entry points ----------

function generateBase(type, n, ctx) {
    switch (type) {
        case 'distinction': return genDistinction(n, ctx);
        case 'comparison':
        case 'temporal': return genLinear(type, n, ctx);
        case 'syllogism': return genSyllogism(n, ctx);
        case 'direction': return genDirection(2, n, ctx);
        case 'direction3D': return genDirection(3, n, ctx);
        case 'direction4D': return genDirection(4, n, ctx);
    }
    throw new Error('Unknown base type ' + type);
}

/**
 * @param {string} type one of TYPES except 'sorting'
 * @param {number} level number of premises
 * @param {{settings: {enabled: string[], negation: boolean, meta: boolean, ops: string[], nestedDepth: number, premiseOrder?: string}, pool}} ctx
 */
export function generateQuestion(type, level, ctx) {
    const n = Math.max(MIN_LEVEL[type] || 2, Math.min(maxLevelOf(type), level));
    let q;
    if (type === 'analogy') q = genAnalogy(n, ctx);
    else if (type === 'binary') q = genBinary(n, ctx);
    else if (type === 'conditional') q = genConditional(n, ctx);
    else if (type === 'belief') q = genBelief(n, ctx);
    else q = generateBase(type, n, ctx);
    q.level = n;
    return q;
}
