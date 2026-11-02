// Run every scripts/test-*.mjs in order and stop at the first failure.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const tests = readdirSync(dir).filter(name => /^test-.*\.mjs$/.test(name)).sort();
for (const name of tests) {
  const result = spawnSync(process.execPath, [dir + name], { stdio: 'inherit' });
  if (result.status !== 0) { console.error(`\n${name} failed.`); process.exit(result.status || 1); }
}
console.log(`\nAll ${tests.length} check files passed.`);
