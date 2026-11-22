// Sorting task (inspired by card-sorting tests): find the hidden ordering rule by
// moving cards; each card shows whether it is in the right place.
// Fixes vs the original: up to all 4 properties can be used, no infinite loop
// when cards are identical, keyboard/touch friendly arrow buttons instead of
// mouse-only dragging, scored and timed like the other questions.

import { t } from './i18n.js';
import { randInt, coin, shuffle } from './util.js';

const PROPS = { Color: 7, Material: 5, Shape: 6, Size: 5 };
const KEYS = Object.keys(PROPS);

export function makeSortingTask(cardCount, minWidth) {
    const width = Math.max(2, Math.min(4, minWidth + randInt(4 - minWidth + 1)));
    const start = randInt(KEYS.length);
    const props = shuffle(Array.from({ length: width }, (_, i) => KEYS[(i + start) % KEYS.length]));
    const rule = props.map(p => ({ prop: p, desc: coin() }));
    // distinct cards so that the order is unique
    const seen = new Set();
    const cards = [];
    let guard = 0;
    while (cards.length < cardCount && guard++ < 1000) {
        const c = Object.fromEntries(props.map(p => [p, randInt(PROPS[p])]));
        const key = JSON.stringify(c);
        if (seen.has(key)) continue;
        seen.add(key); cards.push(c);
    }
    const cmp = (a, b) => {
        for (const { prop, desc } of rule) if (a[prop] !== b[prop]) return (a[prop] - b[prop]) * (desc ? -1 : 1);
        return 0;
    };
    const expected = [...cards].sort(cmp);
    let order = shuffle(cards);
    for (let i = 0; i < 20 && order.every((c, k) => c === expected[k]); i++) order = shuffle(cards);
    if (order.every((c, k) => c === expected[k])) order = [...expected].reverse();
    return { rule, expected, order };
}

const cardText = (card) => Object.entries(card).map(([p, v]) => t('val.' + p)[v]).join(' · ');

export function renderSorting(container, task, { onSolved, announce }) {
    let moves = 0;
    let done = false;
    const wrap = document.createElement('div');
    wrap.className = 'sorting';
    const intro = document.createElement('p'); intro.textContent = t('sort.instructions');
    const hint = document.createElement('p'); hint.className = 'muted small'; hint.textContent = t('sort.hint');
    const counter = document.createElement('p'); counter.className = 'small';
    const list = document.createElement('ol'); list.className = 'sorting__list';
    wrap.append(intro, hint, list, counter);
    container.replaceChildren(wrap);

    const draw = (focusIndex, focusDir) => {
        list.replaceChildren();
        task.order.forEach((card, i) => {
            const ok = card === task.expected[i];
            const li = document.createElement('li');
            li.className = 'sorting__card ' + (ok ? 'is-right' : 'is-wrong');
            const label = document.createElement('span'); label.className = 'sorting__text';
            label.textContent = cardText(card);
            const state = document.createElement('span'); state.className = 'sorting__state'; state.textContent = ok ? '✓' : '✗';
            state.setAttribute('aria-hidden', 'true');
            const up = document.createElement('button'); up.type = 'button'; up.className = 'icon-btn'; up.textContent = '▲';
            up.setAttribute('aria-label', `${t('sort.up')}: ${cardText(card)}`); up.disabled = i === 0 || done;
            const down = document.createElement('button'); down.type = 'button'; down.className = 'icon-btn'; down.textContent = '▼';
            down.setAttribute('aria-label', `${t('sort.down')}: ${cardText(card)}`); down.disabled = i === task.order.length - 1 || done;
            up.onclick = () => move(i, -1);
            down.onclick = () => move(i, 1);
            li.append(state, label, up, down);
            list.append(li);
        });
        counter.textContent = t('sort.moves', { n: moves });
        if (focusIndex !== undefined) {
            const btns = list.children[focusIndex]?.querySelectorAll('button');
            const b = btns && (focusDir < 0 ? btns[0] : btns[1]);
            if (b && !b.disabled) b.focus(); else list.children[focusIndex]?.querySelector('button:not([disabled])')?.focus();
        }
    };
    const move = (i, d) => {
        const j = i + d;
        if (done || j < 0 || j >= task.order.length) return;
        [task.order[i], task.order[j]] = [task.order[j], task.order[i]];
        moves++;
        const solved = task.order.every((c, k) => c === task.expected[k]);
        const okCount = task.order.filter((c, k) => c === task.expected[k]).length;
        announce(`${cardText(task.order[j])}: ${t('sort.position', { i: j + 1 })}. ${okCount}/${task.order.length} ✓`);
        if (solved) { done = true; draw(); onSolved(moves); return; }
        draw(j, d);
    };
    draw();
    return { stop() { done = true; draw(); } };
}

export function ruleText(rule) {
    return rule.map(r => `${t('prop.' + r.prop)} (${t(r.desc ? 'sort.desc' : 'sort.asc')})`).join(' › ');
}
