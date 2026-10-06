// Motor de audio: mezcla capas, automatiza volúmenes por tramos y programa gongs.
import { makeReverbIR, makeLoop, TONE_BUILDERS, TONE_SEND, renderGong, GONG_SPACING, silentWavURL } from './synth.js';
import { userSounds } from './store.js';

const LONG = 300;          // audios propios más largos que esto se reproducen en streaming
const MAX_CACHED = 7;      // bucles decodificados en memoria (iPhone agradece no pasarse)

export const perceptual = v => Math.pow(Math.max(0, Math.min(1, v)), 2);

function curve(p0, p1, n = 128) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const e = 0.5 - 0.5 * Math.cos(Math.PI * (i / (n - 1)));
    a[i] = perceptual(p0 + (p1 - p0) * e);
  }
  return a;
}

// Línea de tiempo de una sesión: tramos con inicio/fin y lista de gongs.
export function plan(s) {
  const phases = [];
  let t = 0;
  s.phases.forEach((p, i) => {
    const dur = Math.max(0.5, +p.min || 1) * 60;
    phases.push({ ...p, i, start: t, end: t + dur, dur });
    t += dur;
  });
  const D = t, gongs = [];
  if (s.gongs.start) gongs.push({ ...s.gongs.start, t: 0, kind: 'start' });
  phases.forEach((p, i) => { if (i > 0 && p.gong) gongs.push({ ...p.gong, t: p.start, kind: 'phase', phase: i }); });
  (s.gongs.extra || []).forEach((g, k) => { if (g.at > 0 && g.at < D) gongs.push({ ...g, t: g.at, kind: 'extra', k }); });
  if (s.gongs.end) gongs.push({ ...s.gongs.end, t: D, kind: 'end' });
  gongs.sort((a, b) => a.t - b.t);
  return { phases, D, gongs };
}

// Quita el silencio inicial de una grabación (para que el golpe caiga a su hora).
function trimLead(ctx, buf) {
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
  const th = peak * 0.08, d0 = buf.getChannelData(0);
  let s = 0;
  while (s < d0.length && Math.abs(d0[s]) < th) s++;
  s = Math.max(0, s - Math.floor(buf.sampleRate * 0.02));
  if (s < buf.sampleRate * 0.05) return buf;
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length - s, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(s), c);
  return out;
}

const stopAll = reg => reg.forEach(n => { try { n.stop(); } catch { } });

export class Engine {
  constructor() {
    this.ctx = null;
    this.loops = new Map();     // id -> Promise<AudioBuffer> (bucle sin cortes)
    this.gongs = new Map();     // type -> Promise<AudioBuffer>
    this.previews = new Map();
    this.session = null;
    this.userMeta = new Map();
    this.onstate = null;
  }

  setUserMeta(list) { this.userMeta = new Map(list.map(u => [u.id, u])); }

