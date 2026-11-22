// Guided programme: the recommended settings, applied in stages.
//
// Sources behind the plan (see README): relational-training studies (SMART)
// train same/opposite and more/less first; community guides start without a
// clock and with premises in a connected order, then a ~30 s limit with the
// premises hidden once the conclusion is shown, then scrambled premises and
// premises one at a time (working memory), then harder relation types one at a
// time; 2–3 sessions of ~30 minutes a week.
// A stage advances after enough completed sessions AND only while recent
// accuracy holds, so nobody is pushed forward while still guessing.

import { DEFAULTS, TIMER_DEFAULTS } from './storage.js';

const BASE = {
    enabled: ['distinction', 'comparison'],
    words: 'nonsense',
    adaptive: true, startLevel: 2, maxLevel: 12, focusWeak: true,
    timerMode: 'off', timers: { ...TIMER_DEFAULTS },
    negation: false, negationReminder: true, meta: false,
    oneAtATime: false, stroop: false, shuffleButtons: false,
    premiseOrder: 'ordered', hidePremises: false,
    explainAlways: true, autoNext: true,
    sessionMinutes: 30, weeklyGoal: 3, nestedDepth: 0,
};

/** Each stage: completed sessions needed to reach it, and what it changes. */
export const STAGES = [
    { sessions: 0, patch: {} },
    { sessions: 3, patch: { add: ['temporal'], timerMode: 'fixed', timers30: ['distinction', 'comparison', 'temporal'], hidePremises: true } },
    { sessions: 6, patch: { add: ['direction', 'syllogism'], negation: true, timerMode: 'adaptive', explainAlways: false, premiseOrder: 'p50' } },
    { sessions: 12, patch: { oneAtATime: true, premiseOrder: 'p80' } },
    { sessions: 18, patch: { add: ['direction3D'], premiseOrder: 'scrambled' } },
    { sessions: 21, patch: { add: ['direction4D'] } },
    { sessions: 24, patch: { add: ['analogy'], meta: true } },
    { sessions: 27, patch: { add: ['binary'] } },
];

export const MIN_SESSION_MS = 10 * 60 * 1000;   // a session counts once it has 10 active minutes
export const ACCURACY_GATE = 0.7;               // recent accuracy needed to move on
const GATE_WINDOW = 30;
const GATE_MIN = 20;

/** Settings for a stage (1-based), built cumulatively on top of the user's display preferences. */
export function stageSettings(stage, current) {
    const s = {
        ...DEFAULTS,
        // keep personal display choices
        lang: current.lang || DEFAULTS.lang, theme: current.theme || DEFAULTS.theme,
        textSize: current.textSize || DEFAULTS.textSize,
        reduceMotion: !!current.reduceMotion, negSymbol: !!current.negSymbol,
        ...structuredClone(BASE),
        program: true,
    };
    for (let i = 1; i < Math.min(stage, STAGES.length); i++) {
        const { add = [], timers30 = [], ...rest } = STAGES[i].patch;
        s.enabled = [...new Set([...s.enabled, ...add])];
        for (const tp of timers30) s.timers[tp] = 30;
        Object.assign(s, rest);
    }
    return s;
}

export function completedSessions(sessions, since) {
    return sessions.filter(s => s.start >= since && (s.active || 0) >= MIN_SESSION_MS).length;
}

export function recentAccuracy(answers, since) {
    const recent = answers.filter(a => !a.bench && a.t >= since).slice(-GATE_WINDOW);
    if (recent.length < GATE_MIN) return null;
    return recent.filter(a => a.correct).length / recent.length;
}

/**
 * The stage the user should be at now. Moves at most one stage at a time and
 * never backwards; the accuracy gate must be met to move.
 */
export function nextStage(currentStage, sessions, answers, since) {
    if (currentStage >= STAGES.length) return currentStage;
    const done = completedSessions(sessions, since);
    if (done < STAGES[currentStage].sessions) return currentStage;
    const acc = recentAccuracy(answers, since);
    if (acc === null || acc < ACCURACY_GATE) return currentStage;
    return currentStage + 1;
}

export const STAGE_COUNT = STAGES.length;
