// Service worker: the whole app is cached on install so it works offline.
// VERSION and ASSETS are written by `npm run sw` (scripts/sw-version.mjs).
const VERSION = '3d04c45024c7';
const CACHE = 'srr-' + VERSION;
const ASSETS = [
    './',
    'index.html',
    'manifest.webmanifest',
    'favicon.png',
    'css/app.css',
    'js/adaptive.js',
    'js/app.js',
    'js/belief.js',
    'js/charts.js',
    'js/explain.js',
    'js/generators.js',
    'js/guide.js',
    'js/i18n.js',
    'js/program.js',
    'js/pwa.js',
    'js/render.js',
    'js/stats.js',
    'js/storage.js',
    'js/util.js',
    'js/wcst.js',
    'js/words.js',
    'fonts/inter-cyrillic-ext-wght-normal.woff2',
    'fonts/inter-cyrillic-wght-normal.woff2',
    'fonts/inter-latin-ext-wght-normal.woff2',
    'fonts/inter-latin-wght-normal.woff2',
    'fonts/space-grotesk-latin-ext-wght-normal.woff2',
    'fonts/space-grotesk-latin-wght-normal.woff2',
    'icons/apple-touch-icon.png',
    'icons/favicon-16x16.png',
    'icons/favicon-32x32.png',
    'icons/icon-192x192.png',
    'icons/icon-512x512.png',
    'icons/icon.svg',
    'icons/maskable-512x512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' }))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k.startsWith('srr-') && k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
    event.respondWith(
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
            if (res.ok && res.type === 'basic') {
                const copy = res.clone();
                caches.open(CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
        }).catch(() => (req.mode === 'navigate' ? caches.match('./') : Response.error())))
    );
});
