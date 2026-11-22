// The service worker must list every asset and carry the current content hash,
// otherwise installed copies would keep serving stale files.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assetList, assetHash } from '../scripts/sw-version.mjs';

const src = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const listed = [...src.matchAll(/^\s+'([^']+)',$/gm)].map(m => m[1]).filter(f => f !== './');
const files = assetList();
assert.deepEqual(listed, files, 'sw.js asset list is out of date: run `npm run sw`');
const version = src.match(/const VERSION = '([^']*)';/)[1];
assert.equal(version, assetHash(files), 'sw.js VERSION is out of date: run `npm run sw`');
console.log(`sw: ${files.length} assets cached, version ${version}`);
