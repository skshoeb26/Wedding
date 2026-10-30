// Copies only the files the hosted generator needs into dist/ (no tests,
// tooling or package metadata). Used by Vercel and Netlify; no dependencies.
// Usage: node tools/build-site.mjs [outDir]
import { cp, mkdir, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'dist');
const INCLUDE = ['index.html', 'assets', 'src', 'templates', 'vendor'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const entry of INCLUDE) {
  await cp(path.join(ROOT, entry), path.join(OUT, entry), {
    recursive: true,
    // package.json files only tell Node how to load modules in tests.
    filter: (src) => path.basename(src) !== 'package.json'
  });
}

async function count(dir) {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) n += e.isDirectory() ? await count(path.join(dir, e.name)) : 1;
  return n;
}
console.log(`Built ${await count(OUT)} files into ${path.relative(ROOT, OUT) || '.'}/`);
