// Síntesis: reverb, bucles sin cortes, tonos de meditación y gongs.
// Todo se programa por adelantado en el reloj de audio, así sigue sonando
// aunque el JavaScript se duerma con la pantalla bloqueada.

export function rng(seed = 1) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeReverbIR(ctx, seconds = 5.5, decay = 3.4) {
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      lp += (0.8 - 0.68 * t) * ((Math.random() * 2 - 1) - lp);
      const pre = i < sr * 0.012 ? i / (sr * 0.012) : 1;
      d[i] = lp * Math.pow(1 - t, decay) * pre;
    }
  }
  return buf;
}

// Convierte un buffer en un bucle perfecto: recorta silencio del códec
// y funde el final con el principio.
export function makeLoop(ctx, buf, xf = 2.5) {
  const sr = buf.sampleRate, ch = buf.numberOfChannels;
  const c0 = buf.getChannelData(0), th = 1e-4, maxTrim = Math.floor(sr * 0.25);
  let s = 0, e = buf.length;
  while (s < maxTrim && Math.abs(c0[s]) < th) s++;
  while (e > buf.length - maxTrim && Math.abs(c0[e - 1]) < th) e--;
  const L = e - s;
  const X = Math.min(Math.floor(xf * sr), Math.floor(L / 4));
  const out = ctx.createBuffer(ch, L - X, sr);
  for (let c = 0; c < ch; c++) {
    const inp = buf.getChannelData(c), o = out.getChannelData(c);
    for (let i = 0; i < X; i++) {
      const t = (i / X) * Math.PI / 2;
      o[i] = inp[s + i] * Math.sin(t) + inp[s + L - X + i] * Math.cos(t);
    }
    o.set(inp.subarray(s + X, s + L - X), X);
  }
  return out;
}

function noiseBuffer(ctx, seconds, kind = 'white', channels = 2) {
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(channels, len, sr);
  for (let c = 0; c < channels; c++) {
    const d = buf.getChannelData(c);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5; }
      else d[i] = w;
    }
  }
  return buf;
}

function lfo(ctx, param, freq, depth, t0, t1, reg, type = 'sine') {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = depth;
  o.connect(g).connect(param);
  o.start(t0); o.stop(t1); reg.push(o);
  return o;
}

function osc(ctx, type, freq, dest, t0, t1, reg, detune = 0) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
  o.connect(dest); o.start(t0); o.stop(t1); reg.push(o);
  return o;
}

// ---------- Notas tipo handpan (síntesis aditiva renderizada una vez) ----------
// Escala «Amara» (celta menor) en Re: dulce, abierta, muy meditativa.
const GARDEN_MEL = [293.66, 329.63, 349.23, 392, 440, 523.25, 587.33, 659.26];
const GARDEN_BASS = [146.83, 220];
let gardenCache = null;

async function renderPan(sr, f, dur, seed) {
  const r = rng(seed);
  const oc = new OfflineAudioContext(1, Math.floor(sr * dur), sr);
  const out = oc.createGain(); out.connect(oc.destination);
  // tono fundamental, octava y quinta sobre la octava: los armónicos afinados de un handpan
  [[1, 1, dur * 0.95], [2, 0.42, dur * 0.55], [3, 0.16, dur * 0.3], [4.02, 0.05, dur * 0.15]].forEach(([ratio, a, t60], k) => {
    for (const det of [0, 0.35 + r() * 0.4]) {
      const o = oc.createOscillator(); o.frequency.value = f * ratio + det;
      const g = oc.createGain();
      g.gain.setValueAtTime(0, 0);
      g.gain.linearRampToValueAtTime(a * 0.5, 0.006 + k * 0.004);
      g.gain.setTargetAtTime(0, 0.01, t60 / 6.91);
      o.connect(g).connect(out); o.start(0); o.stop(dur);
    }
  });
  // golpe suave del dedo
  const n = oc.createBufferSource(); n.buffer = noiseBuffer(oc, 0.2, 'white', 1);
  const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(1800, f * 3);
  const ng = oc.createGain(); ng.gain.setValueAtTime(0.12, 0); ng.gain.setTargetAtTime(0, 0.002, 0.012);
  n.connect(lp).connect(ng).connect(out); n.start(0);
  const b = await oc.startRendering();
  const d = b.getChannelData(0); let pk = 0;
  for (let k = 0; k < d.length; k++) pk = Math.max(pk, Math.abs(d[k]));
  for (let k = 0; k < d.length; k++) d[k] /= pk || 1;
  return b;
}

