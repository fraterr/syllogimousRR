// Adaptive difficulty, category choice and time limits.

import { MIN_LEVEL, MAX_LEVEL } from './generators.js';
import { median, weightedPick, pick } from './util.js';

/**
 * 3-down / 1-up staircase on the number of premises: three correct answers in a
 * row add a premise, one error removes one. It converges to ~79% correct.
 * Returns the level change (+1, -1 or 0).
 */
export function updateLevel(state, type, correct, settings) {
    const min = MIN_LEVEL[type] || 2;
    const max = Math.max(min, Math.min(MAX_LEVEL, settings.maxLevel));
    const cur = state.levels[type] || { level: Math.max(min, Math.min(max, settings.startLevel)), streak: 0 };
    let change = 0;
    if (correct) {
        cur.streak++;
        if (cur.streak >= 3) { cur.streak = 0; if (cur.level < max) { cur.level++; change = 1; } }
    } else {
        cur.streak = 0;
        if (cur.level > min) { cur.level--; change = -1; }
    }
    state.levels[type] = cur;
    return change;
}

export function currentLevel(state, type, settings) {
    const min = MIN_LEVEL[type] || 2;
    if (!settings.adaptive) return Math.max(min, settings.fixedLevel);
    const max = Math.max(min, settings.maxLevel);
    const v = state.levels[type];
    return Math.max(min, Math.min(max, v ? v.level : settings.startLevel));
}

/** Recent accuracy of a type (null when fewer than 5 answers). */
export function recentAccuracy(answers, type, n = 20) {
    const recent = [];
    for (let i = answers.length - 1; i >= 0 && recent.length < n; i--)
        if (answers[i].type === type && !answers[i].bench) recent.push(answers[i].correct);
    if (recent.length < 5) return null;
    return recent.filter(Boolean).length / recent.length;
}

/** Interleave types; weaker ones (lower recent accuracy) come up more often. */
export function chooseType(types, settings, answers, lastType) {
    if (types.length === 1) return types[0];
    // avoid long runs of the same type
    const candidates = types.length > 2 ? types.filter(t => t !== lastType) : types;
    if (!settings.focusWeak) return pick(candidates);
    const weights = candidates.map(t => {
        const acc = recentAccuracy(answers, t);
        return acc === null ? 1.5 : 1 + 2 * (1 - acc);
    });
    return weightedPick(candidates, weights);
}

/** Seconds allowed, or null when there is no limit. */
export function timeLimit(type, level, settings, answers) {
    if (settings.timerMode === 'off') return null;
    const fixed = settings.timers[type] || 30;
    if (settings.timerMode === 'fixed') return fixed;
    const times = [];
    for (let i = answers.length - 1; i >= 0 && times.length < 10; i--) {
        const a = answers[i];
        if (a.type === type && a.correct && !a.bench && Math.abs(a.level - level) <= 1) times.push(a.rt / 1000);
    }
    if (times.length < 5) return fixed;
    return Math.round(Math.min(300, Math.max(8, median(times) * 1.4 + 3)));
}
