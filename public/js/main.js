import { generateRun, answerTablet, GEN_VERSION } from './curriculum.js';
import { trueSentences, formatMorphs } from './lang.js';
import { sceneSVG, shapeIcon, PIGMENT, setPatterns, PATTERN_DEFS } from './render.js';
import { sfx, setMuted } from './audio.js';
import { describeGrammar, lexiconEntries, glossVerdict } from './grammar.js';
import { initPWA } from './pwa.js';
import { db, getRun, newRun, touchRun, finishRun, touchSettings, stats, exportCode, importCode, onExternalChange } from './store.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const DIFF_LABEL = { novice: 'Novice', scholar: 'Scholar', polyglot: 'Polyglot' };
const KIND = { compose: 'Write', read: 'Read', spot: 'Mend' };
const PROMPT = {
  compose: 'Describe this picture in the language.',
  read: 'Which picture does this sentence describe?',
  spot: 'One word is wrong. Tap it.',
};
const GSYM = { and: '&amp;', up: '↑', down: '↓', left: '←', right: '→', pl: 'PL', two: '×2', small: 'sm', A: 'A', B: 'B', '?': '?' };
const GTITLE = { and: 'and', up: 'above / on', down: 'below / under', left: 'left of', right: 'right of', pl: 'plural', two: 'exactly two', small: 'small', A: 'class A', B: 'class B', '?': 'unsure' };

