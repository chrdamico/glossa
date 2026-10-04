import { trueSentences, SHAPE_CLASS, formatMorphs, REL_SUFFIX } from './lang.js';

export function baseKey(k) {
  return k.split('|')[0];
}

export function keyLabel(k) {
  const b = baseKey(k);
  const [t, v] = b.split(':');
  if (b === 'C:grue') return 'blue-green';
  if (t === 'S' || t === 'C') return v;
  if (t === 'N') return v;
  return {
    PL: 'PLURAL', DU: 'DUAL', DIM: 'SMALL', SMALL: 'small', CONJ: 'and',
    'AGR.r': 'ROUND', 'AGR.a': 'ANGULAR', 'CLS.r': 'ROUND-counter', 'CLS.a': 'ANGULAR-counter',
    'REL.V': 'VERTICAL', 'REL.H': 'BESIDE',
  }[b] || b;
}

const ACCEPT = {
  PL: ['G:pl'], DU: ['G:two', 'N:2'], DIM: ['G:small'], SMALL: ['G:small'], CONJ: ['G:and'],
  'REL.V': ['G:up', 'G:down'], 'REL.H': ['G:left', 'G:right'],
};

export function glossVerdict(key, gloss) {
  if (!gloss) return null;
  if (gloss.startsWith('T:') || gloss === 'G:?') return null;
  const b = baseKey(key);
  if (b === 'C:grue') return gloss === 'C:blue' || gloss === 'C:green';
  if (b.startsWith('S:') || b.startsWith('C:') || b.startsWith('N:')) return gloss === b;
  if (b.startsWith('AGR') || b.startsWith('CLS')) return gloss === 'G:A' || gloss === 'G:B' ? true : false;
  return (ACCEPT[b] || []).includes(gloss);
}

function interlinear(morphs) {
  return { text: formatMorphs(morphs), gloss: morphs.map((m) => ({ s: m.s, suf: m.suf, label: keyLabel(m.k) })) };
}

function ex(lang, scene) {
  return interlinear(trueSentences(lang, scene)[0]);
}

