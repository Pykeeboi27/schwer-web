// 2016-launch-video soundtrack: ukulele island strum, glockenspiel, kick, claps,
// in-key SFX, shared reverb. 120 BPM, C major. Writes audio.wav (44.1k stereo).
const fs = require("fs");
const SR = 44100,
  DUR = 23.5,
  N = Math.ceil(SR * DUR);
const BEAT = 0.5;
const L = new Float32Array(N),
  R = new Float32Array(N);
const sendL = new Float32Array(N),
  sendR = new Float32Array(N);

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

function add(buf, t0, gain, pan, send) {
  const s0 = Math.floor(t0 * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4),
    gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < buf.length; i++) {
    const j = s0 + i;
    if (j < 0 || j >= N) continue;
    L[j] += buf[i] * gl;
    R[j] += buf[i] * gr;
    sendL[j] += buf[i] * gl * send;
    sendR[j] += buf[i] * gr * send;
  }
}

// Karplus-Strong pluck (nylon-ish ukulele)
function pluck(freq, dur = 1.6, bright = 0.5) {
  const n = Math.floor(SR * dur),
    p = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(p);
  let lp = 0;
  for (let i = 0; i < p; i++) {
    lp = lp + bright * (rnd() - lp);
    line[i] = lp;
  }
  const out = new Float32Array(n);
  let idx = 0,
    prev = 0;
  for (let i = 0; i < n; i++) {
    const cur = line[idx];
    const nxt = 0.5 * (cur + prev) * 0.9965;
    prev = cur;
    line[idx] = nxt;
    out[i] = cur;
    idx = (idx + 1) % p;
  }
  for (let i = 0; i < 200 && i < n; i++) out[n - 1 - i] *= i / 200;
  return out;
}

function glock(freq, dur = 1.4) {
  const n = Math.floor(SR * dur),
    out = new Float32Array(n);
  const parts = [
    [1, 1, 2.2],
    [2.76, 0.32, 5],
    [5.4, 0.12, 9],
  ];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (const [m, a, d] of parts)
      v += a * Math.sin(2 * Math.PI * freq * m * t) * Math.exp(-d * t);
    out[i] = v * Math.min(1, t / 0.002);
  }
  return out;
}

function kick() {
  const n = Math.floor(SR * 0.35),
    out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR,
      f = 48 + 90 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    out[i] = Math.sin(ph) * Math.exp(-t * 9) * Math.min(1, t / 0.003);
  }
  return out;
}

// band-limited noise burst via two one-pole filters
function noiseBurst(dur, hpA, lpA, env) {
  const n = Math.floor(SR * dur),
    out = new Float32Array(n);
  let lp = 0,
    hpPrev = 0,
    hpOut = 0;
  for (let i = 0; i < n; i++) {
    const x = rnd();
    hpOut = hpA * (hpOut + x - hpPrev);
    hpPrev = x;
    lp += lpA * (hpOut - lp);
    out[i] = lp * env(i / SR);
  }
  return out;
}
const clap = () =>
  noiseBurst(0.22, 0.93, 0.35, (t) =>
    [0, 0.011, 0.022].reduce(
      (a, o) => a + (t >= o ? Math.exp(-(t - o) * (o === 0.022 ? 28 : 140)) : 0),
      0,
    ),
  );
const tickSfx = () => noiseBurst(0.03, 0.8, 0.6, (t) => Math.exp(-t * 300));

function whoosh(dur = 0.55) {
  const n = Math.floor(SR * dur),
    out = new Float32Array(n);
  let lp = 0,
    lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR,
      x = t / dur;
    const a = 0.01 + 0.25 * Math.sin(Math.PI * x);
    lp += a * (rnd() - lp);
    lp2 += a * (lp - lp2);
    out[i] = lp2 * Math.pow(Math.sin(Math.PI * x), 2);
  }
  return out;
}

