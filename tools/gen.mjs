import { generateRun } from '../public/js/curriculum.js';
import { formatMorphs } from '../public/js/lang.js';
const seed = process.argv[2] || 'test1';
const diff = process.argv[3] || 'scholar';
const t0 = performance.now();
const run = generateRun(seed, diff);
const t1 = performance.now();
console.log('time', (t1 - t0).toFixed(0), 'ms');
console.log(run.lang.name, JSON.stringify(run.lang.params));
console.log(run.lang.lex);
const sc = (s) => s.layout + ' ' + s.groups.map(g => `${g.n} ${g.small?'small ':''}${g.color} ${g.shape}`).join(' / ');
for (const ch of run.chambers) {
  console.log('\n==', ch.def.name);
  for (const e of ch.evidence) console.log('  E', formatMorphs(e.morphs).padEnd(40), sc(e.scene));
  for (const c of ch.challenges) {
    if (c.type === 'compose') console.log('  C compose', sc(c.scene), '=>', c.solutions.join(' | '));
    if (c.type === 'read') console.log('  C read', formatMorphs(c.morphs), '=>', sc(c.options[c.answer]), ' opts:', c.options.map(sc).join(' ; '));
    if (c.type === 'spot') console.log('  C spot', sc(c.scene), formatMorphs(c.morphs), 'wrong@', c.wrong, '=>', formatMorphs(c.solution));
  }
}
