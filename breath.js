class BreathAnalyzer {
  constructor(fs = 20, keepSec = 60) {
    this.fs = fs;
    this.max = fs * keepSec;
    this.level = [];
    this.act = [];
    this.floor = null;
    this.peak = null;
    this.active = false;
    this.n = 0;
    this.span = 0;
  }

  push(rms) {
    const e = Math.log10(rms + 1e-7);
    if (this.floor === null) {
      this.floor = e;
      this.peak = e + 0.4;
    }
    this.floor += (e < this.floor ? 0.25 : 0.0015) * (e - this.floor);
    this.peak += (e > this.peak ? 0.3 : 0.004) * (e - this.peak);
    this.span = this.peak - this.floor;
    if (this.peak < this.floor + 0.35) this.peak = this.floor + 0.35;
    const span = this.peak - this.floor;
    const on = this.floor + 0.45 * span;
    const off = this.floor + 0.3 * span;
    this.active = this.span >= 0.4 && (this.active ? e > off : e > on);
    const norm = Math.min(1, Math.max(0, (e - this.floor) / span));
    this.level.push(norm);
    this.act.push(this.active ? 1 : 0);
    if (this.level.length > this.max) {
      this.level.shift();
      this.act.shift();
    }
    this.n++;
    return this.active;
  }

  get calibrating() {
    return this.n < this.fs * 3;
  }

  activeSeconds(sec) {
    const k = Math.min(this.act.length, Math.round(sec * this.fs));
    let s = 0;
    for (let i = this.act.length - k; i < this.act.length; i++) s += this.act[i];
    return s / this.fs;
  }

  estimate(windowSec = 30) {
    const fs = this.fs;
    const N = Math.min(this.level.length, windowSec * fs);
    if (N < fs * 10 || this.span < 0.4) return null;
    const x = this.level.slice(this.level.length - N);
    const mean = x.reduce((a, b) => a + b, 0) / N;
    for (let i = 0; i < N; i++) x[i] -= mean;
    let e0 = 0;
    for (let i = 0; i < N; i++) e0 += x[i] * x[i];
    if (e0 / N < 0.004) return null;
    const minLag = Math.round(fs * 1.5);
    const maxLag = Math.min(Math.round(fs * 15), Math.floor(N / 2));
    const r = new Array(maxLag + 2).fill(0);
    for (let lag = 1; lag <= maxLag + 1; lag++) {
      let s = 0;
      for (let i = 0; i + lag < N; i++) s += x[i] * x[i + lag];
      r[lag] = (s / (N - lag)) / (e0 / N);
    }
    let best = -1;
    let L = minLag;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (r[lag] > r[lag - 1] && r[lag] >= r[lag + 1] && r[lag] > best) {
        best = r[lag];
        L = lag;
      }
    }
    if (best < 0.25) return null;
    while (L / 2 >= minLag) {
      const h = Math.round(L / 2);
      if (r[h] > 0.85 * best) {
        L = h;
        best = r[h];
      } else break;
    }
    const a = r[L - 1];
    const b = r[L];
    const c = r[L + 1] ?? b;
    const den = a - 2 * b + c;
    const shift = den !== 0 ? 0.5 * (a - c) / den : 0;
    const period = (L + Math.max(-0.5, Math.min(0.5, shift))) / fs;
    return { rate: 60 / period, regularity: Math.max(0, Math.min(1, best)) };
  }
}

class Pacer {
  constructor(steps) {
    this.steps = steps;
    this.cycle = steps.reduce((a, s) => a + s.d, 0);
  }

  at(t) {
    const idx = Math.floor(t / this.cycle);
    let tt = t - idx * this.cycle;
    for (const s of this.steps) {
      if (tt < s.d) return { kind: s.k, prog: tt / s.d, remain: s.d - tt, dur: s.d, cycle: idx };
      tt -= s.d;
    }
    const last = this.steps[this.steps.length - 1];
    return { kind: last.k, prog: 1, remain: 0, dur: last.d, cycle: idx };
  }

  get rate() {
    return 60 / this.cycle;
  }
}

function simulatedRms(t, pacer) {
  const lag = 0.25;
  const p = pacer.at(Math.max(0, t - lag));
  const noise = 0.0025 * (0.75 + 0.5 * Math.random());
  let amp = 0;
  if (p.kind === 'exhale') {
    const fill = p.cycle < 1 ? 0.5 : 0.92;
    const elapsed = p.prog * p.dur;
    const len = fill * p.dur;
    if (elapsed < len) amp = 0.06 * Math.sin(Math.PI * elapsed / len) ** 0.6;
  } else if (p.kind === 'inhale') {
    amp = 0.012 * Math.sin(Math.PI * p.prog) ** 0.8;
  }
  return noise + amp * (0.85 + 0.3 * Math.random());
}

if (typeof module !== 'undefined') module.exports = { BreathAnalyzer, Pacer, simulatedRms };
