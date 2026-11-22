// Explanations shown after an answer: they rebuild the mental model behind the
// question (an ordered line, two groups, a grid, the syllogism form...).

import { t } from './i18n.js';
import { renderStatement, dirPhrase } from './render.js';
import { relStmt, dirStmt, relationKey } from './generators.js';
import { escapeHtml, sign } from './util.js';

const chip = (w, hl) => `<span class="chip${hl ? ' chip--hl' : ''}">${escapeHtml(w)}</span>`;
const isPair = (model, w) => model.pair && model.pair.includes(w);

export function explain(q, lang) {
    let html = explainModel(q.model, lang, q);
    if (q.model.kind === 'binary') html += `<p><strong>${t('ex.binary.result', { value: answerWord(q.isValid) })}</strong></p>`;
    return `<div class="explain">${html}</div>`;
}

function explainModel(model, lang, q) {
    switch (model.kind) {
        case 'linear': return explainLinear(model);
        case 'groups': return explainGroups(model);
        case 'space': return explainSpace(model, lang);
        case 'syllogism': return explainSyllogism(model);
        case 'analogy': return explainAnalogy(model, lang);
        case 'binary': return explainBinary(model, lang);
    }
    return '';
}

function explainLinear(model) {
    const items = model.order.map(w => chip(w, isPair(model, w))).join('<span class="ex-arrow" aria-hidden="true">→</span>');
    return `<p>${t('ex.order.' + model.type)}</p><p class="ex-line">${items}</p>`;
}

function explainGroups(model) {
    return `<p>${t('ex.groups')}</p><div class="ex-groups">`
        + model.groups.map((g, i) => `<div class="ex-group"><div class="ex-group__title">${t('ex.group', { n: i + 1 })}</div>${g.map(w => chip(w, isPair(model, w))).join(' ')}</div>`).join('')
        + `</div>`;
}

function explainSpace(model, lang) {
    const { dim, words, coords } = model;
    let html = '';
    if (dim === 2) {
        const xs = coords.map(c => c[0]), ys = coords.map(c => c[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        if (maxX - minX <= 12 && maxY - minY <= 12) {
            html += `<table class="ex-grid" aria-label="${escapeHtml(t('type.direction'))}"><tbody>`;
            for (let y = maxY; y >= minY; y--) {
                html += '<tr>';
                for (let x = minX; x <= maxX; x++) {
                    const here = words.filter((_, i) => coords[i][0] === x && coords[i][1] === y);
                    html += `<td>${here.map(w => chip(w, isPair(model, w))).join('')}</td>`;
                }
                html += '</tr>';
            }
            html += `</tbody></table><p class="ex-compass" aria-hidden="true">↑ N</p>`;
        }
    }
    const head = t('ex.space', { z: dim >= 3 ? t('ex.space.z') : '', t: dim === 4 ? t('ex.space.t') : '' });
    html += `<p>${head}</p><table class="ex-table"><thead><tr><th scope="col">${escapeHtml(t('ex.item'))}</th><th scope="col">x</th><th scope="col">y</th>${dim >= 3 ? '<th scope="col">z</th>' : ''}${dim === 4 ? '<th scope="col">t</th>' : ''}</tr></thead><tbody>`
        + words.map((w, i) => `<tr${isPair(model, w) ? ' class="hl"' : ''}><th scope="row">${chip(w, isPair(model, w))}</th><td>${coords[i][0]}</td><td>${coords[i][1]}</td>${dim >= 3 ? `<td>${coords[i][2]}</td>` : ''}${dim === 4 ? `<td>${coords[i][3]}</td>` : ''}</tr>`).join('')
        + `</tbody></table>`;
    const [a, b] = model.pair;
    const ca = coords[words.indexOf(a)], cb = coords[words.indexOf(b)];
    const vec = [sign(ca[0] - cb[0]), sign(ca[1] - cb[1]), sign(ca[2] - cb[2])];
    html += `<p>${t('ex.pair')} ${renderStatement(dirStmt(dim, vec, sign(ca[3] - cb[3]), a, b), lang, 'sentences')}</p>`;
    return html;
}

function explainSyllogism(model) {
    const r = model.rule;
    const code = `${r.slice(0, 3)}-${r[3]}`;
    let html = `<p>${escapeHtml(t('ex.syl.terms', model.terms))}</p>`;
    html += `<p>${model.mood ? t('ex.syl.valid', { code, mood: model.mood }) : t('ex.syl.invalid', { code })}</p>`;
    if (model.distractors > 0) html += `<p>${t('ex.syl.distractors')}</p>`;
    return html;
}

/** A statement expressing the TRUE relation between x and y in a base model. */
function trueRelation(model, x, y) {
    if (model.kind === 'groups') return relStmt(relationKey(model, x, y), x, y);
    if (model.kind === 'linear') {
        const up = relationKey(model, x, y) === 'up';
        const words = model.type === 'comparison' ? ['more', 'less'] : ['after', 'before'];
        return relStmt(up ? words[0] : words[1], x, y);
    }
    const cx = model.coords[model.words.indexOf(x)], cy = model.coords[model.words.indexOf(y)];
    return dirStmt(model.dim, [0, 1, 2].map(i => sign(cx[i] - cy[i])), sign(cx[3] - cy[3]), x, y);
}

function explainAnalogy(model, lang) {
    const [a, b, c, d] = model.quad;
    const base = { ...model.base, pair: model.quad };
    return explainModel(base, lang)
        + `<p>${renderStatement(trueRelation(model.base, a, b), lang, 'sentences')}.<br>${renderStatement(trueRelation(model.base, c, d), lang, 'sentences')}.</p>`
        + `<p><strong>${t(model.same ? 'ex.analogy.same' : 'ex.analogy.diff')}</strong></p>`;
}

function explainBinary(model, lang) {
    const val = (v) => t(v ? 'words.true' : 'words.false');
    let html = '';
    model.parts.forEach((p, i) => {
        html += `<div class="ex-part"><p><strong>${t('ex.binary.part', { n: i + 1, value: val(p.isValid) })}</strong> ${renderStatement(p.conclusion, lang, 'sentences')}</p>${explainModel(p.model, lang)}</div>`;
    });
    return html;
}

export const answerWord = (v) => t(v ? 'words.true' : 'words.false');
export { dirPhrase };
