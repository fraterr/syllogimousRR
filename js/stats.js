// Aggregates for the Progress view.

import { median } from './util.js';

export function summary(answers) {
    const train = answers.filter(a => !a.bench);
    const last = train.slice(-100);
    return {
        total: train.length,
        accuracy: last.length ? last.filter(a => a.correct).length / last.length : null,
        median: last.length ? median(last.map(a => a.rt)) / 1000 : null,
    };
}

export function byCategory(answers, types) {
    return types.map(type => {
        const list = answers.filter(a => a.type === type && !a.bench);
        const last = list.slice(-50);
        return {
            type,
            count: list.length,
            accuracy: last.length ? last.filter(a => a.correct).length / last.length : null,
            median: last.length ? median(last.map(a => a.rt)) / 1000 : null,
        };
    });
}

export function sessionSeries(answers, sessions) {
    const bySession = new Map();
    for (const a of answers) {
        if (a.bench || !a.session) continue;
        const s = bySession.get(a.session) || { n: 0, ok: 0 };
        s.n++; if (a.correct) s.ok++;
        bySession.set(a.session, s);
    }
    return sessions
        .filter(s => bySession.has(s.id) && bySession.get(s.id).n >= 5)
        .sort((a, b) => a.start - b.start)
        .map(s => ({ t: s.start, value: bySession.get(s.id).ok / bySession.get(s.id).n, n: bySession.get(s.id).n }));
}

/** Monday 00:00 of the current week, local time. */
export function weekStart(now = new Date()) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
}

/** Sessions this week that lasted at least 10 minutes of active training. */
export function sessionsThisWeek(sessions, now = new Date()) {
    const ws = weekStart(now);
    return sessions.filter(s => s.start >= ws && (s.active || 0) >= 10 * 60 * 1000).length;
}

/** Minutes of active training per week (Monday start), for the last `weeks` weeks. */
export function weeklyMinutes(sessions, weeks = 12, now = new Date()) {
    const start = weekStart(now);
    const out = [];
    for (let i = weeks - 1; i >= 0; i--) {
        const from = new Date(start); from.setDate(from.getDate() - 7 * i);
        const to = new Date(from); to.setDate(to.getDate() + 7);
        const ms = sessions.filter(s => s.start >= from.getTime() && s.start < to.getTime()).reduce((a, s) => a + (s.active || 0), 0);
        out.push({ t: from.getTime(), minutes: Math.round(ms / 60000) });
    }
    return out;
}

/** Median seconds per premise of correct answers, per session (sorting excluded). */
export function secondsPerPremise(answers, sessions) {
    const by = new Map();
    for (const a of answers) {
        if (a.bench || !a.session || !a.correct || a.type === 'sorting' || !a.level) continue;
        if (!by.has(a.session)) by.set(a.session, []);
        by.get(a.session).push(a.rt / 1000 / a.level);
    }
    return sessions
        .filter(s => (by.get(s.id) || []).length >= 5)
        .sort((a, b) => a.start - b.start)
        .map(s => ({ t: s.start, value: median(by.get(s.id)) }));
}

/** Minutes of training between two dates (for the external test log). */
export function minutesBetween(sessions, from, to) {
    return Math.round(sessions.filter(s => s.start >= from && s.start < to).reduce((a, s) => a + (s.active || 0), 0) / 60000);
}
