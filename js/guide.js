// "How to build the map": a worked example per kind of question, rendered with
// the same statement renderer and explanations as the game (so it is
// translated automatically), plus two unscored practice questions per kind.

import { t } from './i18n.js';
import { renderStatement } from './render.js';
import { explain, answerWord } from './explain.js';
import { relStmt, dirStmt, sylStmt, analogyStmt, lit, factStmt, condStmt, beliefStmt, generateQuestion, BASE_TYPES, OPS } from './generators.js';
import { createWordPool } from './words.js';
import { escapeHtml } from './util.js';

const LINE = ['TAV', 'MEK', 'SOL', 'BIX']; // least → most
const lineModel = (pair) => ({ kind: 'linear', type: 'comparison', order: LINE, pair });
const groupsModel = { kind: 'groups', groups: [['ZEB', 'KIP', 'RUF'], ['LOM']], pair: ['ZEB', 'RUF'] };
const spaceModel = {
    kind: 'space', dim: 2, words: ['NAR', 'POT', 'VEX', 'DUL'],
    coords: [[0, 0, 0, 0], [1, 0, 0, 0], [1, 1, 0, 0], [0, 1, 0, 0]], pair: ['VEX', 'NAR'],
};

/** Worked examples: real, structured questions. */
export const KINDS = [
    {
        id: 'distinction', practice: 'distinction',
        examples: [{
            premises: [relStmt('same', 'ZEB', 'KIP'), relStmt('opposite', 'KIP', 'LOM'), relStmt('opposite', 'LOM', 'RUF')],
            conclusion: relStmt('same', 'ZEB', 'RUF'), isValid: true, model: groupsModel,
        }],
    },
    {
        id: 'linear', practice: 'comparison',
        examples: [{
            premises: [relStmt('more', 'MEK', 'TAV'), relStmt('less', 'MEK', 'SOL'), relStmt('more', 'BIX', 'SOL')],
            conclusion: relStmt('less', 'TAV', 'BIX'), isValid: true, model: lineModel(['TAV', 'BIX']),
        }],
    },
    {
        id: 'space', practice: 'direction',
        examples: [{
            premises: [dirStmt(2, [1, 0, 0], 0, 'POT', 'NAR'), dirStmt(2, [0, 1, 0], 0, 'VEX', 'POT'), dirStmt(2, [-1, 0, 0], 0, 'DUL', 'VEX')],
            conclusion: dirStmt(2, [1, 1, 0], 0, 'VEX', 'NAR'), isValid: true, model: spaceModel,
        }],
    },
    {
        id: 'syllogism', practice: 'syllogism',
        examples: [
            {
                premises: [sylStmt('A', 'FOM', 'GUL'), sylStmt('A', 'BEK', 'FOM')],
                conclusion: sylStmt('A', 'BEK', 'GUL'), isValid: true,
                model: { kind: 'syllogism', rule: 'AAA1', mood: 'Barbara', terms: { s: 'BEK', p: 'GUL', m: 'FOM' }, distractors: 0 },
            },
            {
                premises: [sylStmt('I', 'FOM', 'GUL'), sylStmt('I', 'BEK', 'FOM')],
                conclusion: sylStmt('I', 'BEK', 'GUL'), isValid: false,
                model: { kind: 'syllogism', rule: 'III1', mood: null, terms: { s: 'BEK', p: 'GUL', m: 'FOM' }, distractors: 0 },
            },
        ],
    },
    {
        id: 'conditional', practice: 'conditional',
        examples: [
            {
                // modus tollens along a chain: LOM on means KIP is not on, so ZEB is not on
                premises: [condStmt(lit('ZEB', true), lit('KIP', true)), condStmt(lit('KIP', true), lit('LOM', false)), factStmt('LOM', true)],
                conclusion: factStmt('ZEB', false), isValid: true,
                model: { kind: 'conditional', chain: [lit('ZEB', true), lit('KIP', true), lit('LOM', false)], fact: factStmt('LOM', true), pattern: 'MT', status: 'valid', distractors: 0 },
            },
            {
                // affirming the consequent
                premises: [condStmt(lit('ZEB', true), lit('KIP', true)), factStmt('KIP', true)],
                conclusion: factStmt('ZEB', true), isValid: false,
                model: { kind: 'conditional', chain: [lit('ZEB', true), lit('KIP', true)], fact: factStmt('KIP', true), pattern: 'AC', status: 'open', distractors: 0 },
            },
        ],
    },
    {
        id: 'belief', practice: 'belief',
        examples: [
            {
                // valid, but the conclusion is false in reality
                premises: [beliefStmt('A', 'mammals', 'birds'), beliefStmt('A', 'whales', 'mammals')],
                conclusion: beliefStmt('A', 'whales', 'birds'), isValid: true,
                model: { kind: 'belief', rule: 'AAA1', mood: 'Barbara', terms: { s: 'whales', p: 'birds', m: 'mammals' }, distractors: 0, believable: false },
            },
            {
                // invalid, but every sentence is true in reality
                premises: [beliefStmt('A', 'flowers', 'plants'), beliefStmt('A', 'roses', 'plants')],
                conclusion: beliefStmt('A', 'roses', 'flowers'), isValid: false,
                model: { kind: 'belief', rule: 'AAA2', mood: null, terms: { s: 'roses', p: 'flowers', m: 'plants' }, distractors: 0, believable: true },
            },
        ],
    },
    {
        id: 'analogy', practice: 'analogy',
        examples: [{
            premises: [relStmt('more', 'MEK', 'TAV'), relStmt('less', 'MEK', 'SOL'), relStmt('more', 'BIX', 'SOL')],
            conclusion: analogyStmt(true, 'TAV', 'MEK', 'SOL', 'BIX'), isValid: true,
            model: { kind: 'analogy', base: lineModel([]), baseType: 'comparison', quad: ['TAV', 'MEK', 'SOL', 'BIX'], same: true },
        }],
    },
    {
        id: 'binary', practice: 'binary',
        examples: [{
            premises: [
                relStmt('same', 'ZEB', 'KIP'), relStmt('opposite', 'KIP', 'LOM'), relStmt('opposite', 'LOM', 'RUF'),
                relStmt('more', 'MEK', 'TAV'), relStmt('less', 'MEK', 'SOL'), relStmt('more', 'BIX', 'SOL'),
            ],
            conclusion: {
                kind: 'tree',
                tree: { kind: 'op', op: 'xor', left: { kind: 'leaf', index: 0 }, right: { kind: 'leaf', index: 1 } },
                leaves: [relStmt('same', 'ZEB', 'RUF'), relStmt('less', 'BIX', 'TAV')],
            },
            isValid: true,
            model: {
                kind: 'binary', tree: { kind: 'op', op: 'xor', left: { kind: 'leaf', index: 0 }, right: { kind: 'leaf', index: 1 } },
                parts: [
                    { type: 'distinction', isValid: true, conclusion: relStmt('same', 'ZEB', 'RUF'), model: groupsModel },
                    { type: 'comparison', isValid: false, conclusion: relStmt('less', 'BIX', 'TAV'), model: lineModel(['BIX', 'TAV']) },
                ],
            },
        }],
    },
    {
        id: 'negation', practice: 'comparison', negation: true,
        examples: [{
            premises: [relStmt('more', 'MEK', 'TAV', true), relStmt('more', 'SOL', 'MEK')],
            conclusion: relStmt('more', 'SOL', 'TAV'), isValid: true,
            model: { kind: 'linear', type: 'comparison', order: ['TAV', 'MEK', 'SOL'], pair: ['SOL', 'TAV'] },
        }],
    },
];

