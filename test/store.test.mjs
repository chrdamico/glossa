import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const run = (o) => ({ v: 1, seed: 's1', mode: 'free', difficulty: 'scholar', ci: 0, k: 0, phase: 'intro', results: [], given: {}, dug: [], glosses: {}, ...o });

mem.set('glossa:settings', JSON.stringify({ muted: true, seenHelp: true, difficulty: 'polyglot' }));
mem.set('glossa:stats', JSON.stringify({ done: 4, flawless: 1 }));
mem.set('glossa:dailyResults', JSON.stringify({ '2026-10-01': { mistakes: 0, digs: 1, seals: ['gold'] } }));
mem.set('glossa:run:free', JSON.stringify(run({ ci: 2, phase: 'play' })));

const { db, merge, normalize, pickRun, getRun, newRun, touchRun, finishRun, stats, sync, exportCode, importCode } = await import('../public/js/store.js');

test('old saves carry over', () => {
  assert.equal(db.settings.difficulty, 'polyglot');
  assert.deepEqual(stats(), { done: 4, flawless: 1 });
  assert.ok(db.daily['2026-10-01']);
  assert.equal(getRun('free', 1).ci, 2);
  assert.equal(getRun('free', 2), null);
});

test('a stale window cannot take a run backwards', () => {
  const r = getRun('free', 1);
  r.ci = 3;
  r.phase = 'feedback';
  touchRun(r);
  const stale = JSON.parse(mem.get('glossa:v1'));
  stale.runs.free = { ...stale.runs.free, ci: 1, phase: 'play', at: Date.now() + 5000 };
  mem.set('glossa:v1', JSON.stringify(stale));
  mem.set('glossa:v1:bak', JSON.stringify(stale));
  sync();
  assert.equal(db.runs.free.ci, 3);
  assert.equal(JSON.parse(mem.get('glossa:v1')).runs.free.ci, 3);
});

test('progress from another window is adopted', () => {
  const mine = db.runs.free;
  const other = JSON.parse(mem.get('glossa:v1'));
  other.runs.free = { ...other.runs.free, ci: 4, phase: 'play' };
  mem.set('glossa:v1', JSON.stringify(other));
  const cur = touchRun(mine);
  assert.notEqual(cur, mine);
  assert.equal(cur.ci, 4);
});

test('a finished run never comes back unfinished, a newer run replaces an older one', () => {
  const done = run({ phase: 'done', at: 1 });
  assert.equal(pickRun(run({ ci: 5, at: 99 }), done), done);
  const newer = run({ seed: 's2', started: 50 });
  assert.equal(pickRun(run({ seed: 's1', ci: 9, started: 10 }), newer), newer);
});

test('finishing counts once and keeps the first daily result', () => {
  const r = newRun(run({ seed: 'daily-2026-10-04', mode: 'daily', date: '2026-10-04' }));
  r.phase = 'done';
  finishRun(r, { mistakes: 0, digs: 0, seals: ['gold'] });
  finishRun(r, { mistakes: 3, digs: 0, seals: ['bronze'] });
  assert.deepEqual(stats(), { done: 5, flawless: 2 });
  assert.equal(db.daily['2026-10-04'].mistakes, 0);
  const a = normalize({ daily: { d: { mistakes: 1, at: 5 } } });
  const b = normalize({ daily: { d: { mistakes: 0, at: 9 } } });
  assert.equal(merge(a, b).daily.d.mistakes, 1);
});

test('a backup code restores progress on a fresh device and never removes any', () => {
  const code = exportCode();
  assert.match(code, /^GLOSSA1:/);
  const snapshot = new Map(mem);
  mem.clear();
  db.finished = {};
  db.daily = {};
  db.legacy = { done: 0, flawless: 0 };
  db.runs.daily = null;
  db.runs.free = null;
  db.finished.other = { at: 1, flawless: false };
  const added = importCode(`my code: ${code}`);
  assert.equal(added, 5);
  assert.deepEqual(stats(), { done: 6, flawless: 2 });
  assert.equal(db.runs.free.ci, 4);
  assert.ok(JSON.parse(mem.get('glossa:v1:bak')).finished.other);
  assert.throws(() => importCode('hello'));
  for (const [k, v] of snapshot) mem.set(k, v);
});
