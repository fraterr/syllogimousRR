// Small, dependency-free helpers shared by every module.

/** Random integer in [0, n). */
export const randInt = (n) => Math.floor(Math.random() * n);

/** Fair coin. */
export const coin = () => Math.random() < 0.5;

/** Random element of an array. */
export const pick = (arr) => arr[randInt(arr.length)];

/**
 * Fisher–Yates shuffle. Always returns a NEW array and never mutates the input,
 * so callers must use the return value (the original app lost its shuffling
 * because two different `shuffle` functions with different contracts collided).
 */
export function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = randInt(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** n distinct random elements. */
export const sample = (arr, n) => shuffle(arr).slice(0, n);

/** Weighted random choice; weights must be >= 0. */
export function weightedPick(items, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return pick(items);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r < 0) return items[i];
    }
    return items[items.length - 1];
}

/** Parse anything into an integer within [min, max]; falls back to def. */
export function clampInt(value, min, max, def) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, n));
}

export const sign = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);

export function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function median(values) {
    if (!values.length) return null;
    const s = [...values].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
