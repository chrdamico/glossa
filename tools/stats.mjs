import { generateRun } from '../public/js/curriculum.js';
import { formatMorphs } from '../public/js/lang.js';
const N = +process.argv[2] || 300;
for (const d of ['novice', 'scholar', 'polyglot']) {
  const ev = Array(8).fill(0), types = {}, fails = [];
  let me = 0, reads = 0, totalTime = 0, maxTime = 0, totalEv = 0;
  const lens = [];
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    let run;
    try { run = generateRun('s' + i, d); } catch (e) { fails.push(i + ':' + e.message); continue; }
    const dt = performance.now() - t0; totalTime += dt; maxTime = Math.max(maxTime, dt);
    const known = new Set();
    run.chambers.forEach((ch, ci) => {
      ev[ci] += ch.evidence.length; totalEv += ch.evidence.length;
      ch.evidence.forEach(e => e.morphs.forEach(m => known.add(m.s)));
      ch.challenges.forEach(c => {
        const k = ci + ':' + c.type; types[k] = (types[k] || 0) + 1;
        if (c.type === 'read') { reads++; if (c.morphs.some(m => !known.has(m.s))) me++; }
        const ms = c.type === 'read' ? c.morphs : c.solution;
        lens.push(ms.length);
        ms.forEach(m => known.add(m.s));
      });
    });
  }
  console.log(`\n${d}: fails=${fails.length} avgTime=${(totalTime/N).toFixed(1)}ms max=${maxTime.toFixed(0)}ms`);
  console.log(' evidence/chamber', ev.map(x => (x / N).toFixed(1)).join(' '), ' total', (totalEv/N).toFixed(1));
  console.log(' ME reads', (me / reads * 100).toFixed(0) + '%', ' avg answer len', (lens.reduce((a,b)=>a+b,0)/lens.length).toFixed(1), 'max', Math.max(...lens));
  console.log(' types', JSON.stringify(types));
  if (fails.length) console.log(' fails', fails.slice(0, 5));
}
