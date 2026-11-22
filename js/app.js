// Application shell: views, question flow, timer, sessions, check-ups.

import { t, setLang, LANGUAGE_NAMES } from './i18n.js';
import { generateQuestion, TYPES, BASE_TYPES, OPS, MIN_LEVEL, MAX_LEVEL } from './generators.js';
import { renderStatement, hasNegation, opsInTree, toText, setStyle, opName, symbolKey } from './render.js';
import { explain, answerWord } from './explain.js';
import { createWordPool } from './words.js';
import {
    loadSettings, saveSettings, loadState, saveState, sanitizeSettings, settingsWarnings, playableTypes,
    PRESETS, DEFAULTS, openDB, getAll, put, remove, clearAll, compact, importBackup, storageOk,
} from './storage.js';
import { updateLevel, currentLevel, chooseType, timeLimit } from './adaptive.js';
import { summary, byCategory, sessionSeries, sessionsThisWeek, weeklyMinutes, secondsPerPremise, minutesBetween } from './stats.js';
import { lineChart, barList, columnChart } from './charts.js';
import { makeSortingTask, renderSorting, ruleText } from './wcst.js';
import { stageSettings, nextStage, STAGE_COUNT } from './program.js';
import { renderGuide } from './guide.js';
import { registerServiceWorker, requestPersistence, isPersisted, canInstall, promptInstall, onInstallChange, isStandalone, isIOS, keepAwake, vibrate } from './pwa.js';
import { coin, shuffle, escapeHtml, median, clampInt, pick } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const SESSION_GAP = 15 * 60 * 1000;
const BENCH_SIZE = 20;
const BENCH_TYPES = ['distinction', 'comparison', 'temporal', 'syllogism', 'direction', 'direction3D', 'direction4D', 'analogy', 'binary'];

const app = {
    settings: loadSettings(),
    state: loadState(),
    answers: [], sessions: [], benchmarks: [], tests: [],
    view: 'train',
    q: null,             // current question (or sorting task)
    phase: 'idle',       // idle | question | feedback
    startedAt: 0,
    timer: null,         // { limit, remainingMs, lastTick, handle }
    session: null,
    bench: null,         // { list, index, answers }
    step: 0,             // one-at-a-time premise index
    lastType: null,
    sorting: null,
    autoNextHandle: null,
};

// ---------------------------------------------------------------- utilities

