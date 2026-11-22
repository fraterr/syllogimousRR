// Persistence. Settings and small state live in localStorage; answers, sessions
// and check-ups live in IndexedDB (much larger quota than the 5 MB of
// localStorage that froze the original app). Every access is guarded: if the
// browser refuses storage the app keeps working in memory.

import { OPS, TYPES, BASE_TYPES, MIN_LEVEL, MAX_LEVEL } from './generators.js';
import { clampInt } from './util.js';
import { LANGS } from './render.js';

const SETTINGS_KEY = 'srr-settings';
const STATE_KEY = 'srr-state';
const DB_NAME = 'syllogimous-rr';
const KEEP_FULL = 3000;      // answers that keep the full question (for History)
const MAX_ANSWERS = 50000;

export const TIMER_DEFAULTS = {
    distinction: 30, comparison: 30, temporal: 30, syllogism: 30, direction: 40, direction3D: 50,
    direction4D: 60, analogy: 50, binary: 60, sorting: 90,
};

export const DEFAULTS = {
    lang: 'en', theme: 'auto', textSize: 'm', reduceMotion: false, negSymbol: false,
    enabled: ['distinction', 'comparison', 'temporal', 'syllogism', 'direction'],
    timerMode: 'off', timers: { ...TIMER_DEFAULTS },
    adaptive: true, startLevel: 2, maxLevel: 12, fixedLevel: 3, focusWeak: true,
    ops: [...OPS], nestedDepth: 0, sortingWidth: 2,
    negation: false, negationReminder: true, meta: false, stroop: false, oneAtATime: false, shuffleButtons: false,
    words: 'nonsense',
    sessionMinutes: 30, weeklyGoal: 3, autoNext: true, explainAlways: false,
};

export const PRESETS = {
    beginner: {
        enabled: ['distinction', 'comparison', 'temporal', 'syllogism', 'direction'],
        adaptive: true, startLevel: 2, maxLevel: 6, negation: false, meta: false, stroop: false,
        oneAtATime: false, shuffleButtons: false, timerMode: 'off', words: 'nonsense', explainAlways: true, nestedDepth: 0,
    },
    intermediate: {
        enabled: ['distinction', 'comparison', 'temporal', 'syllogism', 'direction', 'direction3D', 'analogy', 'binary'],
        adaptive: true, startLevel: 3, maxLevel: 12, negation: true, meta: false, stroop: false,
        oneAtATime: false, shuffleButtons: false, timerMode: 'adaptive', words: 'nonsense', explainAlways: false, nestedDepth: 0,
    },
    expert: {
        enabled: [...TYPES],
        adaptive: true, startLevel: 4, maxLevel: 20, negation: true, meta: true, stroop: true,
        oneAtATime: true, shuffleButtons: true, timerMode: 'adaptive', words: 'nonsense', explainAlways: false, nestedDepth: 2,
    },
};

const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);

/** Merge untrusted input with defaults, coercing every field to a valid value. */
export function sanitizeSettings(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const d = DEFAULTS;
    const timers = {};
    for (const k of Object.keys(TIMER_DEFAULTS)) timers[k] = clampInt(r.timers && r.timers[k], 5, 600, TIMER_DEFAULTS[k]);
    const s = {
        lang: oneOf(r.lang, LANGS, d.lang),
        theme: oneOf(r.theme, ['auto', 'light', 'dark'], d.theme),
        textSize: oneOf(r.textSize, ['s', 'm', 'l', 'xl'], d.textSize),
        reduceMotion: bool(r.reduceMotion, d.reduceMotion),
        negSymbol: bool(r.negSymbol, d.negSymbol),
        enabled: Array.isArray(r.enabled) ? TYPES.filter(t => r.enabled.includes(t)) : [...d.enabled],
        timerMode: oneOf(r.timerMode, ['off', 'fixed', 'adaptive'], d.timerMode),
        timers,
        adaptive: bool(r.adaptive, d.adaptive),
        startLevel: clampInt(r.startLevel, 2, MAX_LEVEL, d.startLevel),
        maxLevel: clampInt(r.maxLevel, 4, MAX_LEVEL, d.maxLevel),
        fixedLevel: clampInt(r.fixedLevel, 2, MAX_LEVEL, d.fixedLevel),
        focusWeak: bool(r.focusWeak, d.focusWeak),
        ops: Array.isArray(r.ops) ? OPS.filter(o => r.ops.includes(o)) : [...d.ops],
        nestedDepth: clampInt(r.nestedDepth, 0, 3, d.nestedDepth),
        sortingWidth: clampInt(r.sortingWidth, 2, 4, d.sortingWidth),
        negation: bool(r.negation, d.negation),
        negationReminder: bool(r.negationReminder, d.negationReminder),
        meta: bool(r.meta, d.meta),
        stroop: bool(r.stroop, d.stroop),
        oneAtATime: bool(r.oneAtATime, d.oneAtATime),
        shuffleButtons: bool(r.shuffleButtons, d.shuffleButtons),
        words: oneOf(r.words, ['nonsense', 'nouns'], d.words),
        sessionMinutes: clampInt(r.sessionMinutes, 5, 120, d.sessionMinutes),
        weeklyGoal: clampInt(r.weeklyGoal, 1, 7, d.weeklyGoal),
        autoNext: bool(r.autoNext, d.autoNext),
        explainAlways: bool(r.explainAlways, d.explainAlways),
    };
    if (s.startLevel > s.maxLevel) s.startLevel = s.maxLevel;
    return s;
}

