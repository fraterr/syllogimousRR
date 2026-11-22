// Rewrites the asset list and VERSION in sw.js from the files on disk.
// Run after changing any file: `npm run sw`. tests/sw.test.mjs fails if you forget.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIRS = ['css', 'js', 'fonts', 'icons'];
const FILES = ['index.html', 'manifest.webmanifest', 'favicon.png'];

export function assetList() {
    const out = [...FILES];
    const walk = (dir) => {
        for (const name of readdirSync(join(ROOT, dir)).sort()) {
            const p = join(dir, name);
            if (statSync(join(ROOT, p)).isDirectory()) walk(p);
            else if (!/\.(txt|md)$/i.test(name)) out.push(relative('.', p));
        }
    };
    DIRS.forEach(walk);
    return out;
}

export function assetHash(list = assetList()) {
    const h = createHash('sha256');
    for (const f of list) { h.update(f); h.update(readFileSync(join(ROOT, f))); }
    return h.digest('hex').slice(0, 12);
}

if (process.argv[1] && process.argv[1].endsWith('sw-version.mjs')) {
    const list = assetList();
    const path = join(ROOT, 'sw.js');
    let src = readFileSync(path, 'utf8');
    src = src.replace(/const VERSION = '[^']*';/, `const VERSION = '${assetHash(list)}';`);
    src = src.replace(/const ASSETS = \[[\s\S]*?\];/, `const ASSETS = [\n    './',\n${list.map(f => `    '${f}',`).join('\n')}\n];`);
    writeFileSync(path, src);
    console.log(`sw.js: ${list.length} assets, version ${assetHash(list)}`);
}
