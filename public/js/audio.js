let ctx = null;
let muted = false;

function ac() {
  if (muted) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(m) {
  muted = m;
}

function tone(freq, t0, dur, { type = 'sine', gain = 0.12, attack = 0.005, bend = 0 } = {}) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime + t0);
  if (bend) o.frequency.exponentialRampToValueAtTime(freq * bend, a.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + t0);
  o.stop(a.currentTime + t0 + dur + 0.05);
}

function knock(t0 = 0, freq = 900, gain = 0.18) {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * 0.05);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 3;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(a.destination);
  src.start(a.currentTime + t0);
}

export const sfx = {
  tap() { knock(0, 1300, 0.12); },
  place() { knock(0, 700, 0.22); tone(330, 0, 0.08, { type: 'triangle', gain: 0.03 }); },
  remove() { knock(0, 500, 0.14); },
  select() { tone(660, 0, 0.09, { type: 'triangle', gain: 0.04 }); },
  right() {
    tone(523.25, 0, 0.5, { type: 'triangle', gain: 0.08 });
    tone(783.99, 0.09, 0.6, { type: 'triangle', gain: 0.07 });
    tone(1046.5, 0.18, 0.8, { type: 'sine', gain: 0.05 });
  },
  wrong() {
    tone(196, 0, 0.35, { type: 'sawtooth', gain: 0.035, bend: 0.8 });
    knock(0, 220, 0.25);
  },
  dig() { knock(0, 300, 0.3); knock(0.08, 420, 0.22); knock(0.16, 260, 0.2); },
  cleared() {
    [392, 493.88, 587.33, 783.99, 987.77].forEach((fq, i) => tone(fq, i * 0.08, 0.9, { type: 'triangle', gain: 0.06 }));
  },
};