export function describeGrammar(lang) {
  const p = lang.params;
  const lx = lang.lex;
  const [s0, , , s3] = lang.shapes;
  const [c0, c1, c2] = lang.colors;
  const g = (shape, color, n = 1, small = false) => ({ shape, color, n, small });
  const single = (gr) => ({ layout: 'single', groups: [gr] });
  const rules = [];
  const sufForms = (k) => (p.harm ? `·${lx[k + '|f']} / ·${lx[k + '|b']}` : `·${lx[k]}`);

  rules.push({
    title: 'Naming a thing',
    text: p.na === 'NA' ? 'The colour comes after the noun.' : 'The colour comes before the noun.',
    example: ex(lang, single(g(s0, c0))),
  });

  const core = p.na === 'NA' ? ['noun', 'colour'] : ['colour', 'noun'];
  const order = [...core];
  order.splice(p.qpos, 0, 'number');
  const qText = `Inside a phrase the order is ${order.join(' · ')}. ` + (p.one ? 'Even a single thing is counted: “one”.' : 'A single thing gets no number at all.');
  rules.push({ title: 'Counting', text: qText, example: ex(lang, single(g(s0, c1, 3))) });

  if (p.plural === 'none') rules.push({ title: 'Plural', text: 'Nouns never change: the number word does all the work.', example: ex(lang, single(g(s3, c2, 2))) });
  if (p.plural === 'suffix') rules.push({ title: 'Plural', text: `More than one thing: the noun takes ${sufForms('PL')}.`, example: ex(lang, single(g(s3, c2, 2))) });
  if (p.plural === 'dual') rules.push({
    title: 'Dual and plural',
    text: `Exactly two things: the noun takes ${sufForms('DU')} and there is no number word. Three or more: a number, and the noun takes ${sufForms('PL')}.`,
    example: ex(lang, single(g(s3, c2, 2))),
    example2: ex(lang, single(g(s3, c2, 3))),
  });
  if (p.plural === 'redup') rules.push({ title: 'Plural', text: 'More than one thing: the noun is said twice.', example: ex(lang, single(g(s3, c2, 2))) });
  if (p.plural === 'adj') rules.push({ title: 'Plural', text: `More than one thing: not the noun but the colour word takes ${sufForms('PL')}.`, example: ex(lang, single(g(s3, c2, 2))) });
  if (p.plural === 'both') rules.push({ title: 'Plural', text: `More than one thing: the noun and the colour word both take ${sufForms('PL')}.`, example: ex(lang, single(g(s3, c2, 2))) });
  if (p.grue) rules.push({
    title: 'Blue is green',
    text: `The language has one colour word for both blue and green: “${lx['C:grue']}”.`,
    example: ex(lang, { layout: 'mixed', groups: [g(s0, 'blue', 1), g(s3, 'green', 1)] }),
  });

  if (p.nums !== 'simple') {
    const k = p.nums === 'base3' ? 3 : 4;
    rules.push({
      title: `Counting in ${k === 3 ? 'threes' : 'fours'}`,
      text: `There are number words only up to ${k}. Bigger numbers are built by adding: ${k + 1} is “${lx['N:' + k]} ${lx['N:1']}” (${k} + 1), ${k + 2} is “${lx['N:' + k]} ${lx['N:2']}” (${k} + 2).`,
      example: ex(lang, single(g(s0, c0, k + 2))),
    });
  }

  if (p.agr === 'suffix') rules.push({
    title: 'Two kinds of things',
    text: `Every shape is round or angular, and the colour word agrees with it: ${sufForms('AGR.r')} for round shapes, ${sufForms('AGR.a')} for angular ones.`,
    example: ex(lang, single(g(lang.shapes.find((s) => SHAPE_CLASS[s] === 'r'), c0))),
    example2: ex(lang, single(g(lang.shapes.find((s) => SHAPE_CLASS[s] === 'a'), c0))),
  });
  if (p.agr === 'classifier') rules.push({
    title: 'Counter words',
    text: `Every shape is round or angular. A number is followed by a counter word: “${lx['CLS.r']}” for round shapes, “${lx['CLS.a']}” for angular ones.`,
    example: ex(lang, single(g(lang.shapes.find((s) => SHAPE_CLASS[s] === 'r'), c0, 3))),
    example2: ex(lang, single(g(lang.shapes.find((s) => SHAPE_CLASS[s] === 'a'), c0, 3))),
  });
  if (p.harm) rules.push({
    title: 'Vowel harmony',
    text: 'Every suffix has two forms: one after a front vowel (e, i), one after a back vowel (a, o, u). ' +
      Object.keys(lx).filter((k) => k.endsWith('|f')).map((k) => `·${lx[k]} / ·${lx[k.slice(0, -2) + '|b']}`).join(', ') + '.',
  });

  const mix = { layout: 'mixed', groups: [g(s0, c0, 1), g(s3, c1, 2)] };
  const conjText = {
    medial: `“${lx.CONJ}” stands between the two groups.`,
    both: `“${lx.CONJ}” stands before each of the two groups.`,
    clitic: `${sufForms('CONJ')} is fixed to the end of the second group.`,
  }[p.conj];
  rules.push({ title: 'Together', text: `Two groups mixed together: ${conjText} Either group may come first.`, example: ex(lang, mix) });

  const rv = REL_SUFFIX.has(p.rel) ? sufForms('REL.V') : `“${lx['REL.V']}”`;
  const rh = REL_SUFFIX.has(p.rel) ? sufForms('REL.H') : `“${lx['REL.H']}”`;
  const relText = {
    FRG: `The upper (or left) group comes first, then ${rv} (or ${rh}), then the other group.`,
    GRF: `The lower (or right) group comes first, then ${rv} (or ${rh}), then the other group.`,
    FGR: `The upper (or left) group, then the other group, then ${rv} (or ${rh}) at the very end.`,
    GsF: `The lower (or right) group comes first and takes ${rv} (or ${rh}); then the upper (or left) group.`,
    FGs: `The upper (or left) group comes first; the lower (or right) group follows and takes ${rv} (or ${rh}).`,
    FsG: `The upper (or left) group comes first and takes ${rv} (or ${rh}); then the lower (or right) group.`,
  }[p.rel];
  rules.push({ title: 'Position', text: relText, example: ex(lang, { layout: 'vert', groups: [g(s0, c0), g(s3, c1, 2)] }) });

  const dimText = {
    suffix: `Small things: the noun takes ${sufForms('DIM')}.`,
    before: `Small things: the word “${lx.SMALL}” comes just before the noun.`,
    after: `Small things: the word “${lx.SMALL}” comes just after the noun.`,
  }[p.dim];
  rules.push({ title: 'Size', text: dimText, example: ex(lang, single(g(s3, c0, 2, true))) });
  return rules;
}

export function lexiconEntries(lang) {
  const groups = { Shapes: [], Colours: [], Numbers: [], Grammar: [] };
  for (const [k, s] of Object.entries(lang.lex)) {
    const b = baseKey(k);
    const entry = { k, s, label: keyLabel(k), suf: !/^(S|C|N):/.test(b) && isSuffixKey(lang, b) };
    if (b.startsWith('S:')) groups.Shapes.push(entry);
    else if (b.startsWith('C:')) groups.Colours.push(entry);
    else if (b.startsWith('N:')) groups.Numbers.push(entry);
    else groups.Grammar.push(entry);
  }
  groups.Shapes.sort((a, b) => lang.shapes.indexOf(a.label) - lang.shapes.indexOf(b.label));
  groups.Colours.sort((a, b) => lang.colors.indexOf(a.label) - lang.colors.indexOf(b.label));
  groups.Numbers.sort((a, b) => +a.label - +b.label);
  return groups;
}

function isSuffixKey(lang, b) {
  const p = lang.params;
  if (b === 'PL' || b === 'DU' || b === 'DIM' || b.startsWith('AGR')) return true;
  if (b === 'CONJ') return p.conj === 'clitic';
  if (b.startsWith('REL')) return REL_SUFFIX.has(p.rel);
  return false;
}