async function gardenSamples(sr) {
  if (gardenCache && gardenCache.sr === sr) return gardenCache;
  const mel = await Promise.all(GARDEN_MEL.map((f, i) => renderPan(sr, f, 5.5, 10 + i)));
  const bass = await Promise.all(GARDEN_BASS.map((f, i) => renderPan(sr, f, 8, 40 + i)));
  gardenCache = { sr, mel, bass };
  return gardenCache;
}

// Algunos tonos necesitan preparar muestras antes de sonar.
export async function prepareTone(id, ctx) {
  if (id === 'jardin') await gardenSamples(ctx.sampleRate);
}

// ---------- Tonos ----------
// Cada tono: (ctx, dest, t0, t1, reg) -> conecta a dest y registra los nodos en reg.
export const TONE_BUILDERS = {
  jardin(ctx, dest, t0, t1, reg) {
    const S = gardenCache;
    if (!S) return;
    const r = rng((Math.random() * 1e9) | 0);
    const out = ctx.createGain(); out.gain.value = 0.6; out.connect(dest);
    // cama muy suave de Re y La para que las notas no floten en el vacío
    const bed = ctx.createGain(); bed.gain.value = 0.035; bed.connect(out);
    lfo(ctx, bed.gain, 0.03, 0.015, t0, t1, reg);
    osc(ctx, 'sine', 73.42, bed, t0, t1, reg);
    osc(ctx, 'sine', 110, bed, t0, t1, reg, 3);
    osc(ctx, 'sine', 146.83, bed, t0, t1, reg, -2);
    const note = (buf, t, vel, pan) => {
      const s = ctx.createBufferSource(); s.buffer = buf;
      const g = ctx.createGain(); g.gain.value = vel;
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      s.connect(g).connect(p).connect(out);
      s.start(t); reg.push(s);
    };
    let t = t0 + 2 + r() * 2, idx = 3;
    const steps = [-1, -1, 1, 1, -2, 2, 0];
    while (t < t1 - 4) {
      if (r() < 0.55) note(S.bass[r() < 0.7 ? 0 : 1], t, 0.55, 0);
      const phrase = 2 + Math.floor(r() * 4);
      for (let k = 0; k < phrase && t < t1 - 4; k++) {
        idx = Math.max(0, Math.min(GARDEN_MEL.length - 1, idx + steps[Math.floor(r() * steps.length)]));
        note(S.mel[idx], t, 0.3 + r() * 0.35, r() * 1.0 - 0.5);
        if (r() < 0.15) note(S.mel[Math.max(0, idx - 2)], t + 0.03, 0.18, r() - 0.5);
        t += 0.9 + r() * 1.6;
      }
      t += 3.5 + r() * 6;
    }
  },

  pad(ctx, dest, t0, t1, reg) {
    const notes = [146.83, 185, 220, 293.66, 369.99];
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 900; filt.Q.value = 0.4;
    lfo(ctx, filt.frequency, 0.018, 200, t0, t1, reg);
    const out = ctx.createGain(); out.gain.value = 0.36;
    filt.connect(out).connect(dest);
    notes.forEach((f, i) => {
      const vg = ctx.createGain(); vg.gain.value = 0.05 / (1 + i * 0.25);
      lfo(ctx, vg.gain, 0.03 + i * 0.013, 0.03 / (1 + i * 0.25), t0, t1, reg);
      vg.connect(filt);
      osc(ctx, 'triangle', f, vg, t0, t1, reg, -5);
      osc(ctx, 'triangle', f, vg, t0, t1, reg, 6);
      osc(ctx, 'sawtooth', f, vg, t0, t1, reg, 0);
    });
  },

  cuencos(ctx, dest, t0, t1, reg) {
    const bowls = [146.83, 220, 329.63];
    const parts = [[1, 1], [2.71, 0.3], [5.15, 0.09]];
    const out = ctx.createGain(); out.gain.value = 0.165; out.connect(dest);
    bowls.forEach((f, b) => {
      const bg = ctx.createGain(); bg.gain.value = 0.5 / (1 + b * 0.4);
      lfo(ctx, bg.gain, 0.027 + b * 0.017, 0.5 / (1 + b * 0.4), t0, t1, reg);
      const pan = ctx.createStereoPanner(); pan.pan.value = [-0.45, 0.45, 0][b];
      bg.connect(pan).connect(out);
      parts.forEach(([ratio, amp], k) => {
        const pg = ctx.createGain(); pg.gain.value = amp * 0.25; pg.connect(bg);
        osc(ctx, 'sine', f * ratio, pg, t0, t1, reg);
        osc(ctx, 'sine', f * ratio + 0.7 + k * 0.9 + b * 0.3, pg, t0, t1, reg);
      });
    });
  },

  om(ctx, dest, t0, t1, reg) {
    const f = 110;
    const out = ctx.createGain(); out.gain.value = 0.154;
    lfo(ctx, out.gain, 1 / 11, 0.056, t0, t1, reg);
    out.connect(dest);
    const src = ctx.createGain(); src.gain.value = 0.35;
    osc(ctx, 'sawtooth', f, src, t0, t1, reg, -3);
    osc(ctx, 'sawtooth', f, src, t0, t1, reg, 4);
    [[480, 5, 1], [820, 7, 0.4]].forEach(([fc, q, a]) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fc; bp.Q.value = q;
      lfo(ctx, bp.frequency, 0.05 + fc / 40000, fc * 0.06, t0, t1, reg);
      const g = ctx.createGain(); g.gain.value = a * 1.6;
      src.connect(bp).connect(g).connect(out);
    });
    const sub = ctx.createGain(); sub.gain.value = 0.22; sub.connect(out);
    osc(ctx, 'sine', f, sub, t0, t1, reg);
    osc(ctx, 'sine', f * 2, sub, t0, t1, reg, 2);
  },

  cristal(ctx, dest, t0, t1, reg) {
    const fs = [587.33, 880, 1174.66, 1318.51, 1760, 2349.32];
    const out = ctx.createGain(); out.gain.value = 0.07; out.connect(dest);
    fs.forEach((f, i) => {
      const g = ctx.createGain(); const a = 0.5 / (1 + i * 0.35);
      g.gain.value = a * 0.5;
      lfo(ctx, g.gain, 0.045 + i * 0.019, a * 0.5, t0, t1, reg);
      const p = ctx.createStereoPanner(); p.pan.value = (i % 2 ? 1 : -1) * (0.2 + i * 0.1);
      g.connect(p).connect(out);
      osc(ctx, 'sine', f, g, t0, t1, reg);
      osc(ctx, 'sine', f * 1.0015, g, t0, t1, reg);
    });
  },

  theta(ctx, dest, t0, t1, reg) {
    const m = ctx.createChannelMerger(2);
    const out = ctx.createGain(); out.gain.value = 0.036;
    m.connect(out).connect(dest);
    const l = ctx.createGain(), r = ctx.createGain();
    l.connect(m, 0, 0); r.connect(m, 0, 1);
    osc(ctx, 'sine', 196, l, t0, t1, reg);
    osc(ctx, 'sine', 202, r, t0, t1, reg);
  },

  marron(ctx, dest, t0, t1, reg) {
    const s = ctx.createBufferSource(); s.buffer = makeLoop(ctx, noiseBuffer(ctx, 12, 'brown'), 2); s.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = ctx.createGain(); g.gain.value = 0.22;
    s.connect(lp).connect(g).connect(dest);
    s.start(t0); s.stop(t1); reg.push(s);
  },
};

