// Installable app, offline use and device features. Everything here degrades
// silently: browsers without a feature simply skip it.

let installEvent = null;
const installListeners = new Set();
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    installListeners.forEach(fn => fn());
});
window.addEventListener('appinstalled', () => { installEvent = null; installListeners.forEach(fn => fn()); });

export const onInstallChange = (fn) => installListeners.add(fn);
export const canInstall = () => !!installEvent;
export async function promptInstall() {
    if (!installEvent) return false;
    installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    installEvent = null;
    installListeners.forEach(fn => fn());
    return !!choice && choice.outcome === 'accepted';
}

export const isStandalone = () =>
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
export const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Register the service worker; onUpdate() runs when a new version took over an open page. */
export function registerServiceWorker(onUpdate) {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
            const w = reg.installing;
            if (!w) return;
            w.addEventListener('statechange', () => { if (w.state === 'activated' && hadController) onUpdate(); });
        });
    }).catch(() => { /* offline use simply unavailable */ });
}

/** Ask the browser not to evict our data (history, programme stage). */
export async function requestPersistence() {
    try {
        if (!navigator.storage || !navigator.storage.persist) return false;
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
    } catch { return false; }
}
export async function isPersisted() {
    try { return !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); } catch { return false; }
}

// Screen wake lock during training
let lock = null;
export async function keepAwake(on) {
    try {
        if (on && !lock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
            lock = await navigator.wakeLock.request('screen');
            lock.addEventListener('release', () => { lock = null; });
        } else if (!on && lock) {
            const l = lock; lock = null; await l.release();
        }
    } catch { lock = null; }
}

export function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* unsupported */ }
}