const ICON = {
  pick: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5c2.5-1 5 -.5 6.5 1-2.2-.3-4.3.2-6 1.4"/><path d="M14.5 5.5c-1.4 1.4-2 3.4-1.6 5.6"/><path d="M13 9 4 20"/></svg>',
  cross: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  sound: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 6H9l-6 6 6 6h12z"/><path d="M17 10l-4 4M13 10l4 4"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const settings = db.settings;
setMuted(settings.muted);
setPatterns(settings.patterns);
document.body.insertAdjacentHTML('afterbegin', PATTERN_DEFS);
document.body.classList.toggle('patterns', !!settings.patterns);
const saveSettings = () => touchSettings();

let run = null;
let save = null;
const ui = { compose: [], typed: '', sel: null, rendered: new Set(), firstRender: true, glossFor: null, collapsed: false, folded: new Set() };

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
let adoptPending = false;

function persist() {
  if (save && touchRun(save) !== save) scheduleAdopt();
}

function scheduleAdopt() {
  if (adoptPending) return;
  adoptPending = true;
  setTimeout(adoptExternal, 0);
}

function adoptExternal() {
  adoptPending = false;
  const screen = document.body.dataset.screen;
  if (screen === 'title') return renderTitle();
  if (!save || save.phase === 'done') return;
  const s = getRun(save.mode, GEN_VERSION);
  if (!s || s === save) return;
  if (s.seed !== save.seed) run = generateRun(s.seed, s.difficulty);
  save = s;
  closeGloss();
  hideOverlay();
  if (save.phase === 'done') renderEnd();
  else enterGame();
  toast('Synced with your other window.');
}

onExternalChange(() => {
  setMuted(settings.muted);
  setPatterns(settings.patterns);
  document.body.classList.toggle('patterns', !!settings.patterns);
  scheduleAdopt();
});

/* ---------- screens ---------- */

function show(id) {
  for (const s of ['title', 'game', 'end']) $('#' + s).classList.toggle('hidden', s !== id);
  document.body.dataset.screen = id;
  window.scrollTo(0, 0);
}

function renderTitle() {
  closeGloss();
  hideOverlay();
  const tk = todayKey();
  const daily = loadSlot('daily');
  const dailyLive = daily && daily.date === tk ? daily : null;
  const dailyDone = db.daily[tk];
  const free = loadSlot('free');
  const d = new Date();
  const dateStr = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  let dailyAction;
  if (dailyDone) {
    dailyAction = `<div class="done-line">${sealsText(dailyDone.seals)} <span>${dailyDone.mistakes} mistake${dailyDone.mistakes === 1 ? '' : 's'} · ${dailyDone.digs} dig${dailyDone.digs === 1 ? '' : 's'}</span></div>
      ${dailyLive ? '<button class="btn" data-act="reviewDaily">Review</button>' : ''}`;
  } else if (dailyLive && dailyLive.phase !== 'done') {
    dailyAction = `<button class="btn primary" data-act="contDaily">Continue · Chamber ${ROMAN[dailyLive.ci]}</button>`;
  } else {
    dailyAction = `<button class="btn primary" data-act="playDaily">Begin</button>`;
  }
  const diff = settings.difficulty || 'scholar';
  $('#title').innerHTML = `
    <div class="title-wrap">
      <div class="title-glyphs" aria-hidden="true">${titleGlyphs()}</div>
      <h1 class="logo-big">Glossa</h1>
      <p class="tag">Decipher a language that does not exist.</p>
      <div class="cards">
        <div class="card">
          <div class="eyebrow">Today’s tongue</div>
          <div class="card-title">${esc(dateStr)}</div>
          <p class="muted small">One language for everyone today. Scholar difficulty.</p>
          ${dailyAction}
        </div>
        <div class="card">
          <div class="eyebrow">A new tongue</div>
          <div class="seg" role="radiogroup">
            ${['novice', 'scholar', 'polyglot'].map((x) => `<button role="radio" aria-checked="${x === diff}" class="${x === diff ? 'on' : ''}" data-diff="${x}">${DIFF_LABEL[x]}</button>`).join('')}
          </div>
          <p class="muted small" id="diffNote">${diffNote(diff)}</p>
          <div class="btn-row">
            <button class="btn primary" data-act="playFree">Begin</button>
            ${free && free.phase !== 'done' ? `<button class="btn" data-act="contFree">Continue (${DIFF_LABEL[free.difficulty]})</button>` : ''}
          </div>
        </div>
      </div>
      <div class="btn-row center"><button class="link" data-act="help">How to play</button><button class="link" data-act="backup">Backup</button></div>
      ${statsLine()}
      <p class="foot">Every language is generated on the spot. Every puzzle is solvable from what you have seen.</p>
    </div>`;
  show('title');
}

function dailyStreak() {
  const res = db.daily;
  const d = new Date();
  const key = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (!res[key(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (res[key(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function statsLine() {
  const st = stats();
  if (!st.done) return '';
  const streak = dailyStreak();
  return `<p class="stats-line">${st.done} tongue${st.done === 1 ? '' : 's'} deciphered · ${st.flawless} flawless${streak ? ` · daily streak ${streak}` : ''}</p>`;
}

function diffNote(d) {
  return {
    novice: 'A plain grammar and an extra tablet in every chamber.',
    scholar: 'A few strange rules. Just enough evidence.',
    polyglot: 'Many strange rules. Just enough evidence.',
  }[d];
}

function titleGlyphs() {
  const C = 'ptkbdgmnszlrvhy';
  const V = 'aeiou';
  let x = 12345;
  const r = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  const syl = () => C[Math.floor(r() * C.length)] + V[Math.floor(r() * V.length)];
  let s = '';
  for (let i = 0; i < 22; i++) {
    const w = syl() + syl() + (r() < 0.3 ? '·' + syl() : '');
    s += `<span style="left:${Math.floor(r() * 92)}%;top:${Math.floor(r() * 94)}%;font-size:${18 + Math.floor(r() * 18)}px;animation-delay:${(-r() * 16).toFixed(1)}s">${w}</span>`;
  }
  return s;
}

/* ---------- run lifecycle ---------- */

function startRun(mode, difficulty) {
  const seed = mode === 'daily' ? 'daily-' + todayKey() : 'free-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  run = generateRun(seed, difficulty);
  save = newRun({
    v: GEN_VERSION, seed, difficulty, mode, date: mode === 'daily' ? todayKey() : null,
    ci: 0, k: 0, phase: 'intro',
    results: run.chambers.map(() => ({ mistakes: 0, digs: 0, outcomes: [] })),
    given: {}, dug: [], glosses: {},
  });
  if (save.seed !== seed) run = generateRun(save.seed, save.difficulty);
  if (save.phase === 'done') return renderEnd();
  enterGame();
}

function loadSlot(mode) {
  return getRun(mode, GEN_VERSION);
}

function resumeRun(mode) {
  const s = loadSlot(mode);
  if (!s) return renderTitle();
  save = s;
  run = generateRun(save.seed, save.difficulty);
  if (save.phase === 'done') return renderEnd();
  enterGame();
}

function enterGame() {
  ui.folded = new Set();
  ui.rendered = new Set();
  ui.firstRender = true;
  resetChallengeUI();
  show('game');
  renderAll();
  if (!settings.seenHelp) {
    settings.seenHelp = true;
    saveSettings();
    showHelp(() => phaseOverlay(), true);
  } else {
    phaseOverlay();
  }
}

function resetChallengeUI() {
  ui.compose = [];
  ui.typed = '';
  ui.sel = null;
}

function totals() {
  return save.results.reduce((a, r) => ({ mistakes: a.mistakes + r.mistakes, digs: a.digs + r.digs }), { mistakes: 0, digs: 0 });
}

function sealOf(i) {
  const r = save.results[i];
  const cost = r.mistakes + r.digs;
  return cost === 0 ? 'gold' : cost === 1 ? 'silver' : 'bronze';
}

function sealsText(seals) {
  return seals.map((s) => ({ gold: '●', silver: '◐', bronze: '○' }[s])).join('');
}

/* ---------- codex ---------- */

function answeredCount(c) {
  if (c < save.ci) return run.chambers[c].challenges.length;
  if (c > save.ci) return 0;
  return save.phase === 'feedback' || save.phase === 'cleared' ? save.k + 1 : save.phase === 'done' ? run.chambers[c].challenges.length : save.k;
}

function codexEntries() {
  const out = [];
  const last = Math.min(save.ci, run.chambers.length - 1);
  for (let c = 0; c <= last; c++) {
    const ch = run.chambers[c];
    ch.evidence.forEach((t, i) => out.push({ scene: t.scene, morphs: t.morphs, c, src: 'ev', id: `e${c}-${i}` }));
    for (const [dc, ri] of save.dug) if (dc === c) out.push({ scene: ch.reserve[ri].scene, morphs: ch.reserve[ri].morphs, c, src: 'dig', id: `d${c}-${ri}` });
    const done = answeredCount(c);
    for (let k = 0; k < done; k++) {
      const a = answerTablet(ch.challenges[k]);
      const g = save.given[`${c}:${k}`] || {};
      let morphs = a.morphs;
      if (ch.challenges[k].type === 'compose' && g.ok && g.text) {
        const alt = trueSentences(run.lang, a.scene).find((m) => formatMorphs(m) === g.text);
        if (alt) morphs = alt;
      }
      out.push({ scene: a.scene, morphs, c, src: g.ok ? 'ans-' + ch.challenges[k].type : 'rev', id: `a${c}-${k}` });
    }
  }
  return out;
}

function knownMorphs(entries) {
  const map = new Map();
  for (const e of entries) for (const m of e.morphs) if (!map.has(m.s)) map.set(m.s, { s: m.s, suf: !!m.suf });
  return [...map.values()];
}

function glossHTML(code) {
  if (!code) return '';
  const t = code[0];
  const v = code.slice(2);
  if (t === 'S') return shapeIcon(v, '#d9ccb0', 13);
  if (t === 'C') return `<span class="dot" data-c="${v[0].toUpperCase()}" style="background:${PIGMENT[v]}"></span>`;
  if (t === 'N') return `<span class="gnum">${v}</span>`;
  if (t === 'G') return `<span class="gsym">${GSYM[v] || '?'}</span>`;
  return `<span class="gtext">${esc(v)}</span>`;
}

function morphHTML(m, idx) {
  return `<span class="m${m.suf ? ' suf' : ''}" data-m="${m.s}" data-i="${idx}"><b>${m.suf ? '·' : ''}${m.s}</b><i class="gl">${glossHTML(save.glosses[m.s])}</i></span>`;
}

function sentenceHTML(morphs) {
  const words = [];
  morphs.forEach((m, idx) => {
    if (m.suf && words.length) words[words.length - 1].push([m, idx]);
    else words.push([[m, idx]]);
  });
  return words.map((w) => `<span class="w">${w.map(([m, i]) => morphHTML(m, i)).join('')}</span>`).join('');
}

const SRC_TAG = { dig: 'dug up', 'ans-compose': 'your words', 'ans-read': 'read', 'ans-spot': 'mended', rev: 'revealed' };

function tabletHTML(t) {
  const fresh = !ui.firstRender && !ui.rendered.has(t.id);
  const ms = [...new Set(t.morphs.map((m) => m.s))].join(' ');
  return `<div class="tablet src-${t.src}${fresh ? ' fresh' : ''}" data-id="${t.id}" data-ms="${ms}">
    ${sceneSVG(t.scene)}
    <div class="sent">${sentenceHTML(t.morphs)}</div>
    ${SRC_TAG[t.src] ? `<span class="tag">${SRC_TAG[t.src]}</span>` : ''}
  </div>`;
}

function renderCodex() {
  const entries = codexEntries();
  const last = Math.min(save.ci, run.chambers.length - 1);
  let html = `<div class="codex-head"><h2>Codex</h2><span class="muted small">${entries.length} tablets · tap a word to gloss it</span></div>`;
  for (let c = last; c >= 0; c--) {
    const list = entries.filter((e) => e.c === c);
    html += `<section class="chap${c === save.ci ? ' current' : ''}${ui.folded.has(c) ? ' folded' : ''}" data-chap="${c}">
      <h3 data-fold="${c}" title="Show or hide"><span class="rn">${ROMAN[c]}</span>${esc(run.chambers[c].def.name)}<span class="cnt">${list.length}</span><span class="fold">${ICON.chevron}</span></h3>
      ${list.length ? `<div class="grid">${list.map(tabletHTML).join('')}</div>` : '<p class="muted small empty-chap">No new tablets here. Everything you need is already in your codex.</p>'}
    </section>`;
  }
  $('#codex').innerHTML = html;
  for (const e of entries) ui.rendered.add(e.id);
  ui.firstRender = false;
  if (ui.glossFor) highlight(ui.glossFor);
}

/* ---------- HUD ---------- */

function renderHUD() {
  const t = totals();
  const seals = run.chambers.map((ch, i) => {
    let cls = 'todo';
    if (i < save.ci || save.phase === 'done' || (i === save.ci && save.phase === 'cleared')) cls = sealOf(i);
    else if (i === save.ci) cls = 'cur';
    return `<span class="seal ${cls}" title="${ROMAN[i]} · ${esc(ch.def.name)}"></span>`;
  }).join('');
  $('#hud').innerHTML = `
    <button class="logo" data-act="title" title="Back to title" aria-label="Back to title"><span class="logo-full">Glossa</span><span class="logo-short">G</span></button>
    <div class="hud-lang"><span class="muted small">${save.mode === 'daily' ? 'Today' : DIFF_LABEL[save.difficulty]}</span><span class="alien">${esc(run.lang.name)}</span></div>
    <div class="seals">${seals}</div>
    <div class="hud-stats">
      <span class="stat" title="Mistakes">${ICON.cross}${t.mistakes}</span>
      <span class="stat" title="Tablets dug up">${ICON.pick}${t.digs}</span>
    </div>
    <button class="icon-btn" data-act="help" title="How to play" aria-label="How to play">?</button>
    <button class="icon-btn" data-act="sound" title="Sound" aria-label="Toggle sound">${settings.muted ? ICON.mute : ICON.sound}</button>`;
}

/* ---------- panel ---------- */

function current() {
  const ch = run.chambers[save.ci];
  return { ch, c: ch.challenges[save.k] };
}

function renderPanel() {
  const panel = $('#panel');
  panel.classList.toggle('collapsed', ui.collapsed);
  if (save.phase === 'done') { panel.innerHTML = ''; return; }
  const { ch, c } = current();
  const fb = save.phase === 'feedback' || save.phase === 'cleared';
  const head = `<div class="phead" data-act="collapse">
      <div class="pstep"><span class="kind k-${c.type}">${KIND[c.type]}</span><span class="muted">${ROMAN[save.ci]} · ${save.k + 1} of ${ch.challenges.length}</span></div>
      <div class="phead-r">
        ${fb ? '' : `<button class="btn ghost sm" data-act="dig" title="Dig up one more tablet (costs a point)">${ICON.pick}<span>Dig</span></button>`}
        <button class="icon-btn collapse-btn" data-act="collapse" aria-label="Collapse">${ICON.chevron}</button>
      </div>
    </div>`;
  let body = '';
  if (c.type === 'compose') body = composeHTML(c, fb);
  else if (c.type === 'read') body = readHTML(c, fb);
  else body = spotHTML(c, fb);
  panel.innerHTML = head + `<div class="pbody">${body}</div>`;
  if (c.type === 'compose' && !fb) renderAnswer();
}

function composeHTML(c, fb) {
  const top = `<p class="prompt">${PROMPT.compose}</p><div class="target">${sceneSVG(c.scene, 'pic big')}</div>`;
  if (fb) {
    const g = save.given[`${save.ci}:${save.k}`];
    const ok = g.ok;
    let mine = '';
    if (!ok) {
      const given = g.morphs || [];
      const best = bestSolution(c, given);
      mine = `<div class="fb-line"><span class="lbl">Yours</span><div class="sentence">${given.length ? diffHTML(given, best) : '<span class="muted">(nothing)</span>'}</div></div>`;
    }
    const shown = ok ? trueSentences(run.lang, c.scene).find((m) => formatMorphs(m) === g.text) || c.solution : bestSolution(c, g.morphs || []);
    return top + feedbackBanner(ok) + mine +
      `<div class="fb-line"><span class="lbl">${ok ? 'Carved' : 'Answer'}</span><div class="sentence">${sentenceHTML(shown)}</div></div>` +
      (c.solutions.length > 1 ? `<p class="muted small">Either group may come first.</p>` : '') + continueBtn();
  }
  return top + `
    <div class="answer" id="answer"></div>
    <div class="crow">
      <button class="btn ghost" data-act="undo" title="Remove last word (Backspace)">${ICON.back}</button>
      <button class="btn ghost" data-act="clear">Clear</button>
      <button class="btn primary grow" data-act="submit">Carve</button>
    </div>
    <div class="palette" id="palette">${paletteHTML()}</div>`;
}

function bestSolution(c, given) {
  const sols = trueSentences(run.lang, c.scene);
  let best = sols[0], bestScore = -1;
  for (const s of sols) {
    let sc = 0;
    s.forEach((m, i) => { if (given[i] && given[i].s === m.s) sc++; });
    if (sc > bestScore) { best = s; bestScore = sc; }
  }
  return best;
}

function diffHTML(given, truth) {
  const words = [];
  given.forEach((m, idx) => {
    if (m.suf && words.length) words[words.length - 1].push([m, idx]);
    else words.push([[m, idx]]);
  });
  return words.map((w) => `<span class="w">${w.map(([m, i]) => {
    const bad = !truth[i] || truth[i].s !== m.s;
    return morphHTML(m, i).replace('class="m', `class="m${bad ? ' bad' : ''}`);
  }).join('')}</span>`).join('');
}

function paletteHTML() {
  const known = knownMorphs(codexEntries());
  const order = (m) => {
    const g = save.glosses[m.s];
    if (!g) return [9, m.suf ? 1 : 0, m.s];
    const t = g[0];
    const v = g.slice(2);
    if (t === 'S') return [0, run.lang.shapes.indexOf(v), m.s];
    if (t === 'C') return [1, run.lang.colors.indexOf(v), m.s];
    if (t === 'N') return [2, +v, m.s];
    if (t === 'G') return [3, Object.keys(GSYM).indexOf(v), m.s];
    return [4, 0, m.s];
  };
  known.sort((a, b) => {
    const A = order(a), B = order(b);
    for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] < B[i] ? -1 : 1;
    return 0;
  });
  return known.map((m) => `<button class="tile${m.suf ? ' suf' : ''}" data-tile="${m.s}" data-suf="${m.suf ? 1 : 0}"><b>${m.suf ? '·' : ''}${m.s}</b><i class="gl">${glossHTML(save.glosses[m.s])}</i></button>`).join('');
}

function renderAnswer() {
  const el = $('#answer');
  if (!el) return;
  const typed = ui.typed ? `<span class="typed">${esc(ui.typed)}</span>` : '';
  if (!ui.compose.length && !ui.typed) {
    el.innerHTML = `<span class="placeholder">Tap words below to build the sentence…</span>`;
  } else {
    el.innerHTML = sentenceHTML(ui.compose) + typed + '<span class="caret"></span>';
  }
  el.classList.toggle('has', ui.compose.length > 0);
}

function readHTML(c, fb) {
  const g = fb ? save.given[`${save.ci}:${save.k}`] : null;
  const opts = c.options.map((o, i) => {
    let cls = '';
    if (fb) {
      if (i === c.answer) cls = ' right';
      else if (g && g.choice === i) cls = ' wrong';
    } else if (ui.sel === i) cls = ' sel';
    return `<button class="opt${cls}" data-opt="${i}" ${fb ? 'disabled' : ''}><span class="optn">${i + 1}</span>${sceneSVG(o)}</button>`;
  }).join('');
  return `<p class="prompt">${PROMPT.read}</p>
    <div class="sentence big read-sent">${sentenceHTML(c.morphs)}</div>
    <div class="options">${opts}</div>` +
    (fb ? feedbackBanner(g.ok) + continueBtn() : `<button class="btn primary wide" data-act="submit" ${ui.sel === null ? 'disabled' : ''}>Confirm</button>`);
}

function spotHTML(c, fb) {
  const g = fb ? save.given[`${save.ci}:${save.k}`] : null;
  let sent = sentenceHTML(c.morphs);
  const mark = (html, i, cls) => html.replace(`data-i="${i}"`, `data-i="${i}" data-mark="${cls}"`);
  if (fb) {
    sent = mark(sent, c.wrong, 'bad');
    if (g && !g.ok && g.choice !== undefined && g.choice !== null) sent = mark(sent, g.choice, 'miss');
  } else if (ui.sel !== null) {
    sent = mark(sent, ui.sel, 'sel');
  }
  let after = '';
  if (fb) {
    const fixed = sentenceHTML(c.solution).replace(`data-i="${c.wrong}"`, `data-i="${c.wrong}" data-mark="good"`);
    after = feedbackBanner(g.ok) + `<div class="fb-line"><span class="lbl">Mended</span><div class="sentence">${fixed}</div></div>` + continueBtn();
  } else {
    after = `<button class="btn primary wide" data-act="submit" ${ui.sel === null ? 'disabled' : ''}>Confirm</button>`;
  }
  return `<p class="prompt">${PROMPT.spot}</p>
    <div class="target">${sceneSVG(c.scene, 'pic big')}</div>
    <div class="sentence big spot-sent${fb ? '' : ' pickable'}">${sent}</div>` + after;
}

function feedbackBanner(ok) {
  const type = current().c.type;
  const right = { compose: ['Correct.', 'Exactly.', 'Well put.', 'Precisely.', 'Yes.'], read: ['Correct.', 'Well read.', 'Exactly.', 'Yes.'], spot: ['Correct.', 'Well spotted.', 'Mended.', 'Yes.'] }[type];
  const wrong = ['Not quite.', 'Not this time.', 'Close, but no.'];
  const pool = ok ? right : wrong;
  const msg = pool[(save.ci * 3 + save.k) % pool.length];
  return `<div class="banner ${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'} ${msg} <span class="muted small">${ok ? 'Added to your codex.' : 'The right answer is now in your codex.'}</span></div>`;
}

function continueBtn() {
  return `<button class="btn primary wide" data-act="next" autofocus>Continue</button>`;
}

/* ---------- actions ---------- */

function submit() {
  if (save.phase !== 'play') return;
  const { c } = current();
  let ok = false;
  let given = {};
  if (c.type === 'compose') {
    if (!ui.compose.length) return;
    const text = formatMorphs(ui.compose);
    ok = c.solutions.includes(text);
    given = { text, morphs: ui.compose.map((m) => ({ s: m.s, suf: m.suf })) };
  } else {
    if (ui.sel === null) return;
    ok = c.type === 'read' ? ui.sel === c.answer : ui.sel === c.wrong;
    given = { choice: ui.sel };
  }
  const r = save.results[save.ci];
  r.outcomes[save.k] = ok;
  if (!ok) r.mistakes++;
  save.given[`${save.ci}:${save.k}`] = { ok, ...given };
  save.phase = 'feedback';
  persist();
  if (ok) sfx.right(); else sfx.wrong();
  renderHUD();
  renderCodex();
  renderPanel();
  const panel = $('#panel');
  panel.classList.remove('flash-ok', 'flash-no');
  void panel.offsetWidth;
  panel.classList.add(ok ? 'flash-ok' : 'flash-no');
  const fresh = $('#codex .tablet.fresh');
  if (fresh && window.innerWidth >= 900) fresh.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function next() {
  const { ch } = current();
  if (save.phase === 'feedback') {
    if (save.k + 1 < ch.challenges.length) {
      save.k++;
      save.phase = 'play';
      resetChallengeUI();
      persist();
      renderPanel();
      $('#panel').scrollTop = 0;
      return;
    }
    save.phase = 'cleared';
    persist();
    renderHUD();
    sfx.cleared();
    phaseOverlay();
    return;
  }
  if (save.phase === 'cleared') {
    if (save.ci + 1 < run.chambers.length) {
      save.ci++;
      save.k = 0;
      save.phase = 'play';
      resetChallengeUI();
      persist();
      renderAll();
      $('#codex').scrollTop = 0;
      window.scrollTo(0, 0);
      const n = run.chambers[save.ci].evidence.length;
      if (n) toast(`${n} new tablet${n === 1 ? '' : 's'} unearthed.`);
    } else {
      save.phase = 'done';
      if (finishRun(save, { ...totals(), seals: run.chambers.map((_, i) => sealOf(i)) }) !== save) scheduleAdopt();
      hideOverlay();
      renderEnd();
    }
  }
}

function similarity(a, b) {
  let s = a.layout === b.layout ? 4 : 0;
  for (const ga of a.groups) {
    for (const gb of b.groups) {
      if (ga.shape === gb.shape) s += 1;
      if (ga.color === gb.color) s += 1;
      if (ga.n === gb.n) s += 1.5;
      if (!!ga.small === !!gb.small) s += 0.5;
    }
  }
  return s - Math.abs(a.groups.length - b.groups.length) * 2;
}

function dig() {
  if (save.phase !== 'play') return;
  const { ch, c } = current();
  const target = c.type === 'read' ? c.options[c.answer] : c.scene;
  const used = new Set(save.dug.filter((d) => d[0] === save.ci).map((d) => d[1]));
  let best = -1, bestScore = -Infinity;
  ch.reserve.forEach((t, i) => {
    if (used.has(i)) return;
    const s = similarity(t.scene, target);
    if (s > bestScore) { bestScore = s; best = i; }
  });
  if (best < 0) return toast('The chamber is empty. Nothing more to dig.');
  save.dug.push([save.ci, best]);
  save.results[save.ci].digs++;
  persist();
  sfx.dig();
  renderHUD();
  renderCodex();
  toast('A new tablet is unearthed.');
  const el = $(`#codex .tablet[data-id="d${save.ci}-${best}"]`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function addTile(s, suf) {
  ui.compose.push({ s, suf });
  ui.typed = '';
  sfx.place();
  renderAnswer();
}

/* ---------- gloss popover ---------- */

function highlight(m) {
  $$('.hl').forEach((e) => e.classList.remove('hl'));
  $$('#codex .tablet').forEach((t) => t.classList.toggle('dim', !!m && !t.dataset.ms.split(' ').includes(m)));
  if (m) $$(`.m[data-m="${m}"], .tile[data-tile="${m}"]`).forEach((e) => e.classList.add('hl'));
  document.body.classList.toggle('filtering', !!m);
}

function openGloss(m, anchor) {
  ui.glossFor = m;
  highlight(m);
  sfx.select();
  const count = $$('#codex .tablet').filter((t) => t.dataset.ms.split(' ').includes(m)).length;
  const suf = !!$(`.m.suf[data-m="${m}"]`);
  const cur = save.glosses[m];
  const opt = (code, inner, title) => `<button class="gopt${cur === code ? ' on' : ''}" data-g="${code}" title="${esc(title)}">${inner}</button>`;
  const L = run.lang;
  const el = $('#gloss');
  el.innerHTML = `
    <div class="gh"><b class="alien">${suf ? '·' : ''}${m}</b><span class="muted small">in ${count} tablet${count === 1 ? '' : 's'} (others fade)</span><button class="icon-btn" data-gclose aria-label="Close">${ICON.cross}</button></div>
    <div class="gsec"><label>Shape</label><div class="gopts">${L.shapes.map((s) => opt('S:' + s, shapeIcon(s, '#e8dcc0', 18), s)).join('')}</div></div>
    <div class="gsec"><label>Colour</label><div class="gopts">${L.colors.map((c) => opt('C:' + c, `<span class="dot big" data-c="${c[0].toUpperCase()}" style="background:${PIGMENT[c]}"></span>`, c)).join('')}</div></div>
    <div class="gsec"><label>Number</label><div class="gopts">${[1, 2, 3, 4, 5, 6].map((n) => opt('N:' + n, `<span class="gnum">${n}</span>`, String(n))).join('')}</div></div>
    <div class="gsec"><label>Grammar</label><div class="gopts">${Object.keys(GSYM).map((k) => opt('G:' + k, `<span class="gsym">${GSYM[k]}</span>`, GTITLE[k])).join('')}</div></div>
    <div class="gsec grow-row"><input id="gtext" maxlength="10" placeholder="Own note, then Enter" value="${cur && cur.startsWith('T:') ? esc(cur.slice(2)) : ''}" autocomplete="off"><button class="btn ghost sm" data-g="">Clear</button></div>`;
  el.classList.remove('hidden');
  document.body.classList.add('glossing');
  positionGloss(anchor);
}

function positionGloss(anchor) {
  const el = $('#gloss');
  if (window.innerWidth < 700) {
    el.classList.add('sheet');
    el.style.left = el.style.top = '';
    return;
  }
  el.classList.remove('sheet');
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
  let top = r.bottom + 8;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}

function closeGloss() {
  ui.glossFor = null;
  const el = $('#gloss');
  if (el) el.classList.add('hidden');
  document.body.classList.remove('glossing');
  if (save && run && document.body.dataset.screen === 'game') highlight(null);
}

function setGloss(m, code) {
  if (code) save.glosses[m] = code;
  else delete save.glosses[m];
  persist();
  sfx.tap();
  const html = glossHTML(code);
  $$(`.m[data-m="${m}"] .gl, .tile[data-tile="${m}"] .gl`).forEach((e) => (e.innerHTML = html));
  closeGloss();
}

/* ---------- overlays ---------- */

function showOverlay(html, onPrimary, cls = '') {
  const o = $('#overlay');
  o.innerHTML = `<div class="ov-card ${cls}">${html}</div>`;
  o.classList.remove('hidden');
  o.onclick = (e) => {
    if (e.target.closest('[data-act]')) return;
    const b = e.target.closest('[data-ov]');
    if (b) { hideOverlay(); onPrimary && onPrimary(b.dataset.ov); }
  };
  const p = $('[data-ov]', o);
  if (p) setTimeout(() => p.focus(), 30);
}

function hideOverlay() {
  const o = $('#overlay');
  o.classList.add('hidden');
  o.innerHTML = '';
}

function overlayOpen() {
  return !$('#overlay').classList.contains('hidden');
}

function phaseOverlay() {
  if (save.phase === 'intro') {
    const ch = run.chambers[save.ci];
    const n = ch.evidence.length;
    showOverlay(`
      <div class="eyebrow">Chamber ${ROMAN[save.ci]} of ${ROMAN[run.chambers.length - 1]}</div>
      <h2>${esc(ch.def.name)}</h2>
      <p>${esc(ch.def.blurb)}</p>
      <p class="muted">${n ? `${n} new tablet${n === 1 ? '' : 's'} unearthed. ` : 'No new tablets here: only what you already know. '}${ch.challenges.length} challenges ahead.</p>
      <button class="btn primary wide" data-ov="go">Study the tablets</button>`, () => {
      save.phase = 'play';
      persist();
      renderPanel();
    }, 'intro');
  } else if (save.phase === 'cleared') {
    const r = save.results[save.ci];
    const seal = sealOf(save.ci);
    const word = { gold: 'Flawless', silver: 'Nearly flawless', bronze: 'Cleared' }[seal];
    const nextCh = run.chambers[save.ci + 1];
    const nextHTML = nextCh ? `
      <div class="next-ch">
        <div class="eyebrow">Next · Chamber ${ROMAN[save.ci + 1]}</div>
        <h3>${esc(nextCh.def.name)}</h3>
        <p class="muted">${esc(nextCh.def.blurb)} ${nextCh.evidence.length ? `${nextCh.evidence.length} new tablet${nextCh.evidence.length === 1 ? '' : 's'}.` : 'No new tablets.'}</p>
      </div>` : '';
    showOverlay(`
      <div class="big-seal ${seal}"></div>
      <div class="eyebrow">Chamber ${ROMAN[save.ci]} · ${word}</div>
      <h2>${esc(run.chambers[save.ci].def.name)}</h2>
      <p class="muted">${r.mistakes} mistake${r.mistakes === 1 ? '' : 's'} · ${r.digs} dig${r.digs === 1 ? '' : 's'}</p>
      ${nextHTML}
      <button class="btn primary wide" data-ov="go">${nextCh ? 'Enter chamber ' + ROMAN[save.ci + 1] : 'Read the whole grammar'}</button>`, () => next(), 'cleared');
  }
}

const HELP_SCENES = [
  { layout: 'single', groups: [{ shape: 'star', color: 'yellow', n: 2 }] },
  { layout: 'mixed', groups: [{ shape: 'circle', color: 'red', n: 2 }, { shape: 'square', color: 'blue', n: 1 }] },
  { layout: 'vert', groups: [{ shape: 'triangle', color: 'green', n: 1 }, { shape: 'ring', color: 'white', n: 3 }] },
  { layout: 'horiz', groups: [{ shape: 'flower', color: 'blue', n: 1 }, { shape: 'cross', color: 'red', n: 2 }] },
];

function showHelp(after, first = false) {
  const ex = HELP_SCENES;
  const names = ['One group', 'Mixed together', 'Stacked', 'Side by side'];
  showOverlay(`
    <h2>How to play</h2>
    <p>You have found the ruins of a people whose language nobody speaks. Each <b>tablet</b> pairs a picture with the sentence that describes it, <b>completely</b>: every group’s shape, colour and number (later: size), and how the groups are arranged.</p>
    <div class="help-pics">${ex.map((s, i) => `<figure>${sceneSVG(s)}<figcaption>${names[i]}</figcaption></figure>`).join('')}</div>
    <p><b>Tap any word</b> to gloss it with what you think it means. Your glosses appear under the word everywhere, and tablets without that word fade out so you can compare.</p>
    <p>Each chamber ends with challenges. <b>Write</b>: build the sentence for a picture. <b>Read</b>: pick the picture a sentence describes. <b>Mend</b>: find the one wrong word. A sentence may hold a word you have never seen: think about what it could be.</p>
    <p class="muted">Every challenge can be solved from what you have seen. Unsure? <b>Dig</b> up one more tablet, at the cost of a point. A wrong answer is not the end: the right one is carved into your codex.</p>
    <div class="help-row"><button class="btn ghost sm" data-act="patterns">${settings.patterns ? 'Colour patterns: on' : 'Colour patterns: off'}</button><span class="muted small">Adds stripes, dots and grids to the colours.</span></div>
    <button class="btn primary wide" data-ov="ok">${first ? 'Begin deciphering' : document.body.dataset.screen === 'game' ? 'Back to the tablets' : 'Got it'}</button>`, () => after && after(), 'help');
}

function showBackup() {
  showOverlay(`
    <h2>Backup</h2>
    <p>Move your progress to another browser or phone. Restoring only adds progress, it never removes any.</p>
    <div class="btn-row center"><button class="btn" data-act="copyCode">Copy backup code</button></div>
    <textarea id="codeBox" class="code" rows="4" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="Paste a backup code to restore"></textarea>
    <div class="btn-row center"><button class="btn primary" data-act="restoreCode">Restore</button><button class="btn ghost" data-ov="close">Close</button></div>`, null, 'backup');
}

async function copyCode() {
  const code = exportCode();
  try {
    await navigator.clipboard.writeText(code);
    toast('Backup code copied.');
  } catch {
    const box = $('#codeBox');
    box.value = code;
    box.select();
    toast('Copy the code from the box.');
  }
}

function restoreCode() {
  try {
    const n = importCode($('#codeBox').value);
    hideOverlay();
    renderTitle();
    toast(n > 0 ? `Restored. ${n} more tongue${n === 1 ? '' : 's'} deciphered.` : 'Restored.');
  } catch {
    toast('That is not a Glossa backup code.');
  }
}

/* ---------- end ---------- */

function renderEnd() {
  closeGloss();
  const t = totals();
  const seals = run.chambers.map((_, i) => sealOf(i));
  const rules = describeGrammar(run.lang);
  const lex = lexiconEntries(run.lang);
  const cost = t.mistakes + t.digs;
  const verdict = cost === 0 ? 'Flawless. Not one misstep.' : cost <= 2 ? 'A fine decipherment.' : cost <= 6 ? 'You got there.' : 'Hard-won, but won.';
  const inter = (e) => e ? `<div class="inter">${e.gloss.map((g, i) => `<span class="iw${g.suf ? ' suf' : ''}"><b>${g.suf ? '·' : ''}${g.s}</b><i>${esc(g.label)}</i></span>`).join('')}</div>` : '';
  let glossed = 0, right = 0;
  const seen = new Set(codexEntries().flatMap((e) => e.morphs.map((m) => m.s)));
  for (const k of Object.keys(lex)) lex[k] = lex[k].filter((e) => seen.has(e.s));
  const lexHTML = Object.entries(lex).filter(([, list]) => list.length).map(([name, list]) => `
    <div class="lex-group"><h4>${name}</h4>${list.map((e) => {
      const mine = save.glosses[e.s];
      const v = glossVerdict(e.k, mine);
      if (mine) glossed++;
      if (v) right++;
      return `<div class="lex-row"><b class="alien">${e.suf ? '·' : ''}${e.s}</b><span>${esc(e.label)}</span><span class="mine">${mine ? glossHTML(mine) : '<span class="muted">—</span>'}${v === true ? '<span class="ok">✓</span>' : v === false ? '<span class="no">✗</span>' : ''}</span></div>`;
    }).join('')}</div>`).join('');
  $('#end').innerHTML = `
    <div class="end-wrap">
      <div class="eyebrow">${save.mode === 'daily' ? 'Today’s tongue · ' + esc(save.date) : DIFF_LABEL[save.difficulty] + ' tongue'}</div>
      <h1>You speak <span class="alien">${esc(run.lang.name)}</span></h1>
      <div class="end-seals">${seals.map((s, i) => `<span class="seal ${s}" title="${ROMAN[i]}"></span>`).join('')}</div>
      <p class="score">${t.mistakes} mistake${t.mistakes === 1 ? '' : 's'} · ${t.digs} dig${t.digs === 1 ? '' : 's'}</p>
      <p class="verdict">${verdict}</p>
      <div class="btn-row center">
        <button class="btn" data-act="share">Copy result</button>
        <button class="btn primary" data-act="playFree">A new tongue</button>
        <button class="btn ghost" data-act="title">Title</button>
      </div>
      <h2>The grammar of ${esc(run.lang.name)}</h2>
      <div class="rules">${rules.map((r) => `<div class="rule"><h4>${esc(r.title)}</h4><p>${r.text}</p>${inter(r.example)}${inter(r.example2)}</div>`).join('')}</div>
      <h2>Lexicon</h2>
      <p class="muted small">${glossed ? `You glossed ${glossed} word${glossed === 1 ? '' : 's'}; ${right} checkable gloss${right === 1 ? '' : 'es'} right.` : 'You glossed no words. Next time, try tapping words to take notes.'}</p>
      <div class="lex">${lexHTML}</div>
    </div>`;
  show('end');
}

function shareText() {
  const t = totals();
  const seals = sealsText(run.chambers.map((_, i) => sealOf(i)));
  const head = save.mode === 'daily' ? `Glossa ${save.date}` : `Glossa · ${DIFF_LABEL[save.difficulty]}`;
  return `${head}\n${seals}\n${t.mistakes} mistake${t.mistakes === 1 ? '' : 's'} · ${t.digs} dig${t.digs === 1 ? '' : 's'}\n${location.origin}${location.pathname}`;
}

function toast(msg, { action, onAction, ms = 1800 } = {}) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('act', !!action);
  if (action) {
    const b = document.createElement('button');
    b.textContent = action;
    b.addEventListener('click', onAction);
    el.append(b);
  }
  el.classList.add('on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('on'), ms);
}

function renderAll() {
  renderHUD();
  renderCodex();
  renderPanel();
}

/* ---------- events ---------- */

function act(name, el) {
  switch (name) {
    case 'playDaily': sfx.tap(); return startRun('daily', 'scholar');
    case 'contDaily': sfx.tap(); return resumeRun('daily');
    case 'reviewDaily': sfx.tap(); return resumeRun('daily');
    case 'playFree': sfx.tap(); return startRun('free', settings.difficulty || 'scholar');
    case 'contFree': sfx.tap(); return resumeRun('free');
    case 'help': return showHelp();
    case 'backup': return showBackup();
    case 'copyCode': return copyCode();
    case 'restoreCode': return restoreCode();
    case 'title': return renderTitle();
    case 'sound':
      settings.muted = !settings.muted;
      setMuted(settings.muted);
      saveSettings();
      return renderHUD();
    case 'patterns':
      settings.patterns = !settings.patterns;
      setPatterns(settings.patterns);
      document.body.classList.toggle('patterns', settings.patterns);
      saveSettings();
      el.textContent = settings.patterns ? 'Colour patterns: on' : 'Colour patterns: off';
      $$('.help-pics figure svg').forEach((svg, i) => (svg.outerHTML = sceneSVG(HELP_SCENES[i])));
      if (document.body.dataset.screen === 'game') { renderCodex(); renderPanel(); }
      return;
    case 'collapse':
      if (window.innerWidth >= 900) return;
      ui.collapsed = !ui.collapsed;
      return $('#panel').classList.toggle('collapsed', ui.collapsed);
    case 'dig': return dig();
    case 'undo':
      if (ui.typed) ui.typed = '';
      else if (ui.compose.length) { ui.compose.pop(); sfx.remove(); }
      return renderAnswer();
    case 'clear':
      ui.compose = [];
      ui.typed = '';
      sfx.remove();
      return renderAnswer();
    case 'submit': return submit();
    case 'next': return next();
    case 'share': {
      const txt = shareText();
      const done = () => toast('Result copied.');
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, () => prompt('Copy your result:', txt));
      else prompt('Copy your result:', txt);
      return;
    }
  }
}

document.addEventListener('click', (e) => {
  const t = e.target;
  const gloss = $('#gloss');
  if (!gloss.classList.contains('hidden') && gloss.contains(t)) {
    if (t.closest('[data-gclose]')) return closeGloss();
    const g = t.closest('[data-g]');
    if (g) return setGloss(ui.glossFor, g.dataset.g);
    return;
  }
  const diffBtn = t.closest('[data-diff]');
  if (diffBtn) {
    settings.difficulty = diffBtn.dataset.diff;
    saveSettings();
    $$('[data-diff]').forEach((b) => {
      const on = b === diffBtn;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on);
    });
    $('#diffNote').textContent = diffNote(settings.difficulty);
    sfx.tap();
    return;
  }
  const fold = t.closest('[data-fold]');
  if (fold) {
    const c = +fold.dataset.fold;
    if (ui.folded.has(c)) ui.folded.delete(c); else ui.folded.add(c);
    fold.parentElement.classList.toggle('folded', ui.folded.has(c));
    return;
  }
  const tile = t.closest('[data-tile]');
  if (tile && save && save.phase === 'play') {
    tile.blur();
    return addTile(tile.dataset.tile, tile.dataset.suf === '1');
  }
  const ansM = t.closest('#answer .m');
  if (ansM && save.phase === 'play') {
    ui.compose.splice(+ansM.dataset.i, 1);
    sfx.remove();
    return renderAnswer();
  }
  const spotM = t.closest('.spot-sent.pickable .m');
  if (spotM && save.phase === 'play') {
    ui.sel = +spotM.dataset.i;
    sfx.select();
    return renderPanel();
  }
  const opt = t.closest('[data-opt]');
  if (opt && save.phase === 'play') {
    ui.sel = +opt.dataset.opt;
    sfx.select();
    return renderPanel();
  }
  const m = t.closest('#codex .m, .read-sent .m, .fb-line .m');
  if (m) {
    if (ui.glossFor === m.dataset.m) return closeGloss();
    return openGloss(m.dataset.m, m);
  }
  const a = t.closest('[data-act]');
  if (a) {
    if (a.dataset.act === 'collapse' && t.closest('.phead-r button[data-act="dig"]')) return;
    return act(a.dataset.act, a);
  }
  if (ui.glossFor) closeGloss();
});

document.addEventListener('keydown', (e) => {
  if (e.target && e.target.id === 'codeBox') return;
  if (e.target && e.target.id === 'gtext') {
    if (e.key === 'Enter') {
      const v = e.target.value.trim();
      setGloss(ui.glossFor, v ? 'T:' + v : '');
    } else if (e.key === 'Escape') closeGloss();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') {
    if (ui.glossFor) return closeGloss();
    return;
  }
  if (overlayOpen()) {
    if (e.key === 'Enter' || e.key === ' ') {
      const b = $('#overlay [data-ov]');
      if (b) { e.preventDefault(); b.click(); }
    }
    return;
  }
  if (document.body.dataset.screen !== 'game' || !save) return;
  if (save.phase === 'feedback') {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
    return;
  }
  if (save.phase !== 'play') return;
  const { c } = current();
  if (c.type === 'compose') {
    if (/^[a-z]$/.test(e.key)) {
      ui.typed += e.key;
      const known = knownMorphs(codexEntries());
      const exact = known.find((m) => m.s === ui.typed);
      const longer = known.some((m) => m.s !== ui.typed && m.s.startsWith(ui.typed));
      if (exact && !longer) addTile(exact.s, exact.suf);
      else renderAnswer();
      e.preventDefault();
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (ui.typed) {
        const exact = knownMorphs(codexEntries()).find((m) => m.s === ui.typed);
        if (exact) addTile(exact.s, exact.suf);
        else { toast(`No known word “${ui.typed}”.`); ui.typed = ''; renderAnswer(); }
      } else if (e.key === 'Enter') submit();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      act('undo');
    }
  } else if (c.type === 'read') {
    if (/^[1-4]$/.test(e.key)) { ui.sel = +e.key - 1; sfx.select(); renderPanel(); }
    else if (e.key === 'Enter') submit();
  } else {
    const n = c.morphs.length;
    if (e.key === 'ArrowRight') { ui.sel = ui.sel === null ? 0 : (ui.sel + 1) % n; renderPanel(); }
    else if (e.key === 'ArrowLeft') { ui.sel = ui.sel === null ? n - 1 : (ui.sel - 1 + n) % n; renderPanel(); }
    else if (e.key === 'Enter') submit();
  }
});

window.addEventListener('resize', () => {
  if (ui.glossFor) closeGloss();
});

window.glossaDebug = () => ({ run, save });

renderTitle();
initPWA({ onUpdate: () => toast('Glossa was updated.', { action: 'Reload', onAction: () => location.reload(), ms: 12000 }) });