// Nivel de cada tono y cuánto va a la reverb
export const TONE_SEND = { jardin: 0.75, pad: 0.6, cuencos: 0.55, om: 0.35, cristal: 0.9, theta: 0, marron: 0 };

// ---------- Gongs (renderizados una vez a buffer) ----------
export const GONG_SPACING = { cuenco: 7, rin: 4.5, grave: 9 };

function partial(oc, out, f, amp, t60, at, o = {}) {
  const beat = o.beat || 0, pan = o.pan || 0, attack = o.attack || 0.004;
  const branches = beat ? [[f, pan - 0.35], [f + beat, pan + 0.35]] : [[f, pan]];
  for (const [freq, pn] of branches) {
    const g = oc.createGain();
    const a = amp / branches.length;
    g.gain.setValueAtTime(0, at);
    if (o.bloom) {
      g.gain.linearRampToValueAtTime(a * 0.25, at + attack);
      g.gain.linearRampToValueAtTime(a, at + o.bloom);
      g.gain.setTargetAtTime(0, at + o.bloom, t60 / 6.91);
    } else {
      g.gain.linearRampToValueAtTime(a, at + attack);
      g.gain.setTargetAtTime(0, at + attack, t60 / 6.91);
    }
    const p = oc.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pn));
    const ob = oc.createOscillator(); ob.frequency.value = freq;
    if (o.glide) {
      ob.frequency.setValueAtTime(freq * (1 + o.glide), at);
      ob.frequency.setTargetAtTime(freq, at, 0.35);
    }
    ob.connect(g).connect(p).connect(out);
    ob.start(at); ob.stop(Math.min(oc.length / oc.sampleRate, at + t60 * 1.2 + (o.bloom || 0)));
  }
}