const RULES = ['r1', 'r2', 'r3', 'r4', 'r5'];

function exampleHtml(ex, lang) {
    return `<div class="guide-example">
        <h3 class="eyebrow">${escapeHtml(t('guide.example'))}</h3>
        <ol class="premises premises--small">${ex.premises.map(p => `<li>${renderStatement(p, lang, 'sentences')}</li>`).join('')}</ol>
        <div class="conclusion conclusion--small">${renderStatement(ex.conclusion, lang, 'sentences')}</div>
        <p><strong>${escapeHtml(t('fb.answer', { answer: answerWord(ex.isValid) }))}</strong></p>
        <h3 class="eyebrow">${escapeHtml(t('guide.map'))}</h3>
        ${explain(ex, lang)}
      </div>`;
}

/**
 * Render the guide into `container`. `opts.onTrain` starts training.
 */
export function renderGuide(container, lang, opts = {}) {
    container.innerHTML = `<h1>${escapeHtml(t('guide.title'))}</h1>
      <div class="card prose">
        <p>${escapeHtml(t('guide.intro'))}</p>
        <h2>${escapeHtml(t('guide.rulesTitle'))}</h2>
        <ol>${RULES.map(r => `<li>${escapeHtml(t('guide.' + r))}</li>`).join('')}</ol>
      </div>
      ${KINDS.map(k => `<section class="card guide-kind" aria-labelledby="g-${k.id}">
          <h2 id="g-${k.id}">${escapeHtml(t('guide.k.' + k.id))}</h2>
          <p>${escapeHtml(t('guide.k.' + k.id + '.text'))}</p>
          ${k.examples.map(ex => exampleHtml(ex, lang)).join('')}
          <div class="guide-practice" data-kind="${k.id}">
            <button type="button" class="btn btn--primary guide-try">${escapeHtml(t('guide.practice'))}</button>
            <span class="muted small">${escapeHtml(t('guide.practiceNote'))}</span>
          </div>
        </section>`).join('')}
      <p><button type="button" class="btn btn--primary guide-train">${escapeHtml(t('nav.train'))} →</button></p>`;

    for (const box of container.querySelectorAll('.guide-practice')) {
        const kind = KINDS.find(k => k.id === box.dataset.kind);
        box.querySelector('.guide-try').onclick = () => practice(box, kind, lang, 0);
    }
    const train = container.querySelector('.guide-train');
    if (train && opts.onTrain) train.onclick = opts.onTrain;
}

