const KEY = 'glossa:v1';
const BAK = 'glossa:v1:bak';
const LEGACY = {
  settings: 'glossa:settings',
  daily: 'glossa:run:daily',
  free: 'glossa:run:free',
  stats: 'glossa:stats',
  results: 'glossa:dailyResults',
};
const CODE_PREFIX = 'GLOSSA1:';
const RANK = { intro: 0, play: 1, feedback: 2, cleared: 3 };

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function fresh() {
  return {
    settings: { muted: false, seenHelp: false, difficulty: 'scholar', _u: 0 },
    runs: { daily: null, free: null },
    finished: {},
    daily: {},
    legacy: { done: 0, flawless: 0 },
  };
}

export function normalize(d) {
  const base = fresh();
  if (!isObj(d)) return base;
  return {
    settings: { ...base.settings, ...(isObj(d.settings) ? d.settings : {}) },
    runs: { daily: isObj(d.runs?.daily) ? d.runs.daily : null, free: isObj(d.runs?.free) ? d.runs.free : null },
    finished: isObj(d.finished) ? { ...d.finished } : {},
    daily: isObj(d.daily) ? { ...d.daily } : {},
    legacy: { done: +d.legacy?.done || 0, flawless: +d.legacy?.flawless || 0 },
  };
}

export function progress(r) {
  if (r.phase === 'done') return Infinity;
  return (r.ci || 0) * 1000 + (r.k || 0) * 10 + (RANK[r.phase] || 0);
}

export function pickRun(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.seed !== b.seed) return (b.started || 0) > (a.started || 0) ? b : a;
  const pa = progress(a);
  const pb = progress(b);
  if (pa !== pb) return pb > pa ? b : a;
  return (b.at || 0) > (a.at || 0) ? b : a;
}

export function merge(a, b) {
  const finished = { ...a.finished };
  for (const [k, v] of Object.entries(b.finished)) if (!finished[k] || (v.at || 0) < (finished[k].at || 0)) finished[k] = v;
  const daily = { ...a.daily };
  for (const [k, v] of Object.entries(b.daily)) if (!daily[k] || (v.at || 0) < (daily[k].at || 0)) daily[k] = v;
  return {
    settings: (b.settings._u || 0) > (a.settings._u || 0) ? b.settings : a.settings,
    runs: { daily: pickRun(a.runs.daily, b.runs.daily), free: pickRun(a.runs.free, b.runs.free) },
    finished,
    daily,
    legacy: { done: Math.max(a.legacy.done, b.legacy.done), flawless: Math.max(a.legacy.flawless, b.legacy.flawless) },
  };
}

function readJSON(k) {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readLegacy() {
  const s = readJSON(LEGACY.settings);
  const st = readJSON(LEGACY.stats);
  const res = readJSON(LEGACY.results);
  if (!s && !st && !res && !readJSON(LEGACY.daily) && !readJSON(LEGACY.free)) return null;
  return normalize({
    settings: isObj(s) ? { ...s, _u: 0 } : undefined,
    runs: { daily: readJSON(LEGACY.daily), free: readJSON(LEGACY.free) },
    daily: isObj(res) ? res : {},
    legacy: isObj(st) ? st : undefined,
  });
}

function readStored() {
  let out = null;
  for (const d of [readJSON(KEY), readJSON(BAK)].map((x) => (x ? normalize(x) : null)).concat(readLegacy())) {
    if (d) out = out ? merge(out, d) : d;
  }
  return out;
}

export const db = readStored() || fresh();

function adopt(m) {
  Object.assign(db.settings, m.settings);
  db.runs.daily = m.runs.daily;
  db.runs.free = m.runs.free;
  db.finished = m.finished;
  db.daily = m.daily;
  db.legacy = m.legacy;
}

function signature() {
  return JSON.stringify([db.settings, db.runs.daily?.seed, db.runs.daily?.at, db.runs.free?.seed, db.runs.free?.at, Object.keys(db.finished).length, Object.keys(db.daily).length, db.legacy]);
}

function writeAll() {
  const json = JSON.stringify(db);
  for (const k of [KEY, BAK]) {
    try {
      localStorage.setItem(k, json);
    } catch {}
  }
}

const listeners = new Set();

export function onExternalChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function sync({ write = true } = {}) {
  const before = signature();
  const stored = readStored();
  if (stored) adopt(merge(normalize(db), stored));
  if (write) writeAll();
  return signature() !== before;
}

function refresh() {
  if (sync({ write: false })) listeners.forEach((fn) => fn());
}

export function touchSettings() {
  db.settings._u = Date.now();
  sync();
}

export function getRun(mode, version) {
  const r = db.runs[mode];
  return r && r.v === version ? r : null;
}

export function newRun(save) {
  const now = Date.now();
  db.runs[save.mode] = { ...save, started: now, at: now };
  sync();
  return db.runs[save.mode];
}

export function touchRun(r) {
  r.at = Date.now();
  sync();
  return db.runs[r.mode];
}

export function finishRun(r, result) {
  const at = Date.now();
  if (!db.finished[r.seed]) db.finished[r.seed] = { at, mode: r.mode, flawless: result.mistakes + result.digs === 0 };
  if (r.mode === 'daily' && r.date && !db.daily[r.date]) db.daily[r.date] = { ...result, at };
  return touchRun(r);
}

export function stats() {
  const all = Object.values(db.finished);
  return { done: db.legacy.done + all.length, flawless: db.legacy.flawless + all.filter((f) => f.flawless).length };
}

export function exportCode() {
  const bytes = new TextEncoder().encode(JSON.stringify(db));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return CODE_PREFIX + btoa(bin);
}

export function importCode(code) {
  const raw = String(code).replace(/\s+/g, '');
  const at = raw.indexOf(CODE_PREFIX);
  if (at < 0) throw new Error('Not a Glossa backup code');
  const bin = atob(raw.slice(at + CODE_PREFIX.length));
  const data = normalize(JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))));
  data.settings._u = 0;
  const before = stats().done;
  adopt(merge(normalize(db), data));
  sync();
  return stats().done - before;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === KEY || e.key === BAK || Object.values(LEGACY).includes(e.key)) refresh();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}