/** Problems that make some enabled types unusable (shown inline, never as alert()). */
export function settingsWarnings(s) {
    const w = [];
    const playable = s.enabled.filter(t => t !== 'analogy' && t !== 'binary');
    if (!s.enabled.length) w.push('warn.none');
    if (s.enabled.includes('analogy') && !s.enabled.some(t => ['distinction', 'comparison', 'temporal', 'direction', 'direction3D', 'direction4D'].includes(t))) w.push('warn.analogy');
    if (s.enabled.includes('binary') && !playable.some(t => BASE_TYPES.includes(t))) w.push('warn.binary');
    if (s.enabled.includes('binary') && !s.ops.length) w.push('warn.ops');
    return w;
}

/** Types that can actually be generated with these settings. */
export function playableTypes(s) {
    const base = s.enabled.filter(t => BASE_TYPES.includes(t));
    return s.enabled.filter(t => {
        if (t === 'analogy') return base.some(b => b !== 'syllogism');
        if (t === 'binary') return base.length > 0 && s.ops.length > 0;
        return true;
    });
}

function readJSON(key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const loadSettings = () => sanitizeSettings(readJSON(SETTINGS_KEY));
export const saveSettings = (s) => writeJSON(SETTINGS_KEY, s);

export function loadState() {
    const r = readJSON(STATE_KEY) || {};
    const levels = {};
    for (const t of TYPES) {
        const v = r.levels && r.levels[t];
        levels[t] = v ? { level: clampInt(v.level, MIN_LEVEL[t], MAX_LEVEL, MIN_LEVEL[t]), streak: clampInt(v.streak, 0, 10, 0) } : null;
    }
    return { levels, score: clampInt(r.score, -1e9, 1e9, 0) };
}
export const saveState = (st) => writeJSON(STATE_KEY, st);

// ---------- IndexedDB ----------

let db = null;
const memory = { answers: [], sessions: [], benchmarks: [] };
export let storageOk = true;

export function openDB() {
    return new Promise((resolve) => {
        let req;
        try { req = indexedDB.open(DB_NAME, 1); } catch { storageOk = false; return resolve(false); }
        req.onupgradeneeded = () => {
            const d = req.result;
            d.createObjectStore('answers', { keyPath: 'id', autoIncrement: true });
            d.createObjectStore('sessions', { keyPath: 'id' });
            d.createObjectStore('benchmarks', { keyPath: 'id', autoIncrement: true });
        };
        req.onsuccess = () => { db = req.result; resolve(true); };
        req.onerror = () => { storageOk = false; resolve(false); };
        req.onblocked = () => { storageOk = false; resolve(false); };
    });
}

function tx(store, mode, fn) {
    return new Promise((resolve) => {
        if (!db) return resolve(fn(null));
        try {
            const t = db.transaction(store, mode);
            const result = fn(t.objectStore(store));
            t.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
            t.onerror = () => { storageOk = false; resolve(null); };
            t.onabort = () => { storageOk = false; resolve(null); };
        } catch { storageOk = false; resolve(null); }
    });
}

export async function getAll(store) {
    if (!db) return [...memory[store]];
    return new Promise((resolve) => {
        try {
            const req = db.transaction(store, 'readonly').objectStore(store).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        } catch { resolve([]); }
    });
}

export async function put(store, record) {
    if (!db) {
        const list = memory[store];
        if (record.id === undefined) record.id = (list.length ? list[list.length - 1].id : 0) + 1;
        const i = list.findIndex(r => r.id === record.id);
        if (i >= 0) list[i] = record; else list.push(record);
        return record.id;
    }
    const id = await tx(store, 'readwrite', (os) => os && os.put(record));
    if (id !== null && id !== undefined && record.id === undefined) record.id = id;
    return record.id;
}

export async function clearAll() {
    for (const s of Object.keys(memory)) memory[s] = [];
    if (db) for (const s of ['answers', 'sessions', 'benchmarks']) await tx(s, 'readwrite', (os) => os && os.clear());
    try { localStorage.removeItem(SETTINGS_KEY); localStorage.removeItem(STATE_KEY); } catch { /* ignore */ }
}

/** Keep the store bounded: drop full question text from old answers, cap total count. */
export async function compact(answers) {
    const full = answers.filter(a => a.q);
    const strip = full.slice(0, Math.max(0, full.length - KEEP_FULL));
    for (const a of strip) { delete a.q; await put('answers', a); }
    if (answers.length > MAX_ANSWERS && db) {
        const drop = answers.splice(0, answers.length - MAX_ANSWERS);
        await tx('answers', 'readwrite', (os) => { if (os) for (const a of drop) os.delete(a.id); });
    }
}

export async function importBackup(data) {
    if (!data || data.format !== 'syllogimous-rr' || !Array.isArray(data.answers)) throw new Error('invalid');
    await clearAll();
    saveSettings(sanitizeSettings(data.settings));
    if (data.state) saveState(data.state);
    for (const store of ['answers', 'sessions', 'benchmarks'])
        for (const r of (data[store] || [])) if (r && typeof r === 'object') await put(store, r);
}