function practice(box, kind, lang, index) {
    const type = kind.practice;
    const level = type === 'analogy' ? 3 : type === 'binary' ? 4 : 2;
    const q = generateQuestion(type, level, {
        settings: { enabled: BASE_TYPES, negation: !!kind.negation, meta: false, ops: OPS, nestedDepth: 0, premiseOrder: 'ordered' },
        pool: createWordPool(lang, 'nonsense'),
    });
    box.innerHTML = `<div class="guide-q" role="group" aria-label="${escapeHtml(t('guide.practice'))} ${index + 1}/2">
        <p class="eyebrow">${escapeHtml(t('guide.practice'))} · ${index + 1}/2</p>
        <ol class="premises premises--small">${q.premises.map(p => `<li>${renderStatement(p, lang, 'sentences')}</li>`).join('')}</ol>
        <div class="conclusion conclusion--small">${renderStatement(q.conclusion, lang, 'sentences')}</div>
        <div class="guide-answers">
          <button type="button" class="btn btn--answer btn--false" data-v="false"><span class="btn__text">${escapeHtml(t('btn.false'))}</span></button>
          <button type="button" class="btn btn--answer btn--true" data-v="true"><span class="btn__text">${escapeHtml(t('btn.true'))}</span></button>
        </div>
        <div class="guide-result" aria-live="polite"></div>
      </div>`;
    box.querySelector('.guide-answers .btn').focus();
    for (const b of box.querySelectorAll('.guide-answers button')) {
        b.onclick = () => {
            const correct = (b.dataset.v === 'true') === q.isValid;
            box.querySelectorAll('.guide-answers button').forEach(x => { x.disabled = true; });
            const res = box.querySelector('.guide-result');
            res.innerHTML = `<p class="guide-verdict ${correct ? 'is-right' : 'is-wrong'}"><span aria-hidden="true">${correct ? '✓' : '✗'}</span> ${escapeHtml(t(correct ? 'fb.correct' : 'fb.wrong'))} · ${escapeHtml(t('fb.answer', { answer: answerWord(q.isValid) }))}</p>
              ${explain(q, lang)}
              <button type="button" class="btn guide-next">${escapeHtml(index === 0 ? t('btn.next') : t('guide.again'))}</button>`;
            res.querySelector('.guide-next').onclick = () => practice(box, kind, lang, index === 0 ? 1 : 0);
            res.querySelector('.guide-next').focus();
        };
    }
}