function noiseHit(oc, out, at, fc, q, amp, tau, wash) {
  const s = oc.createBufferSource(); s.buffer = noiseBuffer(oc, wash ? 6 : 0.4, 'white', 2);
  const bp = oc.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fc; bp.Q.value = q;
  const g = oc.createGain();
  g.gain.setValueAtTime(0, at);
  if (wash) { g.gain.linearRampToValueAtTime(amp, at + wash); g.gain.setTargetAtTime(0, at + wash, tau); }
  else { g.gain.linearRampToValueAtTime(amp, at + 0.0015); g.gain.setTargetAtTime(0, at + 0.0015, tau); }
  s.connect(bp).connect(g).connect(out); s.start(at);
}

const GONG_BUILDERS = {
  cuenco(oc, out) {
    const f0 = 182;
    [[1, 1, 34, 0.9], [2.72, 0.55, 20, 1.7], [5.12, 0.3, 9, 2.6], [8.3, 0.13, 5, 3.3], [12.0, 0.05, 3, 4.1]]
      .forEach(([r, a, t, b], i) => partial(oc, out, f0 * r, a, t, 0, { beat: b, pan: (i % 2 ? 0.15 : -0.15), attack: 0.006 }));
    noiseHit(oc, out, 0, 950, 1.2, 0.22, 0.014);
    return 30;
  },
  rin(oc, out) {
    const f0 = 624;
    [[1, 1, 15, 0.55], [2.76, 0.7, 9, 1.2], [5.3, 0.38, 5, 1.9], [8.7, 0.18, 3, 2.6], [12.9, 0.07, 1.8, 3.2]]
      .forEach(([r, a, t, b], i) => partial(oc, out, f0 * r, a, t, 0, { beat: b, pan: (i % 2 ? 0.2 : -0.2), attack: 0.002 }));
    noiseHit(oc, out, 0, 3600, 2, 0.28, 0.006);
    return 15;
  },
  grave(oc, out) {
    const f0 = 116;
    [[1, 1, 40, 0.6], [2.7, 0.5, 24, 1.3], [5.1, 0.22, 11, 2.1], [8.2, 0.08, 6, 2.8]]
      .forEach(([r, a, t, b], i) => partial(oc, out, f0 * r, a, t, 0, { beat: b, pan: (i % 2 ? 0.2 : -0.2), attack: 0.012 }));
    partial(oc, out, f0 * 2, 0.12, 18, 0, { beat: 0.4, attack: 0.02 });
    noiseHit(oc, out, 0, 600, 1, 0.14, 0.02);
    return 34;
  },
};

export async function renderGong(type, sr) {
  const lengths = { cuenco: 30, rin: 15, grave: 34 };
  const oc = new OfflineAudioContext(2, Math.floor(sr * lengths[type]), sr);
  const out = oc.createGain(); out.connect(oc.destination);
  GONG_BUILDERS[type](oc, out);
  const buf = await oc.startRendering();
  let peak = 0;
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
  const k = 0.8 / (peak || 1);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; }
  return buf;
}

export function silentWavURL() {
  const sr = 8000, n = sr * 2, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.random() < 0.5 ? 1 : -1, true);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}