// ---- Arrangement ----
// Ukulele (reentrant gCEA) voicings, low-to-high string order G C E A
const CH = {
  C: [67, 60, 64, 72],
  G: [67, 62, 67, 71],
  Am: [69, 60, 64, 69],
  F: [69, 60, 65, 69],
};
const prog = ["C", "G", "Am", "F"];

function strum(t, chord, down, gain) {
  const notes = down ? CH[chord] : [...CH[chord]].reverse();
  notes.forEach((m, k) => {
    const g = gain * (down ? 1 : 0.7) * (0.85 + 0.15 * rnd());
    add(pluck(midi(m), 1.4, down ? 0.55 : 0.4), t + k * 0.011, g, -0.25 + k * 0.12, 0.25);
  });
}

// Island strum: D . D U . U D U  (beats 0, 1, 1.5, 2.5, 3, 3.5)
const PATTERN = [
  [0, 1],
  [1, 1],
  [1.5, 0],
  [2.5, 0],
  [3, 1],
  [3.5, 0],
];
for (let bar = 0; bar < 9; bar++) {
  // 0–18s
  const chord = prog[bar % 4];
  for (const [b, d] of PATTERN)
    strum(bar * 2 + b * BEAT, chord, d, bar === 0 ? 0.22 : 0.26);
}
// 18.0–19.5: held G tension — tremolo strums swelling
for (let k = 0; k < 12; k++) strum(18 + k * 0.125, "G", k % 2 === 0, 0.06 + 0.012 * k);
// 19.5 resolve to C, then F, C ending
const tail = [
  [19.5, "C"],
  [20.0, "C"],
  [20.25, "C"],
  [20.5, "F"],
  [20.75, "F"],
];
tail.forEach(([t, c], i) => strum(t, c, i % 2 === 0, 0.2));
strum(21.0, "C", true, 0.32);

// Kick 1 & 3 from 3.0s; claps 2 & 4 from 6.0s
for (let t = 3.0; t < 18; t += 1.0) add(kick(), t, 0.55, 0, 0.02);
for (let t = 6.5; t < 18; t += 1.0) add(clap(), t, 0.16, 0.1, 0.4);
[19.5, 20.0, 20.5, 21.0].forEach((t) => add(kick(), t, 0.45, 0, 0.02));
[19.75, 20.25, 20.75].forEach((t) => add(clap(), t + 0.25, 0.16, 0.1, 0.4));

// Glockenspiel motif from 3.0s (per bar, follows chords)
const motif = {
  C: [76, 79, 84, 79],
  G: [74, 79, 83, 79],
  Am: [76, 81, 84, 81],
  F: [77, 81, 84, 81],
};
for (let bar = 2; bar < 9; bar++) {
  if ((bar >= 3 && bar < 5) || bar === 6 || bar === 8) continue; // leave room for the rail steps
  const c = prog[bar % 4];
  motif[c].forEach((m, k) =>
    add(
      glock(midi(m)),
      bar * 2 - 0.5 + 0.5 + k * BEAT * (k === 3 ? 1 : 0.75) + 0.5,
      0.06,
      0.35,
      0.5,
    ),
  );
}

// ---- SFX on the grid, in key ----
// typing ticks (very quiet)
const L1 = 15,
  L2 = 19;
for (let i = 0; i < L1; i++)
  add(tickSfx(), 0.15 + (i / L1) * 0.6, 0.05, -0.2 + 0.03 * (i % 5), 0.1);
for (let i = 0; i < L2; i++)
  add(tickSfx(), 0.95 + (i / L2) * 0.8, 0.05, -0.2 + 0.03 * (i % 5), 0.1);
