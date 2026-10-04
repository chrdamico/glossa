import { realize, expand, morphKey, formatMorphs } from './lang.js';

export function initialHypotheses() {
  return [{ params: {}, lex: {}, rev: {} }];
}

function realizeAll(get, scenes) {
  return scenes.map((s) => realize(s, get));
}

export function alignTokens(params, lex, rev, toks, morphs) {
  if (toks.length !== morphs.length) return null;
  let nl = null, nr = null;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], m = morphs[i];
    if (!!t.suf !== !!m.suf) return null;
    const k = t.suf && params.harm ? t.k + '|' + vcl(morphs[i - 1].s) : t.k;
    const L = nl || lex;
    const cur = L[k];
    if (cur !== undefined) {
      if (cur !== m.s) return null;
      continue;
    }
    if ((nr || rev)[m.s] !== undefined) return null;
    if (!nl) { nl = { ...lex }; nr = { ...rev }; }
    nl[k] = m.s;
    nr[m.s] = k;
  }
  return { lex: nl || lex, rev: nr || rev };
}

function vcl(s) {
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i];
    if (c === 'e' || c === 'i') return 'f';
    if (c === 'a' || c === 'o' || c === 'u') return 'b';
  }
  return 'b';
}

export function observe(H, scene, morphs) {
  const out = [];
  for (const h of H) {
    for (const { params, result } of expand(h.params, (get) => realize(scene, get))) {
      for (const toks of result) {
        const r = alignTokens(params, h.lex, h.rev, toks, morphs);
        if (r) out.push({ params, lex: r.lex, rev: r.rev });
      }
    }
  }
  return out;
}

function predictStrings(params, lex, toks) {
  const strs = [];
  for (let i = 0; i < toks.length; i++) {
    const k = morphKey(toks, i, strs, params.harm);
    const s = lex[k];
    if (s === undefined) return null;
    strs.push(s);
  }
  return strs;
}

function toMorphs(strs, toks) {
  return strs.map((s, i) => ({ s, suf: !!toks[i].suf }));
}

export function predictCompose(H, scene) {
  let sig = null;
  let answers = null;
  for (const h of H) {
    for (const { params, result } of expand(h.params, (get) => realize(scene, get))) {
      const sents = [];
      for (const toks of result) {
        const strs = predictStrings(params, h.lex, toks);
        if (!strs) return { determined: false, reason: 'unknown' };
        sents.push(formatMorphs(toMorphs(strs, toks)));
      }
      const s = [...new Set(sents)].sort().join('||');
      if (sig === null) { sig = s; answers = [...new Set(sents)]; }
      else if (sig !== s) return { determined: false, reason: 'ambiguous' };
    }
  }
  return { determined: sig !== null, answers };
}

export function checkRead(H, morphs, options, answer) {
  let any = false;
  for (const h of H) {
    for (const { params, result } of expand(h.params, (get) => realizeAll(get, options))) {
      const ok = [];
      result.forEach((alts, j) => {
        if (alts.some((toks) => alignTokens(params, h.lex, h.rev, toks, morphs))) ok.push(j);
      });
      if (!ok.length) continue;
      if (ok.length !== 1 || ok[0] !== answer) return false;
      any = true;
    }
  }
  return any;
}

export function checkSpot(H, scene, morphs, wrong) {
  let any = false;
  for (const h of H) {
    for (const { params, result } of expand(h.params, (get) => realize(scene, get))) {
      const pos = new Set();
      for (const toks of result) {
        if (toks.length !== morphs.length) continue;
        if (toks.some((t, i) => !!t.suf !== !!morphs[i].suf)) continue;
        const strs = predictStrings(params, h.lex, toks);
        if (!strs) return false;
        const mism = [];
        for (let i = 0; i < strs.length; i++) if (strs[i] !== morphs[i].s) mism.push(i);
        if (mism.length === 1) pos.add(mism[0]);
      }
      if (!pos.size) continue;
      if (pos.size !== 1 || !pos.has(wrong)) return false;
      any = true;
    }
  }
  return any;
}

export function hypothesisCount(H) {
  return H.length;
}
