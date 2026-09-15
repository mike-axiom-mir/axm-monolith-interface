import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.resolve(here,'../mobile/phone-local.html'),'utf8');
assert.match(html,/Connect a monolith ZIP\./);
assert.match(html,/\/monolith\/install-zip/);
assert.match(html,/body-only mode/);
assert.match(html,/Codex CLI/);

const inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());
assert.ok(inline.length>=1,'expected inline phone application script');
for(const source of inline)new Function(source);
console.log('AXM phone mobile page parse test: PASS');