// logo bars: rising glock C E G C G
[72, 76, 79, 84, 88].forEach((m, i) =>
  add(glock(midi(m), 1.0), 3.05 + i * 0.07, 0.07, -0.3 + i * 0.15, 0.5),
);
// wipes
[6.25, 10.25, 17.75].forEach((t) => add(whoosh(), t, 0.22, 0, 0.3));
// rail steps: C E G C
[
  [7.5, 72],
  [8.0, 76],
  [8.5, 79],
  [9.0, 84],
].forEach(([t, m]) => add(glock(midi(m)), t, 0.13, 0.2, 0.5));
// approve clicks + bell
[
  [11.5, 79],
  [12.25, 83],
  [13.25, 84],
].forEach(([t, m]) => {
  add(tickSfx(), t, 0.12, 0.2, 0.1);
  add(glock(midi(m), 1.0), t + 0.04, 0.09, 0.25, 0.5);
});
// header badge flips to Approved: two-note chime
add(glock(midi(84)), 13.7, 0.09, 0, 0.5);
add(glock(midi(88)), 13.78, 0.08, 0, 0.5);
// owner row slides in
add(whoosh(0.3), 12.38, 0.08, 0.3, 0.3);
// ₱ roll-up: tick run C D E G A C
[72, 74, 76, 79, 81, 84].forEach((m, i) =>
  add(glock(midi(m), 0.6), 16.0 + i * 0.08, 0.05, 0, 0.4),
);
add(glock(midi(84)), 16.5, 0.08, 0, 0.5);
// stamp: low thump + bright C chord
add(kick(), 19.5, 0.25, 0, 0.05);
[72, 76, 79, 84].forEach((m) => add(glock(midi(m), 1.8), 19.52, 0.045, 0, 0.5));
// outro: logo arpeggio + final ring
[72, 76, 79, 84, 88].forEach((m, i) =>
  add(glock(midi(m), 2.2), 21.05 + i * 0.07, 0.07, -0.3 + i * 0.15, 0.6),
);

// ---- Reverb (Schroeder: 4 combs + 2 allpasses per side) ----
function reverb(input, offs) {
  const out = new Float32Array(N);
  const combs = [1557, 1617, 1491, 1422].map((d) => d + offs);
  for (const d of combs) {
    const buf = new Float32Array(d);
    let k = 0,
      f = 0;
    for (let i = 0; i < N; i++) {
      const y = buf[k];
      f = y * 0.75 + f * 0.25;
      buf[k] = input[i] + f * 0.82;
      out[i] += y * 0.25;
      k = (k + 1) % d;
    }
  }
  for (const d of [225, 556].map((d) => d + offs)) {
    const buf = new Float32Array(d);
    let k = 0;
    for (let i = 0; i < N; i++) {
      const b = buf[k],
        x = out[i];
      const y = -x + b;
      buf[k] = x + b * 0.5;
      out[i] = y;
      k = (k + 1) % d;
    }
  }
  return out;
}
const rvL = reverb(sendL, 0),
  rvR = reverb(sendR, 23);
for (let i = 0; i < N; i++) {
  L[i] += rvL[i] * 0.35;
  R[i] += rvR[i] * 0.35;
}

// ---- Master: gentle glue + fade-out tail ----
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const pre = 1.15 / peak;
const out = Buffer.alloc(44 + N * 4);
let outPeak = 0;
const lim = (x) => Math.tanh(x * pre * 1.1) / Math.tanh(1.1 * 1.15);
const fade = (t) =>
  (t > 22.3 ? Math.max(0, 1 - (t - 22.3) / 1.2) : 1) * Math.min(1, t / 0.01);
const vals = [];
for (let i = 0; i < N; i++) {
  const f = fade(i / SR);
  const a = lim(L[i]) * f,
    b = lim(R[i]) * f;
  vals.push(a, b);
  outPeak = Math.max(outPeak, Math.abs(a), Math.abs(b));
}
const norm = 0.89 / outPeak; // ~ -1 dBFS
out.write("RIFF", 0);
out.writeUInt32LE(36 + N * 4, 4);
out.write("WAVE", 8);
out.write("fmt ", 12);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28);
out.writeUInt16LE(4, 32);
out.writeUInt16LE(16, 34);
out.write("data", 36);
out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < vals.length; i++)
  out.writeInt16LE(
    Math.round(Math.max(-1, Math.min(1, vals[i] * norm)) * 32767),
    44 + i * 2,
  );
fs.writeFileSync(__dirname + "/audio.wav", out);
console.log("audio.wav written", DUR + "s");