  // Llamar SIEMPRE dentro de un toque del usuario (iOS).
  unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { }
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = this.ctx = new AC({ latencyHint: 'playback' });
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -5; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.004; lim.release.value = 0.3;
      this.master = ctx.createGain();
      this.master.connect(lim).connect(ctx.destination);
      // Ganancia de compensación para ambientes y tonos (los gongs van aparte, sin ella)
      this.mk = ctx.createGain(); this.mk.gain.value = 3.2; this.mk.connect(this.master);
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = makeReverbIR(ctx);
      const ret = ctx.createGain(); ret.gain.value = 0.6;
      this.reverb.connect(ret).connect(this.mk);
      this.gongBus = ctx.createGain(); this.gongBus.connect(this.master);
      const gs = ctx.createGain(); gs.gain.value = 0.08;
      this.gongBus.connect(gs).connect(this.reverb);
      this.previewBus = ctx.createGain(); this.previewBus.connect(this.mk);
      this.keep = new Audio(silentWavURL());
      this.keep.loop = true;
      this.keep.setAttribute('playsinline', '');
      ctx.onstatechange = () => this.onstate && this.onstate(ctx.state);
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => { });
    this.holdAudio(true);
    return this.ctx;
  }

  holdAudio(on) {
    if (!this.keep) return;
    if (on) this.keep.play().catch(() => { });
    else this.keep.pause();
  }

  isLongUser(id) { const u = this.userMeta.get(id); return !!u && u.duration > LONG; }

  async decode(id) {
    let arr;
    if (id.startsWith('u_')) {
      const rec = await userSounds.get(id);
      if (!rec) throw new Error('Sonido no encontrado');
      arr = await rec.blob.arrayBuffer();
    } else {
      const r = await fetch(`sounds/${id}.m4a`);
      if (!r.ok) throw new Error('No se pudo cargar ' + id);
      arr = await r.arrayBuffer();
    }
    return await this.ctx.decodeAudioData(arr);
  }

  loopBuffer(id) {
    if (this.loops.has(id)) {
      const p = this.loops.get(id);
      this.loops.delete(id); this.loops.set(id, p);  // marcar como reciente
      return p;
    }
    const p = this.decode(id).then(b => makeLoop(this.ctx, b, 2.5));
    p.catch(() => this.loops.delete(id));
    this.loops.set(id, p);
    this.evict();
    return p;
  }

  evict() {
    const used = new Set([...this.previews.keys(), ...(this.session ? this.session.ids : []), ...(this.loading || [])]);
    for (const k of this.loops.keys()) {
      if (this.loops.size <= MAX_CACHED) break;
      if (!used.has(k)) this.loops.delete(k);
    }
  }

  gongBuffer(type) {
    if (!this.gongs.has(type)) {
      const p = type.startsWith('u_') ? this.decode(type).then(b => trimLead(this.ctx, b)) : renderGong(type, this.ctx.sampleRate);
      p.catch(() => this.gongs.delete(type));
      this.gongs.set(type, p);
    }
    return this.gongs.get(type);
  }

  forgetUser(id) { this.loops.delete(id); this.gongs.delete(id); }

  async makeLayer(id, bus, t0, t1, reg, pre) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(bus);
    const tone = TONE_BUILDERS[id];
    if (tone) {
      tone(ctx, g, t0, t1, reg);
      if (TONE_SEND[id]) { const sg = ctx.createGain(); sg.gain.value = TONE_SEND[id]; g.connect(sg).connect(this.reverb); }
      return { gain: g };
    }
    if (this.isLongUser(id)) {
      const rec = await userSounds.get(id);
      const url = URL.createObjectURL(rec.blob);
      const el = new Audio(url); el.loop = true; el.setAttribute('playsinline', '');
      ctx.createMediaElementSource(el).connect(g);
      const media = { play: () => el.play().catch(() => { }), pause: () => el.pause() };
      reg.push({ stop() { el.pause(); URL.revokeObjectURL(url); } });
      return { gain: g, media };
    }
    const buf = pre || await this.loopBuffer(id);
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    s.connect(g);
    s.start(Math.max(t0, ctx.currentTime), Math.random() * buf.duration);
    s.stop(t1);
    reg.push(s);
    return { gain: g };
  }

  scheduleGong(buf, spec, at, dest, reg) {
    const n = Math.max(1, Math.min(9, spec.strikes || 1));
    const sp = GONG_SPACING[spec.type] || Math.min(8, Math.max(3, buf.duration * 0.45));
    for (let k = 0; k < n; k++) {
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      s.playbackRate.value = 1 + (Math.random() - 0.5) * 0.006;
      const g = this.ctx.createGain();
      g.gain.value = perceptual((spec.vol ?? 80) / 100) * Math.max(0.55, 1 - 0.14 * Math.pow(k, 0.8));
      s.connect(g).connect(dest);
      s.start(at + k * sp);
      reg.push(s);
    }
    return at + (n - 1) * sp + buf.duration;
  }

  async playGong(spec) {
    this.unlock();
    const buf = await this.gongBuffer(spec.type);
    const reg = [];
    this.scheduleGong(buf, spec, this.ctx.currentTime + 0.05, this.gongBus, reg);
  }

  // ---------- Sesión ----------
  async start(s, onProgress) {
    this.stop(true);
    const ctx = this.unlock();
    const P = plan(s);
    const ids = [...new Set(s.phases.flatMap(p => p.mix.map(m => m.sound)))];
    const types = [...new Set(P.gongs.map(g => g.type))];
    const loadIds = ids.filter(id => !TONE_BUILDERS[id] && !this.isLongUser(id));
    let done = 0;
    const tick = () => onProgress && onProgress(++done / (loadIds.length + types.length || 1));
    this.loading = ids;
    const gbufs = {}, lbufs = {};
    await Promise.all([
      ...loadIds.map(id => this.loopBuffer(id).then(b => { lbufs[id] = b; tick(); })),
      ...types.map(t => this.gongBuffer(t).then(b => { gbufs[t] = b; tick(); })),
    ]);

    const prep = s.prep || 0, tail = Math.max(3, s.tail ?? 25);
    const t0 = ctx.currentTime + 0.8 + prep, end = t0 + P.D;
    const reg = [], medias = [];
    const bus = ctx.createGain(); bus.connect(this.mk);
    const gbus = ctx.createGain(); gbus.connect(this.gongBus);
    this.master.gain.setValueAtTime((s.master ?? 90) / 100, ctx.currentTime);

    let ring = end + tail;
    for (const gv of P.gongs) ring = Math.max(ring, this.scheduleGong(gbufs[gv.type], gv, t0 + gv.t, gbus, reg));
    const tStop = ring + 1;

    for (const id of ids) {
      const L = await this.makeLayer(id, bus, t0 - 0.05, tStop, reg, lbufs[id]);
      if (L.media) medias.push(L.media);
      const vols = P.phases.map(p => (p.mix.find(m => m.sound === id)?.vol ?? 0) / 100);
      const gp = L.gain.gain;
      gp.setValueAtTime(0, t0 - 0.05);
      const fin = Math.max(0.1, Math.min(s.fadeIn ?? 20, P.phases[0].dur * 0.9));
      if (vols[0] > 0) gp.setValueCurveAtTime(curve(0, vols[0]), t0, fin);
      for (let i = 1; i < P.phases.length; i++) {
        if (vols[i] === vols[i - 1]) continue;
        const tr = Math.max(0.5, Math.min(P.phases[i].trans ?? 60, P.phases[i].dur * 0.9));
        gp.setValueCurveAtTime(curve(vols[i - 1], vols[i]), t0 + P.phases[i].start, tr);
      }
      const vl = vols[vols.length - 1];
      if (vl > 0) gp.setValueCurveAtTime(curve(vl, 0), end, tail);
    }
    medias.forEach(m => m.play());
    this.session = { s, P, t0, end, tStop, prep, reg, bus, gbus, medias, ids, paused: false };
    this.loading = null;
    return this.session;
  }

  status() {
    const S = this.session;
    if (!S) return null;
    const now = this.ctx.currentTime;
    const elapsed = now - S.t0;
    let state = elapsed < 0 ? 'prep' : now < S.end ? 'run' : now < S.tStop ? 'tail' : 'done';
    return { state, elapsed, D: S.P.D, remaining: Math.max(0, S.end - now), prepLeft: Math.max(0, -elapsed), paused: S.paused, ctxState: this.ctx.state };
  }

  async pause() {
    const S = this.session; if (!S) return;
    S.paused = true; S.medias.forEach(m => m.pause());
    await this.ctx.suspend();
  }

  async resume() {
    const S = this.session; if (!S) return;
    this.unlock();
    S.paused = false; S.medias.forEach(m => m.play());
    await this.ctx.resume();
  }

  stop(immediate = false) {
    const S = this.session;
    if (!S) return;
    this.session = null;
    const ctx = this.ctx;
    if (ctx.state !== 'running') ctx.resume().catch(() => { });
    const now = ctx.currentTime, f = immediate ? 0.05 : 1.6;
    for (const b of [S.bus, S.gbus]) {
      b.gain.cancelScheduledValues(now);
      b.gain.setValueAtTime(b.gain.value, now);
      b.gain.linearRampToValueAtTime(0, now + f);
    }
    S.medias.forEach(m => m.pause());
    setTimeout(() => { stopAll(S.reg); S.bus.disconnect(); S.gbus.disconnect(); }, f * 1000 + 120);
    if (!this.previews.size) setTimeout(() => !this.session && !this.previews.size && this.holdAudio(false), f * 1000 + 200);
  }

  // ---------- Escucha previa (biblioteca y mezclador) ----------
  async previewSet(id, vol) {
    const ctx = this.unlock();
    let P = this.previews.get(id);
    if (!P) {
      if (vol <= 0) return;
      P = { vol, reg: [], loading: true };
      this.previews.set(id, P);
      try {
        const L = await this.makeLayer(id, this.previewBus, ctx.currentTime + 0.05, ctx.currentTime + 7200, P.reg);
        if (this.previews.get(id) !== P) { stopAll(P.reg); return; }
        P.gain = L.gain; P.media = L.media; P.loading = false;
        if (P.media) P.media.play();
      } catch (e) {
        this.previews.delete(id);
        throw e;
      }
    }
    P.vol = vol;
    if (P.loading) return;
    const gp = P.gain.gain, now = ctx.currentTime;
    gp.cancelScheduledValues(now);
    gp.setValueAtTime(gp.value, now);
    gp.setTargetAtTime(perceptual(P.vol / 100), now, 0.3);
  }

  previewStop(id) {
    const P = this.previews.get(id);
    if (!P) return;
    this.previews.delete(id);
    if (P.gain) {
      const gp = P.gain.gain, now = this.ctx.currentTime;
      gp.cancelScheduledValues(now); gp.setValueAtTime(gp.value, now); gp.setTargetAtTime(0, now, 0.25);
    }
    setTimeout(() => { stopAll(P.reg); if (P.media) P.media.pause(); P.gain && P.gain.disconnect(); }, 1500);
    if (!this.previews.size && !this.session) setTimeout(() => !this.session && !this.previews.size && this.holdAudio(false), 1600);
  }

  previewStopAll() { [...this.previews.keys()].forEach(id => this.previewStop(id)); }
  isPreviewing(id) { return this.previews.has(id); }

  // Utilidad de desarrollo: nivel RMS de cada fuente (para equilibrar).
  async calibrate(ids) {
    const sr = 48000, out = {};
    for (const id of ids) {
      const oc = new OfflineAudioContext(2, sr * 12, sr);
      const reg = [];
      if (TONE_BUILDERS[id]) TONE_BUILDERS[id](oc, oc.destination, 0, 12, reg);
      else {
        const s = oc.createBufferSource(); s.buffer = await this.loopBuffer(id); s.connect(oc.destination); s.start(0);
      }
      const b = await oc.startRendering();
      let sum = 0, n = 0;
      for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = sr * 2; i < d.length; i++) { sum += d[i] * d[i]; n++; } }
      out[id] = Math.round(10 * Math.log10(sum / n) * 10) / 10;
    }
    return out;
  }
}
