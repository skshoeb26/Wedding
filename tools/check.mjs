// Syntax-checks every JavaScript file and validates JSON files.
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', 'vendor', 'test-results']);

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

let failed = 0;
const files = await walk(ROOT);
for (const file of files.filter((f) => /\.(m?js)$/.test(f))) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) {
    failed++;
    console.error(`✗ ${path.relative(ROOT, file)}\n${r.stderr}`);
  }
}
for (const file of files.filter((f) => f.endsWith('.json'))) {
  try {
    JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    failed++;
    console.error(`✗ ${path.relative(ROOT, file)}: ${e.message}`);
  }
}
if (failed) {
  console.error(`${failed} file(s) failed`);
  process.exit(1);
}
console.log(`✓ ${files.filter((f) => /\.(m?js|json)$/.test(f)).length} files checked`);