const lang = () => app.settings.lang;
const fmtSec = (s) => (s === null || s === undefined ? '–' : (Math.round(s * 10) / 10).toLocaleString(lang()));
const fmtPct = (v) => (v === null || v === undefined ? '–' : Math.round(v * 100) + '%');
const fmtDate = (ms) => new Date(ms).toLocaleDateString(lang(), { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (ms) => new Date(ms).toLocaleString(lang(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtClock = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function announce(text) {
    const live = $('#live');
    live.textContent = '';
    setTimeout(() => { live.textContent = text; }, 30);
}

function persistSettings() {
    app.settings = sanitizeSettings(app.settings);
    saveSettings(app.settings);
}

function applyDisplaySettings() {
    const s = app.settings;
    const root = document.documentElement;
    root.lang = s.lang;
    if (s.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', s.theme);
    root.dataset.size = s.textSize;
    root.classList.toggle('reduce-motion', s.reduceMotion);
    root.classList.toggle('neg-symbol', s.negSymbol);
    setLang(s.lang);
    setStyle(s.premiseStyle);
    document.title = t('app.title');
}

// ---------------------------------------------------------------- shell / navigation

function renderShell() {
    $('.skip').textContent = t('skip');
    $('.brand__name').textContent = t('app.title');
    $('.brand__tag').textContent = t('app.tagline');
    for (const b of $$('.nav button')) b.textContent = t('nav.' + b.dataset.view);
    $('footer .credits').textContent = t('about.creditsText').split('. ')[0] + '.';
    updateThemeToggle();
    $('.tea--header .tea__text').textContent = t('tea.button');
    $('.tea--header').setAttribute('aria-label', `${t('tea.button')} (${t('tea.newTab')})`);
    $('.tea-link__text').textContent = '♥ ' + t('tea.button');
    for (const s of $$('.tea__newtab')) s.textContent = ` (${t('tea.newTab')})`;
}

const TEA_URL = 'https://buymeacoffee.com/practicalhumanism';
const TEA_ICON = '<svg class="tea__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9h12v4a6 6 0 0 1-6 6a6 6 0 0 1-6-6Z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H15.4"/><path d="M7.5 2.5c0 1.3 1.2 1.7 1.2 3M11.5 2.5c0 1.3 1.2 1.7 1.2 3"/><path d="M3 21.5h14"/></svg>';
/** The support button, as used in About and in the session summary. */
const teaButton = (extra = '') => `<a class="tea ${extra}" href="${TEA_URL}" target="_blank" rel="noopener">${TEA_ICON}<span class="tea__text">${escapeHtml(t('tea.button'))}</span><span class="sr-only"> (${escapeHtml(t('tea.newTab'))})</span></a>`;

const prefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
const isDark = () => app.settings.theme === 'dark' || (app.settings.theme === 'auto' && prefersDark());

function updateThemeToggle() {
    const b = $('.theme-toggle');
    b.setAttribute('aria-pressed', String(isDark()));
    b.setAttribute('aria-label', t('theme.toggle'));
    b.title = t('theme.toggle');
    $('.theme-toggle__text', b).textContent = t('theme.toggle');
}

function toggleTheme() {
    app.settings.theme = isDark() ? 'light' : 'dark';
    persistSettings();
    applyDisplaySettings();
    updateThemeToggle();
    if (app.view === 'settings') renderSettings();
}

function showView(view) {
    if (app.view === 'train' && view !== 'train') pauseTimer();
    app.view = view;
    for (const b of $$('.nav button')) {
        if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    }
    for (const sec of $$('.view')) sec.hidden = sec.id !== 'view-' + view;
    if (view === 'progress') renderProgress();
    if (view === 'history') renderHistory();
    if (view === 'settings') renderSettings();
    if (view === 'about') renderAbout();
    if (view === 'guide') renderGuide($('#view-guide'), lang(), { onTrain: () => showView('train') });
    updateWakeLock();
    if (view === 'train') {
        renderTrainChrome();
        // settings changed while away: drop a question of a type that is no longer enabled
        if (app.phase === 'question' && app.q && !app.bench && !playableTypes(app.settings).includes(app.q.type)) nextQuestion();
        else resumeTimer();
    }
    $('#main').focus({ preventScroll: true });
}

// ---------------------------------------------------------------- training view

function renderTrainChrome() {
    const v = $('#view-train');
    $('h1', v).textContent = t('nav.train');
    $('.stat--score .stat__label', v).textContent = t('train.score');
    $('.stat--acc .stat__label', v).textContent = t('train.accuracy');
    $('.stat--session .stat__label', v).textContent = t('train.session');
    $('.stat--week .stat__label', v).textContent = t('train.week');
    $('.end-session', v).textContent = t('btn.endSession');
    $('.label--premises', v).textContent = t('train.premisesHeading');
    $('.label--conclusion', v).textContent = t('train.conclusionHeading');
    $('.question__prompt', v).textContent = t('train.question');
    $('.btn--true .btn__text', v).textContent = t('btn.true');
    $('.btn--false .btn__text', v).textContent = t('btn.false');
    $('.label--category', v).textContent = t('hist.type');
    $('.label--level', v).textContent = t('train.premisesHeading');
    $('.step-prev', v).textContent = '↑ ' + t('btn.prevPremise');
    $('.step-next', v).textContent = t('btn.nextPremise') + ' ↓';
    $('.reveal-btn__text', v).textContent = t('btn.reveal');
    $('.timer', v).setAttribute('aria-label', t('set.timer'));
    $('.bench-abort', v).textContent = t('bench.abort');
    updateStatusbar();
    if (app.q) renderQuestion(false);
    if (app.phase === 'feedback' && app.lastFeedback) renderFeedback(app.lastFeedback);
}

function updateStatusbar() {
    const v = $('#view-train');
    $('.stat--score .stat__value', v).textContent = app.state.score.toLocaleString(lang());
    $('.stat--acc .stat__value', v).textContent = fmtPct(summary(app.answers).accuracy);
    const active = app.session ? app.session.active : 0;
    $('.stat--session .stat__value', v).innerHTML = `${fmtClock(active)}<small> / ${app.settings.sessionMinutes}:00</small>`;
    $('.stat--week .stat__value', v).innerHTML = `${sessionsThisWeek(app.sessions)}<small> / ${app.settings.weeklyGoal}</small>`;
    $('.stat--week', v).title = t('train.weekValue', { n: sessionsThisWeek(app.sessions), goal: app.settings.weeklyGoal });
    $('.end-session', v).hidden = !app.session;
    updateProgramBlock();
    renderNotices();
    const bb = $('.bench-banner', v);
    bb.hidden = !app.bench;
    if (app.bench) $('.bench-banner__text', v).textContent = t('bench.counter', { i: Math.min(app.bench.index + 1, BENCH_SIZE), n: BENCH_SIZE });
}

// ---------------------------------------------------------------- guided programme

function startProgram() {
    app.state.programStart = Date.now();
    app.state.programStage = 1;
    app.settings = stageSettings(1, app.settings);
    persistSettings();
    saveState(app.state);
}

function benchDue() {
    const last = app.benchmarks[app.benchmarks.length - 1];
    if (app.settings.program && (!last || last.t < app.state.programStart)) return true;
    return !last || Date.now() - last.t > 14 * 864e5;
}

/** After an answer: move to the next stage when sessions and accuracy allow it. */
function checkProgram() {
    if (!app.settings.program) return 0;
    const cur = app.state.programStage || 1;
    const next = nextStage(cur, app.sessions, app.answers, app.state.programStart);
    if (next === cur) return 0;
    app.state.programStage = next;
    app.settings = stageSettings(next, app.settings);
    persistSettings();
    saveState(app.state);
    return next;
}

function updateProgramBlock() {
    const box = $('.program-block');
    box.hidden = !app.settings.program;
    if (!app.settings.program) return;
    const n = app.state.programStage || 1;
    $('.program-block__title', box).textContent = t('program.stage', { n, total: STAGE_COUNT });
    $('.program-block__desc', box).textContent = t('program.s' + n);
    const b = $('.program-bench', box);
    b.hidden = !benchDue() || !!app.bench;
    b.textContent = t('bench.start');
}

// ---------------------------------------------------------------- notices & device

function dismissed() {
    try { return JSON.parse(localStorage.getItem('srr-dismissed') || '{}') || {}; } catch { return {}; }
}
function dismiss(id) {
    const d = dismissed(); d[id] = true;
    try { localStorage.setItem('srr-dismissed', JSON.stringify(d)); } catch { /* ignore */ }
    renderNotices();
}

/** First-run hints: the guide for newcomers, Home Screen install on iOS. */
function renderNotices() {
    const box = $('.notices');
    const trained = app.answers.filter(a => !a.bench).length;
    const d = dismissed();
    const items = [];
    if (trained < 10 && !d.guide) items.push({ id: 'guide', text: t('notice.guide'), action: t('notice.openGuide'), run: () => showView('guide') });
    if (isIOS() && !isStandalone() && trained >= 20 && !d.ios) items.push({ id: 'ios', text: t('notice.ios') });
    const key = items.map(i => i.id).join(',') + '|' + lang();
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.innerHTML = items.map(i => `<div class="notice notice--hint" data-id="${i.id}"><p>${escapeHtml(i.text)}</p><div class="btn-row">${i.action ? `<button type="button" class="btn btn--small btn--primary" data-act="go">${escapeHtml(i.action)}</button>` : ''}<button type="button" class="btn btn--small" data-act="dismiss">${escapeHtml(t('btn.dismiss'))}</button></div></div>`).join('');
    for (const el of $$('.notice--hint', box)) {
        const item = items.find(i => i.id === el.dataset.id);
        el.querySelector('[data-act="dismiss"]').onclick = () => dismiss(item.id);
        const go = el.querySelector('[data-act="go"]');
        if (go) go.onclick = () => { dismiss(item.id); item.run(); };
    }
}

function updateWakeLock() {
    keepAwake(app.settings.keepAwake && app.view === 'train' && !document.hidden && !!(app.session || app.bench));
}

function makeCtx() {
    const s = app.settings;
    return {
        settings: { enabled: s.enabled, negation: s.negation, meta: s.meta, ops: s.ops, nestedDepth: s.nestedDepth, premiseOrder: s.premiseOrder },
        pool: createWordPool(s.lang, s.words),
    };
}

function nextQuestion() {
    clearTimeout(app.autoNextHandle);
    stopTimer();
    app.lastFeedback = null;
    $('.feedback').hidden = true;
    let type, level;
    if (app.bench) {
        if (app.bench.index >= BENCH_SIZE) return finishBench();
        type = app.bench.list[app.bench.index];
        level = MIN_LEVEL[type] === 4 ? 4 : 3;
    } else {
        const types = playableTypes(app.settings);
        if (!types.length) { renderEmpty(); return; }
        type = chooseType(types, app.settings, app.answers, app.lastType);
        level = currentLevel(app.state, type, app.settings);
    }
    app.lastType = type;
    if (type === 'sorting') {
        const task = makeSortingTask(level + 2, app.settings.sortingWidth);
        app.q = { type: 'sorting', level, task };
    } else {
        const ctx = makeCtx();
        if (app.bench) ctx.settings = { ...ctx.settings, enabled: BENCH_TYPES, ops: OPS, nestedDepth: 0, meta: false, premiseOrder: 'scrambled' };
        if (app.bench) ctx.pool = createWordPool(lang(), 'nonsense');
        app.q = generateQuestion(type, level, ctx);
        app.q.style = app.bench ? 'sentences' : app.settings.premiseStyle;
        app.q.stroop = !app.bench && app.settings.stroop && coin();
        app.q.swap = app.settings.shuffleButtons && coin();
    }
    app.step = 0;
    app.phase = 'question';
    document.body.dataset.phase = 'question';
    renderQuestion(true);
    const limit = app.bench ? 60 : timeLimit(type, level, app.settings, app.answers);
    startTimer(limit);
    app.startedAt = performance.now();
    updateStatusbar();
}

function renderEmpty() {
    app.q = null; app.phase = 'idle'; document.body.dataset.phase = 'idle';
    const card = $('.question');
    card.hidden = false;
    $('.question__body').hidden = true;
    $('.question__empty').hidden = false;
    $('.question__empty').textContent = t('train.noTypes');
    $('.timer').hidden = true;
}

function renderQuestion(fresh) {
    const q = app.q;
    const card = $('.question');
    $('.question__empty').hidden = true;
    $('.question__body').hidden = false;
    $('.question__type').textContent = t('type.' + q.type);
    $('.question__subtype').textContent = q.subtype ? t('type.' + q.subtype) : '';
    $('.question__subtype').hidden = !q.subtype;
    $('.side-block--level').hidden = q.type === 'sorting';
    $('.question__level').textContent = q.type === 'sorting' ? '' : String(q.premises.length).padStart(2, '0');
    $('.question__level').setAttribute('aria-label', q.type === 'sorting' ? '' : t('train.premises', { n: q.premises.length }));
    const sortHost = $('.sorting-host');
    const isSort = q.type === 'sorting';
    $('.question__text').hidden = isSort;
    sortHost.hidden = !isSort;
    if (isSort) {
        if (fresh || !app.sorting) {
            app.sorting = renderSorting(sortHost, q.task, { onSolved: (moves) => answer(true, { moves }), announce });
        }
        return;
    }
    app.sorting = null;
    card.classList.toggle('stroop', !!q.stroop);
    $('.neg-reminder').hidden = !(app.settings.negationReminder && hasNegation(q));
    $('.neg-reminder').textContent = t('train.negationReminder');

    const L = lang();
    const list = $('.premises');
    const style = q.style || app.settings.premiseStyle;
    list.innerHTML = q.premises.map((p, i) => `<li data-i="${i}">${renderStatement(p, L, style)}</li>`).join('');
    $('.conclusion').innerHTML = renderStatement(q.conclusion, L, style);
    $('.question__text').classList.toggle('is-symbols', style === 'symbols');
    const key = $('.sym-key');
    key.hidden = style !== 'symbols';
    if (style === 'symbols') {
        $('.sym-key__title', key).textContent = t('sym.key');
        $('.sym-key__list', key).innerHTML = symbolKey([...q.premises, q.conclusion], L)
            .map(k => `<div class="sym-key__row"><dt>${k.symbol}</dt><dd>${k.sentence}</dd></div>`).join('');
    }

    const legend = $('.legend');
    if (q.conclusion.kind === 'tree') {
        const ops = [...opsInTree(q.conclusion.tree)];
        legend.hidden = false;
        legend.innerHTML = `<span class="legend__title">${t('train.legend')}:</span> ` + ops.map(o => `<span class="legend__item"><b>${escapeHtml(renderOpName(o, style))}</b> = ${escapeHtml(t('op.' + o))}</span>`).join(' · ');
    } else legend.hidden = true;

    // answer buttons: DOM order matters for keyboard users, so swap the nodes
    const answers = $('.answers');
    const tb = $('.btn--true'), fb = $('.btn--false');
    if (q.swap) answers.append(fb, tb); else answers.append(tb, fb);
    updateAnswerKeys();
    updateStepper();
}

/** ← picks the left button, → the right one, whatever their meaning. */
function updateAnswerKeys() {
    const [left, right] = [...$('.answers').children];
    $('.kbd', left).textContent = '←';
    $('.kbd', right).textContent = '→';
    left.setAttribute('aria-keyshortcuts', 'ArrowLeft');
    right.setAttribute('aria-keyshortcuts', 'ArrowRight');
    $('#view-train .keys').textContent = t('train.keys', { left: $('.btn__text', left).textContent, right: $('.btn__text', right).textContent });
}

const renderOpName = (op, style) => opName(op, lang(), style);

// Premise display modes (not during a check-up):
//  - one at a time: step i shows premise i; step n shows the conclusion;
//  - hide premises: once the conclusion is shown the premises disappear and
//    cannot be shown again until the answer is given.
const oneMode = () => app.settings.oneAtATime && !app.bench && app.q && app.q.premises;
const hideMode = () => app.settings.hidePremises && !app.bench && app.q && app.q.premises;

function updateStepper() {
    const q = app.q;
    if (!q || !q.premises) return;
    const asking = app.phase === 'question';
    const one = oneMode(), hide = hideMode();
    const total = q.premises.length;
    const atConclusion = !asking || (!one && !hide) || app.step >= total;
    const items = $$('.premises li');
    items.forEach((li, i) => {
        let visible = true;
        if (asking && one) visible = i === app.step;
        if (asking && hide && app.step >= total) visible = false;
        li.hidden = !visible;
    });
    $('.label--premises').hidden = asking && hide && app.step >= total;
    $('.stepper').hidden = !(asking && one);
    $('.reveal').hidden = !(asking && hide && !one && app.step < total);
    $('.conclusion-block').hidden = !atConclusion;
    $('.btn--true').disabled = !atConclusion || !asking;
    $('.btn--false').disabled = !atConclusion || !asking;
    if (asking && one) {
        $('.step-counter').textContent = app.step < total
            ? t('train.premiseCounter', { i: app.step + 1, n: total })
            : t('train.conclusionHeading');
        $('.step-prev').disabled = app.step === 0 || (hide && app.step >= total);
        $('.step-next').disabled = app.step >= total;
        $('.step-next').textContent = (app.step === total - 1 ? t('btn.reveal') : t('btn.nextPremise')) + ' ↓';
    }
}

function step(d) {
    if (!app.q || !app.q.premises || app.phase !== 'question') return;
    const one = oneMode(), hide = hideMode();
    if (!one && !hide) return;
    const total = app.q.premises.length;
    if (hide && app.step >= total) return; // no going back once the conclusion is shown
    if (one) app.step = Math.max(0, Math.min(total, app.step + d));
    else if (d > 0) app.step = total;
    else return;
    updateStepper();
    if (app.step >= total) {
        announce(toText($('.conclusion').innerHTML));
        const first = $('.answers').firstElementChild;
        if (document.activeElement && (document.activeElement.classList.contains('reveal-btn') || document.activeElement.classList.contains('step-next'))) first.focus();
    } else {
        announce(toText($$('.premises li')[app.step].innerHTML));
    }
}

// ---------------------------------------------------------------- timer

function startTimer(limit) {
    const box = $('.timer');
    stopTimer();
    if (!limit) { box.hidden = true; app.timer = null; return; }
    box.hidden = false;
    box.setAttribute('aria-valuemax', String(limit));
    app.timer = { limit, remainingMs: limit * 1000, lastTick: performance.now(), handle: null, warned: false };
    app.timer.handle = setInterval(tick, 200);
    drawTimer();
}

function tick() {
    const tm = app.timer;
    if (!tm) return;
    const now = performance.now();
    tm.remainingMs -= now - tm.lastTick;
    tm.lastTick = now;
    if (!tm.warned && tm.remainingMs <= 10000 && tm.limit > 15) { tm.warned = true; announce(t('timer.left', { n: 10 })); }
    drawTimer();
    if (tm.remainingMs <= 0) answer(null);
}

function drawTimer() {
    const tm = app.timer;
    if (!tm) return;
    const secs = Math.max(0, Math.ceil(tm.remainingMs / 1000));
    const box = $('.timer');
    box.setAttribute('aria-valuenow', String(secs));
    box.setAttribute('aria-valuetext', t('timer.left', { n: secs }));
    $('.timer__bar').style.width = Math.max(0, (tm.remainingMs / (tm.limit * 1000)) * 100) + '%';
    $('.timer__text').textContent = t('unit.s', { n: secs });
    box.classList.toggle('is-low', tm.remainingMs < 0.25 * tm.limit * 1000);
}

function stopTimer() {
    if (app.timer && app.timer.handle) clearInterval(app.timer.handle);
    if (app.timer) app.timer.handle = null;
}
function pauseTimer() { if (app.phase === 'question') stopTimer(); app.pausedAt = performance.now(); }
function resumeTimer() {
    if (app.phase !== 'question') return;
    if (app.pausedAt) app.startedAt += performance.now() - app.pausedAt; // paused time does not count
    app.pausedAt = 0;
    if (app.timer && !app.timer.handle) { app.timer.lastTick = performance.now(); app.timer.handle = setInterval(tick, 200); }
}

// ---------------------------------------------------------------- answering

function touchSession(rt) {
    const now = Date.now();
    if (!app.session || now - app.session.last > SESSION_GAP) {
        app.session = { id: now, start: now, last: now, active: 0, answers: 0, correct: 0, levelChanges: [], summarized: false };
        app.sessions.push(app.session);
    }
    app.session.last = now;
    app.session.active += Math.min(rt, 5 * 60 * 1000);
    return app.session;
}

async function answer(value, extra = {}) {
    if (app.phase !== 'question') return; // ignores double clicks and late timeouts
    app.phase = 'feedback';
    document.body.dataset.phase = 'feedback';
    stopTimer();
    if (app.sorting && value === null) app.sorting.stop();
    const q = app.q;
    const rt = Math.max(0, Math.round(performance.now() - app.startedAt));
    const isSort = q.type === 'sorting';
    const timedOut = value === null;
    const correct = isSort ? !timedOut : value === q.isValid;

    let levelChange = 0;
    const session = app.bench ? null : touchSession(rt);
    if (!app.bench) {
        app.state.score += correct ? 1 : -1;
        if (app.settings.adaptive) levelChange = updateLevel(app.state, q.type, correct, app.settings);
        saveState(app.state);
        session.answers++; if (correct) session.correct++;
        if (levelChange) session.levelChanges.push({ type: q.type, change: levelChange, level: app.state.levels[q.type].level });
        put('sessions', { ...session });
    }
    const record = {
        t: Date.now(), type: q.type, sub: q.subtype || null, level: isSort ? q.task.order.length : q.premises.length,
        correct, timedOut, answer: isSort ? null : value, isValid: isSort ? true : q.isValid, rt,
        session: session ? session.id : null, bench: !!app.bench,
        q: isSort ? { rule: q.task.rule, moves: extra.moves || 0 } : { premises: q.premises, conclusion: q.conclusion, model: q.model, isValid: q.isValid, type: q.type, subtype: q.subtype },
    };
    app.answers.push(record);
    put('answers', record);
    const programStage = app.bench ? 0 : checkProgram();
    if (!app.persistAsked) { app.persistAsked = true; requestPersistence(); }
    if (app.settings.vibrate && !app.bench) vibrate(correct ? 15 : [40, 60, 40]);
    updateWakeLock();

    if (app.bench) {
        app.bench.answers.push(record);
        app.bench.index++;
        setTimeout(nextQuestion, 150);
        return;
    }

    const fb = { correct, timedOut, levelChange, q, record, programStage };
    app.lastFeedback = fb;
    renderFeedback(fb);
    updateStatusbar();

    if (session && !session.summarized && session.active >= app.settings.sessionMinutes * 60 * 1000) {
        session.summarized = true;
        put('sessions', { ...session });
        showSummary(session);
        return;
    }
    if (correct && app.settings.autoNext && !app.settings.explainAlways && !isSort && !programStage) {
        app.autoNextHandle = setTimeout(() => { if (app.phase === 'feedback' && app.view === 'train') nextQuestion(); }, app.settings.reduceMotion ? 1200 : 900);
    }
}

function renderFeedback(fb) {
    const box = $('.feedback');
    const { correct, timedOut, levelChange, q } = fb;
    box.hidden = false;
    box.className = 'feedback card ' + (correct ? 'is-right' : 'is-wrong');
    const status = timedOut && !correct ? t('fb.timeout') : correct ? t('fb.correct') : t('fb.wrong');
    let html = `<p class="feedback__status"><span class="feedback__icon" aria-hidden="true">${correct ? '✓' : '✗'}</span> ${escapeHtml(status)}</p>`;
    if (q.type === 'sorting') {
        html += `<p>${escapeHtml(t('sort.solved'))} <strong>${escapeHtml(ruleText(q.task.rule))}</strong></p>`;
    } else {
        html += `<p>${escapeHtml(t('fb.answer', { answer: answerWord(q.isValid) }))}</p>`;
    }
    if (fb.programStage) html += `<p class="notice program-notice">${escapeHtml(t('program.advanced', { n: fb.programStage, total: STAGE_COUNT, desc: t('program.s' + fb.programStage) }))}</p>`;
    if (levelChange) html += `<p class="feedback__level">${escapeHtml(t(levelChange > 0 ? 'fb.levelUp' : 'fb.levelDown', { n: app.state.levels[q.type].level }))}</p>`;
    const showExplain = q.type !== 'sorting' && (!correct || app.settings.explainAlways);
    if (showExplain) {
        html += `<details class="feedback__explain" open><summary>${escapeHtml(t('ex.title'))}</summary>${hasNegation(q) ? `<p class="muted small">${escapeHtml(t('ex.negation'))}</p>` : ''}${explain(q, lang())}</details>`;
    } else if (q.type !== 'sorting') {
        html += `<details class="feedback__explain"><summary>${escapeHtml(t('btn.explanation'))}</summary>${explain(q, lang())}</details>`;
    }
    html += `<div class="feedback__actions"><button type="button" class="btn btn--primary next-btn">${escapeHtml(t('btn.next'))} <span class="kbd" aria-hidden="true">Enter</span></button></div>`;
    box.innerHTML = html;
    $('.next-btn', box).onclick = nextQuestion;
    $('.btn--true').disabled = true; $('.btn--false').disabled = true;
    updateStepper();
    announce(`${status}. ${q.type === 'sorting' ? '' : t('fb.answer', { answer: answerWord(q.isValid) })}`);
    if (!(correct && app.settings.autoNext && !app.settings.explainAlways) || fb.programStage) $('.next-btn', box).focus({ preventScroll: false });
}

// ---------------------------------------------------------------- sessions

function showSummary(session) {
    const dlg = $('#summary');
    const list = app.answers.filter(a => a.session === session.id);
    const acc = list.length ? list.filter(a => a.correct).length / list.length : null;
    const changes = session.levelChanges.length
        ? session.levelChanges.map(c => `${t('type.' + c.type)} ${c.change > 0 ? '↑' : '↓'} ${c.level}`).join(', ')
        : t('sum.none');
    dlg.innerHTML = `<h2 id="summary-title">${escapeHtml(t('sum.title'))}</h2>
        <dl class="kv">
          <dt>${escapeHtml(t('sum.answers'))}</dt><dd>${list.length}</dd>
          <dt>${escapeHtml(t('sum.accuracy'))}</dt><dd>${fmtPct(acc)}</dd>
          <dt>${escapeHtml(t('sum.median'))}</dt><dd>${escapeHtml(t('unit.s', { n: fmtSec(median(list.map(a => a.rt)) / 1000) }))}</dd>
          <dt>${escapeHtml(t('sum.levels'))}</dt><dd>${escapeHtml(changes)}</dd>
        </dl>
        <p>${escapeHtml(t('sum.rest'))}</p>
        <p class="summary-tea small">${escapeHtml(t('tea.text'))} ${teaButton('tea--small')}</p>
        <div class="dialog__actions">
          <button type="button" class="btn" data-act="close">${escapeHtml(t('btn.close'))}</button>
          <button type="button" class="btn btn--primary" data-act="continue">${escapeHtml(t('btn.continue'))}</button>
        </div>`;
    dlg.querySelector('[data-act="close"]').onclick = () => { dlg.close(); app.session = null; updateStatusbar(); };
    dlg.querySelector('[data-act="continue"]').onclick = () => { dlg.close(); if (app.phase === 'feedback') nextQuestion(); };
    dlg.showModal();
}

function endSession() {
    if (!app.session) return;
    const s = app.session;
    s.summarized = true;
    put('sessions', { ...s });
    showSummary(s);
}

// ---------------------------------------------------------------- check-up

function startBench() {
    const list = shuffle([...BENCH_TYPES, ...BENCH_TYPES, pick(BENCH_TYPES), pick(BENCH_TYPES)]);
    app.bench = { list, index: 0, answers: [], started: Date.now() };
    showView('train');
    nextQuestion();
}

function abortBench() {
    app.bench = null;
    nextQuestion();
}

function finishBench() {
    const b = app.bench;
    app.bench = null;
    const score = b.answers.filter(a => a.correct).length / b.answers.length;
    const med = median(b.answers.map(a => a.rt)) / 1000;
    const rec = { t: Date.now(), score, median: med, n: b.answers.length };
    app.benchmarks.push(rec);
    put('benchmarks', rec);
    app.q = null; app.phase = 'idle'; document.body.dataset.phase = 'idle';
    $('.question__body').hidden = true;
    $('.question__empty').hidden = false;
    $('.question__empty').textContent = t('bench.done', { score: Math.round(score * 100), time: fmtSec(med) });
    $('.timer').hidden = true;
    const box = $('.feedback');
    box.hidden = false;
    box.className = 'feedback card';
    box.innerHTML = `<div class="feedback__actions"><button type="button" class="btn btn--primary next-btn">${escapeHtml(t('btn.continue'))}</button></div>`;
    $('.next-btn', box).onclick = nextQuestion;
    app.phase = 'feedback';
    updateStatusbar();
    announce($('.question__empty').textContent);
    $('.next-btn', box).focus();
}

// ---------------------------------------------------------------- progress view

function renderProgress() {
    const v = $('#view-progress');
    const sum = summary(app.answers);
    const types = TYPES.filter(tp => app.settings.enabled.includes(tp) || app.answers.some(a => a.type === tp && !a.bench));
    const cats = byCategory(app.answers, types);
    const series = sessionSeries(app.answers, app.sessions);
    const lastBench = app.benchmarks[app.benchmarks.length - 1];
    const due = !lastBench || Date.now() - lastBench.t > 14 * 864e5;
    const weekly = weeklyMinutes(app.sessions);
    const perPremise = secondsPerPremise(app.answers, app.sessions);

    v.innerHTML = `<h1>${escapeHtml(t('prog.title'))}</h1>
      <div class="kpis">
        ${kpi(t('prog.answers'), sum.total.toLocaleString(lang()))}
        ${kpi(t('prog.accuracy'), fmtPct(sum.accuracy))}
        ${kpi(t('prog.median'), sum.median === null ? '–' : t('unit.s', { n: fmtSec(sum.median) }))}
        ${kpi(t('prog.week'), t('train.weekValue', { n: sessionsThisWeek(app.sessions), goal: app.settings.weeklyGoal }))}
      </div>
      <section class="card">
        <h2>${escapeHtml(t('prog.byCategory'))}</h2>
        <div class="cat-bars"></div>
        <details><summary>${escapeHtml(t('prog.table'))}</summary>
          <table class="data"><thead><tr><th scope="col">${escapeHtml(t('prog.col.category'))}</th><th scope="col">${escapeHtml(t('prog.col.level'))}</th><th scope="col">${escapeHtml(t('prog.col.accuracy'))}</th><th scope="col">${escapeHtml(t('prog.col.median'))}</th><th scope="col">${escapeHtml(t('prog.col.answers'))}</th></tr></thead>
          <tbody>${cats.map(c => `<tr><th scope="row">${escapeHtml(t('type.' + c.type))}</th><td>${currentLevel(app.state, c.type, app.settings)}</td><td>${fmtPct(c.accuracy)}</td><td>${c.median === null ? '–' : escapeHtml(t('unit.s', { n: fmtSec(c.median) }))}</td><td>${c.count}</td></tr>`).join('')}</tbody></table>
        </details>
      </section>
      <section class="card">
        <h2>${escapeHtml(t('prog.sessions'))}</h2>
        ${series.length ? `<div class="session-chart"></div>
        <details><summary>${escapeHtml(t('prog.table'))}</summary><table class="data"><thead><tr><th scope="col">${escapeHtml(t('prog.date'))}</th><th scope="col">${escapeHtml(t('prog.value'))}</th><th scope="col">${escapeHtml(t('prog.col.answers'))}</th></tr></thead><tbody>${series.map(s => `<tr><td>${escapeHtml(fmtDateTime(s.t))}</td><td>${fmtPct(s.value)}</td><td>${s.n}</td></tr>`).join('')}</tbody></table></details>`
        : `<p class="muted">${escapeHtml(t('prog.empty'))}</p>`}
      </section>
      <section class="card">
        <h2>${escapeHtml(t('prog.weekly'))}</h2>
        <div class="weekly-chart"></div>
        <details><summary>${escapeHtml(t('prog.table'))}</summary><table class="data"><thead><tr><th scope="col">${escapeHtml(t('prog.date'))}</th><th scope="col">${escapeHtml(t('prog.minutes', { n: '' }).trim() || 'min')}</th></tr></thead><tbody>${weekly.map(w => `<tr><td>${escapeHtml(t('prog.weekOf', { date: fmtDate(w.t) }))}</td><td>${w.minutes}</td></tr>`).join('')}</tbody></table></details>
      </section>
      <section class="card">
        <h2>${escapeHtml(t('prog.perPremise'))}</h2>
        ${perPremise.length ? `<div class="premise-chart"></div>
        <details><summary>${escapeHtml(t('prog.table'))}</summary><table class="data"><thead><tr><th scope="col">${escapeHtml(t('prog.date'))}</th><th scope="col">${escapeHtml(t('prog.secPerPremise'))}</th></tr></thead><tbody>${perPremise.map(s => `<tr><td>${escapeHtml(fmtDateTime(s.t))}</td><td>${fmtSec(s.value)}</td></tr>`).join('')}</tbody></table></details>`
        : `<p class="muted">${escapeHtml(t('prog.empty'))}</p>`}
      </section>
      <section class="card">
        <h2>${escapeHtml(t('bench.title'))}</h2>
        <p>${escapeHtml(t('bench.desc'))}</p>
        <p class="${due ? 'notice' : 'muted'}">${escapeHtml(lastBench ? t('bench.last', { date: fmtDate(lastBench.t) }) : '')} ${due ? escapeHtml(t('bench.due')) : ''}</p>
        <p><button type="button" class="btn btn--primary bench-start">${escapeHtml(t('bench.start'))}</button></p>
        ${app.benchmarks.length ? `<h3>${escapeHtml(t('prog.benchmark'))}</h3><div class="bench-chart"></div>
        <details><summary>${escapeHtml(t('prog.table'))}</summary><table class="data"><thead><tr><th scope="col">${escapeHtml(t('prog.date'))}</th><th scope="col">${escapeHtml(t('prog.value'))}</th><th scope="col">${escapeHtml(t('prog.col.median'))}</th></tr></thead><tbody>${app.benchmarks.map(b => `<tr><td>${escapeHtml(fmtDate(b.t))}</td><td>${fmtPct(b.score)}</td><td>${escapeHtml(t('unit.s', { n: fmtSec(b.median) }))}</td></tr>`).join('')}</tbody></table></details>` : ''}
      </section>`;
    barList($('.cat-bars', v), cats.map(c => ({
        label: `${t('type.' + c.type)} · ${t('prog.col.level')} ${currentLevel(app.state, c.type, app.settings)}`,
        value: c.accuracy, text: fmtPct(c.accuracy),
        detail: `${t('prog.col.answers')}: ${c.count}${c.median === null ? '' : ' · ' + t('prog.col.median') + ': ' + t('unit.s', { n: fmtSec(c.median) })}`,
    })));
    if (series.length) lineChart($('.session-chart', v), series.map((s, i) => ({ label: fmtDate(s.t), value: s.value, detail: `${t('prog.session', { n: i + 1 })} · ${s.n} ${t('prog.col.answers').toLowerCase()}` })), { ariaLabel: t('prog.sessions') });
    if (app.benchmarks.length) lineChart($('.bench-chart', v), app.benchmarks.map(b => ({ label: fmtDate(b.t), value: b.score, detail: t('unit.s', { n: fmtSec(b.median) }) })), { ariaLabel: t('prog.benchmark') });
    $('.bench-start', v).onclick = startBench;
    columnChart($('.weekly-chart', v), weekly.map(w => ({ label: fmtDate(w.t), value: w.minutes, detail: t('prog.weekOf', { date: fmtDate(w.t) }) })), { ariaLabel: t('prog.weekly'), format: (n) => t('prog.minutes', { n: Math.round(n) }) });
    if (perPremise.length) {
        const maxS = Math.max(5, Math.ceil(Math.max(...perPremise.map(p => p.value))));
        lineChart($('.premise-chart', v), perPremise.map(p => ({ label: fmtDate(p.t), value: p.value })), { ariaLabel: t('prog.perPremise'), max: maxS, format: (n) => t('unit.s', { n: fmtSec(n) }) });
    }
    v.append(renderTestLog());
}

// ---------------------------------------------------------------- external tests

function renderTestLog() {
    const sec = document.createElement('section');
    sec.className = 'card testlog';
    const names = [...new Set(app.tests.map(r => r.name))];
    const today = new Date().toISOString().slice(0, 10);
    const groups = names.map(name => {
        const rows = app.tests.filter(r => r.name === name).sort((a, b) => a.t - b.t);
        return `<h3>${escapeHtml(name)}</h3>
          <table class="data"><thead><tr><th scope="col">${escapeHtml(t('tl.date'))}</th><th scope="col">${escapeHtml(t('tl.score'))}</th><th scope="col">${escapeHtml(t('tl.change'))}</th><th scope="col">${escapeHtml(t('tl.training'))}</th><th scope="col">${escapeHtml(t('tl.notes'))}</th><th scope="col"><span class="sr-only">${escapeHtml(t('tl.delete'))}</span></th></tr></thead>
          <tbody>${rows.map((r, i) => {
            const prev = rows[i - 1];
            const diff = i === 0 ? t('tl.first') : (r.score - rows[0].score > 0 ? '+' : '') + (Math.round((r.score - rows[0].score) * 100) / 100).toLocaleString(lang());
            const soon = prev && r.t - prev.t < 90 * 864e5;
            const trained = prev ? t('prog.minutes', { n: minutesBetween(app.sessions, prev.t, r.t) }) : '–';
            return `<tr><td>${escapeHtml(fmtDate(r.t))}</td><td>${escapeHtml(String(r.score))}</td><td>${escapeHtml(diff)}${soon ? ' <span class="tl-soon" title="' + escapeHtml(t('tl.tooSoon')) + '">*</span>' : ''}</td><td>${escapeHtml(trained)}</td><td>${escapeHtml(r.notes || '')}</td><td><button type="button" class="btn btn--small" data-del="${r.id}">${escapeHtml(t('tl.delete'))}</button></td></tr>`;
          }).join('')}</tbody></table>
          ${rows.some((r, i) => i > 0 && r.t - rows[i - 1].t < 90 * 864e5) ? `<p class="small muted">* ${escapeHtml(t('tl.tooSoon'))}</p>` : ''}`;
    }).join('');
    sec.innerHTML = `<h2>${escapeHtml(t('tl.title'))}</h2>
      <p>${escapeHtml(t('tl.desc'))}</p>
      <form class="tl-form">
        <div class="tl-grid">
          <div class="field"><label for="tl-name">${escapeHtml(t('tl.name'))}</label><input id="tl-name" name="name" list="tl-names" required maxlength="60" autocomplete="off"><datalist id="tl-names">${names.map(n => `<option value="${escapeHtml(n)}"></option>`).join('')}</datalist></div>
          <div class="field"><label for="tl-date">${escapeHtml(t('tl.date'))}</label><input id="tl-date" name="date" type="date" required value="${today}" max="${today}"></div>
          <div class="field"><label for="tl-score">${escapeHtml(t('tl.score'))}</label><input id="tl-score" name="score" type="number" step="any" required></div>
          <div class="field"><label for="tl-notes">${escapeHtml(t('tl.notes'))}</label><input id="tl-notes" name="notes" maxlength="200"></div>
        </div>
        <button type="submit" class="btn btn--primary">${escapeHtml(t('tl.add'))}</button>
      </form>
      ${groups || `<p class="muted">${escapeHtml(t('tl.empty'))}</p>`}`;
    $('.tl-form', sec).onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        const score = Number(f.score.value);
        const name = f.name.value.trim();
        const when = Date.parse(f.date.value + 'T12:00:00');
        if (!name || !Number.isFinite(score) || !Number.isFinite(when)) return;
        const rec = { name, t: when, score, notes: f.notes.value.trim() };
        await put('tests', rec);
        app.tests.push(rec);
        app.tests.sort((a, b) => a.t - b.t);
        renderProgress();
        announce(t('set.saved'));
        $('#tl-name')?.focus();
    };
    for (const b of $$('[data-del]', sec)) b.onclick = async () => {
        const id = Number(b.dataset.del);
        await remove('tests', id);
        app.tests = app.tests.filter(r => r.id !== id);
        renderProgress();
    };
    return sec;
}

const kpi = (label, value) => `<div class="kpi"><div class="kpi__value">${escapeHtml(value)}</div><div class="kpi__label">${escapeHtml(label)}</div></div>`;

// ---------------------------------------------------------------- history view

const histState = { type: 'all', result: 'all', shown: 30 };

function renderHistory() {
    const v = $('#view-history');
    const opt = (val, label, cur) => `<option value="${val}"${val === cur ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    const list = app.answers.filter(a => !a.bench)
        .filter(a => histState.type === 'all' || a.type === histState.type)
        .filter(a => histState.result === 'all' || (histState.result === 'right' ? a.correct : histState.result === 'timeout' ? a.timedOut : !a.correct))
        .reverse();
    v.innerHTML = `<h1>${escapeHtml(t('hist.title'))}</h1>
      <div class="filters">
        <label>${escapeHtml(t('hist.type'))} <select class="f-type">${opt('all', t('hist.all'), histState.type)}${TYPES.map(tp => opt(tp, t('type.' + tp), histState.type)).join('')}</select></label>
        <label>${escapeHtml(t('hist.result'))} <select class="f-result">${opt('all', t('hist.all'), histState.result)}${opt('right', t('hist.right'), histState.result)}${opt('wrong', t('hist.wrong'), histState.result)}${opt('timeout', t('hist.timeout'), histState.result)}</select></label>
      </div>
      ${list.length ? '' : `<p class="muted">${escapeHtml(t('hist.empty'))}</p>`}
      <ol class="history">${list.slice(0, histState.shown).map(historyItem).join('')}</ol>
      ${list.length > histState.shown ? `<p><button type="button" class="btn more">${escapeHtml(t('hist.more'))}</button></p>` : ''}`;
    $('.f-type', v).onchange = (e) => { histState.type = e.target.value; histState.shown = 30; renderHistory(); $('.f-type', v).focus(); };
    $('.f-result', v).onchange = (e) => { histState.result = e.target.value; histState.shown = 30; renderHistory(); $('.f-result', v).focus(); };
    const more = $('.more', v);
    if (more) more.onclick = () => { histState.shown += 30; renderHistory(); };
}

function historyItem(a) {
    const res = a.correct ? t('fb.correct') : a.timedOut ? t('fb.timeout') : t('fb.wrong');
    const head = `<span class="hist__icon" aria-hidden="true">${a.correct ? '✓' : '✗'}</span>
        <span class="hist__type">${escapeHtml(t('type.' + a.type))}</span>
        <span class="hist__meta">${escapeHtml(fmtDateTime(a.t))} · ${a.type === 'sorting' ? '' : escapeHtml(t('train.premises', { n: a.level })) + ' · '}${escapeHtml(t('unit.s', { n: fmtSec(a.rt / 1000) }))}</span>
        <span class="hist__res">${escapeHtml(res)}</span>`;
    let body = '';
    if (a.q && a.type === 'sorting') body = `<p>${escapeHtml(ruleText(a.q.rule))}</p>`;
    else if (a.q) {
        const L = lang();
        try {
            body = `<ol class="premises premises--small">${a.q.premises.map(p => `<li>${renderStatement(p, L)}</li>`).join('')}</ol>
              <div class="conclusion conclusion--small">${renderStatement(a.q.conclusion, L)}</div>
              <p>${escapeHtml(t('hist.yours'))}: <strong>${a.answer === null ? escapeHtml(t('hist.none')) : escapeHtml(answerWord(a.answer))}</strong> · ${escapeHtml(t('hist.correct'))}: <strong>${escapeHtml(answerWord(a.isValid))}</strong></p>
              ${explain(a.q, L)}`;
        } catch { body = ''; }
    }
    return `<li class="hist ${a.correct ? 'is-right' : 'is-wrong'}">${body ? `<details><summary>${head}</summary>${body}</details>` : `<div class="hist__row">${head}</div>`}</li>`;
}

// ---------------------------------------------------------------- settings view

let settingsTab = 'questions';

function renderSettings() {
    const v = $('#view-settings');
    const s = app.settings;
    const tabs = ['questions', 'difficulty', 'challenges', 'sessions', 'display', 'data'];
    const warnings = settingsWarnings(s);
    v.innerHTML = `<h1>${escapeHtml(t('set.title'))}</h1>
      <div class="presets"><span class="presets__label">${escapeHtml(t('set.presets'))}:</span>
        <button type="button" class="btn btn--small btn--primary" data-preset="recommended" aria-describedby="preset-rec-d">${escapeHtml(t('preset.recommended'))}</button>
        ${Object.keys(PRESETS).map(p => `<button type="button" class="btn btn--small" data-preset="${p}">${escapeHtml(t('preset.' + p))}</button>`).join('')}
      </div>
      <p class="field__desc presets__desc" id="preset-rec-d">${escapeHtml(t('set.programDesc'))}</p>
      <div class="warnings" role="status">${warnings.map(w => `<p class="notice">${escapeHtml(t(w))}</p>`).join('')}</div>
      <div class="tabs" role="tablist" aria-label="${escapeHtml(t('set.title'))}">
        ${tabs.map(tb => `<button type="button" role="tab" id="tab-${tb}" aria-controls="panel-${tb}" aria-selected="${tb === settingsTab}" tabindex="${tb === settingsTab ? 0 : -1}">${escapeHtml(t('set.tab.' + tb))}</button>`).join('')}
      </div>
      ${tabs.map(tb => `<div class="tabpanel card" role="tabpanel" id="panel-${tb}" aria-labelledby="tab-${tb}" ${tb === settingsTab ? '' : 'hidden'}>${panel(tb)}</div>`).join('')}`;

    for (const b of $$('[data-preset]', v)) b.onclick = () => {
        if (b.dataset.preset === 'recommended') startProgram();
        else { Object.assign(app.settings, PRESETS[b.dataset.preset], { program: false }); persistSettings(); }
        renderSettings();
        announce(t('preset.applied', { name: t('preset.' + b.dataset.preset) }));
    };
    const tabButtons = $$('[role="tab"]', v);
    tabButtons.forEach((b, i) => {
        b.onclick = () => { settingsTab = tabs[i]; renderSettings(); $('#tab-' + settingsTab).focus(); };
        b.onkeydown = (e) => {
            const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            settingsTab = tabs[(i + d + tabs.length) % tabs.length];
            renderSettings(); $('#tab-' + settingsTab).focus();
        };
    });
    bindSettingInputs(v);
    if (settingsTab === 'data') renderStorageStatus();
}

async function renderStorageStatus() {
    const box = $('.storage-status');
    if (!box) return;
    const persisted = await isPersisted();
    let html = `<p class="${persisted ? 'muted' : 'notice'}">${escapeHtml(t(persisted ? 'data.persisted' : 'data.notPersisted'))}</p>`;
    if (isStandalone()) html += `<p class="muted">${escapeHtml(t('data.installed'))}</p>`;
    else if (canInstall()) html += `<p><button type="button" class="btn btn--primary install-btn">${escapeHtml(t('data.install'))}</button></p>`;
    else if (isIOS()) html += `<p>${escapeHtml(t('data.iosInstall'))}</p>`;
    box.innerHTML = html;
    const b = $('.install-btn', box);
    if (b) b.onclick = async () => { await promptInstall(); renderStorageStatus(); };
}

const ctl = {
    toggle(key, labelKey, descKey) {
        const id = 'set-' + key;
        return `<div class="field field--toggle"><input type="checkbox" role="switch" id="${id}" data-key="${key}" ${app.settings[key] ? 'checked' : ''}${descKey ? ` aria-describedby="${id}-d"` : ''}>
          <label for="${id}">${escapeHtml(t(labelKey))}</label>${descKey ? `<p class="field__desc" id="${id}-d">${escapeHtml(t(descKey))}</p>` : ''}</div>`;
    },
    number(key, labelKey, min, max, descKey) {
        const id = 'set-' + key;
        return `<div class="field"><label for="${id}">${escapeHtml(t(labelKey))}</label>
          <input type="number" inputmode="numeric" id="${id}" data-key="${key}" min="${min}" max="${max}" step="1" value="${app.settings[key]}"${descKey ? ` aria-describedby="${id}-d"` : ''}>${descKey ? `<p class="field__desc" id="${id}-d">${escapeHtml(t(descKey))}</p>` : ''}</div>`;
    },
    select(key, labelKey, options, descKey) {
        const id = 'set-' + key;
        return `<div class="field"><label for="${id}">${escapeHtml(t(labelKey))}</label>
          <select id="${id}" data-key="${key}"${descKey ? ` aria-describedby="${id}-d"` : ''}>${options.map(([val, label]) => `<option value="${val}"${String(app.settings[key]) === String(val) ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>${descKey ? `<p class="field__desc" id="${id}-d">${escapeHtml(t(descKey))}</p>` : ''}</div>`;
    },
};

function panel(tab) {
    const s = app.settings;
    if (tab === 'questions') {
        return `<fieldset><legend>${escapeHtml(t('set.types'))}</legend><div class="type-grid">${TYPES.map(tp => `
          <div class="type-row">
            <div class="field field--toggle"><input type="checkbox" role="switch" id="type-${tp}" data-type="${tp}" ${s.enabled.includes(tp) ? 'checked' : ''} aria-describedby="type-${tp}-d">
              <label for="type-${tp}">${escapeHtml(t('type.' + tp))}</label><p class="field__desc" id="type-${tp}-d">${escapeHtml(t('typedesc.' + tp))}</p></div>
            <div class="field field--inline"><label for="timer-${tp}">${escapeHtml(t('set.timeLimit'))}</label>
              <input type="number" inputmode="numeric" id="timer-${tp}" data-timer="${tp}" min="5" max="600" step="1" value="${s.timers[tp]}"></div>
          </div>`).join('')}</div></fieldset>
          ${ctl.select('timerMode', 'set.timer', [['off', t('timer.off')], ['fixed', t('timer.fixed')], ['adaptive', t('timer.adaptive')]])}`;
    }
    if (tab === 'difficulty') {
        return ctl.toggle('adaptive', 'set.adaptive', 'set.adaptiveDesc')
            + ctl.number('startLevel', 'set.startLevel', 2, MAX_LEVEL)
            + ctl.number('maxLevel', 'set.maxLevel', 4, MAX_LEVEL)
            + ctl.number('fixedLevel', 'set.fixedLevel', 2, MAX_LEVEL)
            + ctl.toggle('focusWeak', 'set.focusWeak', 'set.focusWeakDesc')
            + `<fieldset><legend>${escapeHtml(t('set.ops'))}</legend><div class="ops">${OPS.map(o => `<div class="field field--toggle"><input type="checkbox" role="switch" id="op-${o}" data-op="${o}" ${s.ops.includes(o) ? 'checked' : ''}><label for="op-${o}">${escapeHtml(renderOpName(o))} <span class="muted">(${escapeHtml(t('op.' + o))})</span></label></div>`).join('')}</div></fieldset>`
            + ctl.number('nestedDepth', 'set.nestedDepth', 0, 3)
            + ctl.number('sortingWidth', 'set.sortingWidth', 2, 4);
    }
    if (tab === 'challenges') {
        return ctl.select('words', 'set.words', [['nonsense', t('words.nonsense')], ['nouns', t('words.nouns')], ['emoji', t('words.emoji')]], 'set.wordsDesc')
            + ctl.select('premiseStyle', 'set.style', [['sentences', t('style.sentences')], ['symbols', t('style.symbols')]], 'set.styleDesc')
            + ctl.toggle('negation', 'set.negation', 'set.negationDesc')
            + ctl.toggle('negationReminder', 'set.negationReminder')
            + ctl.toggle('meta', 'set.meta', 'set.metaDesc')
            + ctl.select('premiseOrder', 'set.premiseOrder', [['ordered', t('order.ordered')], ['p50', t('order.p50')], ['p80', t('order.p80')], ['scrambled', t('order.scrambled')]], 'set.premiseOrderDesc')
            + ctl.toggle('hidePremises', 'set.hidePremises', 'set.hidePremisesDesc')
            + ctl.toggle('oneAtATime', 'set.oneAtATime', 'set.oneAtATimeDesc')
            + ctl.toggle('stroop', 'set.stroop', 'set.stroopDesc')
            + ctl.toggle('shuffleButtons', 'set.shuffleButtons');
    }
    if (tab === 'sessions') {
        return ctl.toggle('program', 'set.program', 'set.programDesc')
            + `<p class="muted">${escapeHtml(t('set.sessionDesc'))}</p>`
            + ctl.number('sessionMinutes', 'set.sessionMinutes', 5, 120)
            + ctl.number('weeklyGoal', 'set.weeklyGoal', 1, 7)
            + ctl.toggle('autoNext', 'set.autoNext')
            + ctl.toggle('explainAlways', 'set.explainAlways');
    }
    if (tab === 'display') {
        return ctl.select('lang', 'set.language', Object.entries(LANGUAGE_NAMES))
            + ctl.select('theme', 'set.theme', [['auto', t('theme.auto')], ['light', t('theme.light')], ['dark', t('theme.dark')]])
            + ctl.select('textSize', 'set.textSize', [['s', t('size.s')], ['m', t('size.m')], ['l', t('size.l')], ['xl', t('size.xl')]])
            + ctl.toggle('reduceMotion', 'set.reduceMotion')
            + ctl.toggle('negSymbol', 'set.negSymbol')
            + ctl.toggle('keepAwake', 'set.keepAwake')
            + ctl.toggle('vibrate', 'set.vibrate');
    }
    return `<p class="muted">${escapeHtml(t('data.desc'))}</p>
      ${storageOk ? '' : `<p class="notice">${escapeHtml(t('data.storageError'))}</p>`}
      <div class="storage-status" aria-live="polite"></div>
      <div class="btn-row">
        <button type="button" class="btn" data-act="csv">${escapeHtml(t('data.exportCsv'))}</button>
        <button type="button" class="btn" data-act="json">${escapeHtml(t('data.exportJson'))}</button>
        <label class="btn file-btn">${escapeHtml(t('data.import'))}<input type="file" accept="application/json,.json" data-act="import" class="sr-only"></label>
        <button type="button" class="btn btn--danger" data-act="reset">${escapeHtml(t('data.reset'))}</button>
      </div>`;
}

function bindSettingInputs(v) {
    const after = (key) => {
        persistSettings();
        if (['lang', 'theme', 'textSize', 'reduceMotion', 'negSymbol'].includes(key)) {
            applyDisplaySettings();
            renderShell();
            const focusId = document.activeElement && document.activeElement.id;
            renderSettings();
            if (focusId) document.getElementById(focusId)?.focus();
            announce(t('set.saved'));
        } else {
            $('.warnings', v).innerHTML = settingsWarnings(app.settings).map(w => `<p class="notice">${escapeHtml(t(w))}</p>`).join('');
        }
        if (key === 'keepAwake') updateWakeLock();
        if (key === 'premiseStyle') setStyle(app.settings.premiseStyle);
    };
    for (const inp of $$('[data-key]', v)) {
        const key = inp.dataset.key;
        if (key === 'program') inp.onchange = () => {
            if (inp.checked) startProgram(); else { app.settings.program = false; persistSettings(); }
            renderSettings();
            document.getElementById('set-program')?.focus();
            announce(t('set.saved'));
        };
        else if (inp.type === 'checkbox') inp.onchange = () => { app.settings[key] = inp.checked; after(key); };
        else if (inp.type === 'number') inp.onchange = () => {
            const min = +inp.min, max = +inp.max;
            app.settings[key] = clampInt(inp.value, min, max, DEFAULTS[key]);
            inp.value = app.settings[key];
            after(key);
        };
        else inp.onchange = () => { app.settings[key] = inp.value; after(key); };
    }
    for (const inp of $$('[data-type]', v)) inp.onchange = () => {
        const set = new Set(app.settings.enabled);
        if (inp.checked) set.add(inp.dataset.type); else set.delete(inp.dataset.type);
        app.settings.enabled = TYPES.filter(tp => set.has(tp));
        after('enabled');
    };
    for (const inp of $$('[data-timer]', v)) inp.onchange = () => {
        const tp = inp.dataset.timer;
        app.settings.timers[tp] = clampInt(inp.value, 5, 600, 30);
        inp.value = app.settings.timers[tp];
        after('timers');
    };
    for (const inp of $$('[data-op]', v)) inp.onchange = () => {
        const set = new Set(app.settings.ops);
        if (inp.checked) set.add(inp.dataset.op); else set.delete(inp.dataset.op);
        app.settings.ops = OPS.filter(o => set.has(o));
        after('ops');
    };
    const act = (name) => $(`[data-act="${name}"]`, v);
    if (act('csv')) act('csv').onclick = exportCsv;
    if (act('json')) act('json').onclick = exportJson;
    if (act('import')) act('import').onchange = (e) => importFile(e.target.files[0]);
    if (act('reset')) act('reset').onclick = async () => {
        if (!confirm(t('data.resetConfirm'))) return;
        await clearAll();
        location.reload();
    };
}

function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function exportCsv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const L = lang();
    const rows = [['date', 'category', 'subtype', 'level', 'premises', 'conclusion', 'correct_answer', 'your_answer', 'result', 'seconds', 'checkup']];
    for (const a of app.answers) {
        let prem = '', concl = '';
        try {
            if (a.q && a.q.premises) { prem = a.q.premises.map(p => toText(renderStatement(p, L, 'sentences'))).join(' | '); concl = toText(renderStatement(a.q.conclusion, L, 'sentences')); }
            if (a.q && a.q.rule) concl = ruleText(a.q.rule);
        } catch { /* keep empty */ }
        rows.push([new Date(a.t).toISOString(), a.type, a.sub || '', a.level, prem, concl, a.type === 'sorting' ? '' : a.isValid, a.answer === null ? '' : a.answer, a.correct ? 'correct' : a.timedOut ? 'timeout' : 'wrong', (a.rt / 1000).toFixed(1), a.bench ? 1 : 0]);
    }
    download('syllogimous-rr-answers.csv', '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}

function exportJson() {
    const data = { format: 'syllogimous-rr', version: 1, exported: new Date().toISOString(), settings: app.settings, state: app.state, answers: app.answers, sessions: app.sessions, benchmarks: app.benchmarks, tests: app.tests };
    download('syllogimous-rr-backup.json', JSON.stringify(data), 'application/json');
}

async function importFile(file) {
    if (!file) return;
    try {
        const data = JSON.parse(await file.text());
        await importBackup(data);
        alertInline(t('data.imported'));
        setTimeout(() => location.reload(), 600);
    } catch {
        alertInline(t('data.importError'));
    }
}

function alertInline(text) {
    const w = $('#view-settings .warnings');
    if (w) w.innerHTML = `<p class="notice">${escapeHtml(text)}</p>`;
    announce(text);
}

// ---------------------------------------------------------------- about view

function renderAbout() {
    const v = $('#view-about');
    v.innerHTML = `<h1>${escapeHtml(t('about.title'))}</h1>
      <section class="card prose">
        <p>${escapeHtml(t('about.what'))}</p>
        <h2>${escapeHtml(t('about.honest'))}</h2><p>${escapeHtml(t('about.honestText'))}</p>
        <h2>${escapeHtml(t('about.design'))}</h2>
        <ul>${['d1', 'd2', 'd3', 'd4', 'd5'].map(k => `<li>${escapeHtml(t('about.' + k))}</li>`).join('')}</ul>
        <h2>${escapeHtml(t('about.keys'))}</h2><p>${escapeHtml(t('about.keysText'))}</p>
        <h2>${escapeHtml(t('about.credits'))}</h2><p>${escapeHtml(t('about.creditsText'))}</p>
        <p><a href="https://github.com/4skinskywalker/Syllogimous-v3" rel="noopener">Syllogimous v3</a> · <a href="https://creativecommons.org/licenses/by-nc/3.0/" rel="noopener license">CC BY-NC 3.0</a></p>
      </section>
      <section class="card support-card">
        <h2>${escapeHtml(t('tea.title'))}</h2>
        <p>${escapeHtml(t('tea.text'))}</p>
        ${teaButton('tea--large')}
      </section>`;
}

// ---------------------------------------------------------------- keyboard

function onKey(e) {
    if (app.view !== 'train' || e.ctrlKey || e.metaKey || e.altKey) return;
    if ($('#summary').open) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'select', 'textarea'].includes(tag)) return;
    const k = e.key.toLowerCase();
    if (app.phase === 'question' && app.q && app.q.type !== 'sorting') {
        if (k === 'arrowleft' || k === 'arrowright') {
            e.preventDefault();
            const [left, right] = [...$('.answers').children];
            const btn = k === 'arrowleft' ? left : right;
            if (!btn.disabled) btn.click();
            return;
        }
        if ((oneMode() || hideMode()) && k === 'arrowdown') { step(1); e.preventDefault(); }
        if ((oneMode() || hideMode()) && k === 'arrowup') { step(-1); e.preventDefault(); }
    } else if (app.phase === 'feedback' && k === 'enter' && tag !== 'button' && tag !== 'summary' && tag !== 'a') {
        e.preventDefault();
        $('.next-btn')?.click();
    }
}

// ---------------------------------------------------------------- boot

async function boot() {
    applyDisplaySettings();
    renderShell();
    for (const b of $$('.nav button')) b.onclick = () => showView(b.dataset.view);
    $('.btn--true').onclick = () => answer(true);
    $('.btn--false').onclick = () => answer(false);
    $('.step-prev').onclick = () => step(-1);
    $('.step-next').onclick = () => step(1);
    $('.reveal-btn').onclick = () => step(1);
    $('.end-session').onclick = endSession;
    $('.bench-abort').onclick = abortBench;
    $('.theme-toggle').onclick = toggleTheme;
    $('.program-bench').onclick = startBench;
    if (app.settings.program && !app.state.programStart) startProgram();
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', updateThemeToggle);
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseTimer(); else if (app.view === 'train') resumeTimer(); updateWakeLock(); });
    registerServiceWorker(() => {
        const b = $('.update-banner');
        $('.update-banner__text', b).textContent = t('pwa.update');
        $('.update-banner__btn', b).textContent = t('pwa.reload');
        $('.update-banner__btn', b).onclick = () => location.reload();
        b.hidden = false;
    });
    onInstallChange(() => { if (app.view === 'settings' && settingsTab === 'data') renderStorageStatus(); });

    await openDB();
    [app.answers, app.sessions, app.benchmarks, app.tests] = await Promise.all([getAll('answers'), getAll('sessions'), getAll('benchmarks'), getAll('tests')]);
    app.tests.sort((a, b) => a.t - b.t);
    app.answers.sort((a, b) => a.t - b.t);
    compact(app.answers);
    // resume a recent session
    const last = app.sessions.sort((a, b) => a.start - b.start)[app.sessions.length - 1];
    if (last && Date.now() - last.last < SESSION_GAP && !last.summarized) app.session = last;

    renderTrainChrome();
    nextQuestion();
    document.body.classList.add('ready');
}

boot();

// exposed for automated tests only
window.__srr = { app, answer, nextQuestion, showView, renderNotices };
