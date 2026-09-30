/**
 * Tests the stopwatch's state logic against the real lib/timerState.ts.
 *
 *   node scripts/test-timer.mjs
 *
 * The source is read and only its storage backend is swapped for an
 * in-memory stub with latency, so the logic under test is exactly what
 * ships. The latency matters: these are concurrency tests, and without a
 * delay the operations never interleave.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'lib', 'timerState.ts'), 'utf8');

const STUB = `
const store = new Map();
const AsyncStorage = {
  async getItem(k) { await new Promise(r => setTimeout(r, 6)); return store.has(k) ? store.get(k) : null; },
  async setItem(k, v) { await new Promise(r => setTimeout(r, 6)); store.set(k, v); },
  async removeItem(k) { await new Promise(r => setTimeout(r, 2)); store.delete(k); },
};
`;

const dir = mkdtempSync(join(tmpdir(), 'timer-test-'));
const modPath = join(dir, 'timerState.mts');
writeFileSync(
  modPath,
  source.replace(
    "import AsyncStorage from '@react-native-async-storage/async-storage';",
    STUB
  )
);

const {
  addOf, elapsedOf, IDLE, mutateTimer, pauseOf, readTimer, startOf, writeTimer,
} = await import(pathToFileURL(modPath).href);

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  ' + extra : '')); }
};

const KEY = 'timer:test';

/** What the screen does on returning to the foreground: read, never write. */
async function foregroundSync(key) {
  await readTimer(key);
  await new Promise((r) => setTimeout(r, 25));
}

async function press(key, fn) {
  await new Promise((r) => setTimeout(r, 8));
  return mutateTimer(key, fn);
}

console.log('\n== a single press always takes effect ==');
await writeTimer(KEY, startOf(IDLE));
await Promise.all([foregroundSync(KEY), press(KEY, pauseOf)]);
ok('Pause lands even while the screen is re-reading storage',
   (await readTimer(KEY)).running === false);

await writeTimer(KEY, IDLE);
await Promise.all([foregroundSync(KEY), press(KEY, startOf)]);
ok('Resume lands under the same race', (await readTimer(KEY)).running === true);

console.log('\n== rapid presses ==');
await writeTimer(KEY, IDLE);
const work = [];
for (let i = 0; i < 10; i++) work.push(mutateTimer(KEY, i % 2 === 0 ? startOf : pauseOf));
work.push(foregroundSync(KEY));
await Promise.all(work);
const final = await readTimer(KEY);
ok('ten alternating presses end paused, none lost', final.running === false, JSON.stringify(final));
ok('accumulated time stays sane', final.accumulated >= 0 && final.accumulated < 5);

console.log('\n== repeated delivery of the same action is harmless ==');
const p1 = pauseOf({ running: true, startedAt: Date.now() - 5000, accumulated: 10 });
ok('pausing twice does not double-count',
   Math.round(p1.accumulated) === Math.round(pauseOf(p1).accumulated));
ok('starting an already-running timer is a no-op',
   startOf({ running: true, startedAt: 1000, accumulated: 5 }).startedAt === 1000);

console.log('\n== clock skew ==');
ok('a backwards clock never shrinks elapsed below banked time',
   elapsedOf({ running: true, startedAt: Date.now() + 60_000, accumulated: 30 }) >= 30);
ok('elapsed is never negative',
   elapsedOf({ running: true, startedAt: Date.now() + 1e9, accumulated: 0 }) >= 0);

console.log('\n== manual add ==');
ok('+15m adds exactly 900s', addOf(IDLE, 900).accumulated === 900);

console.log(`\n${'='.repeat(46)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(46)}\n`);
process.exit(fail === 0 ? 0 : 1);
