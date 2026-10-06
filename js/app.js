import { Engine, plan } from './engine.js';
import { NATURE, TONES, GONGS, PHASE_COLORS, USER_ART, USER_GONG_COLOR } from './catalog.js';
import { LS, userSounds, uid } from './store.js';

const VERSION = '1.0.0';
const E = new Engine();
window.PETIZ = E;

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = sec => { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
const fmtMin = sec => (sec % 60 ? fmt(sec) : `${sec / 60} min`);
const FMT = { s: v => (v < 60 ? `${v} s` : fmt(v)), pct: v => `${v}%` };
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

const I = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  enso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15.5 4.2A8.5 8.5 0 1 0 20.3 9"/></svg>',
  wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>',
};
const ENSO = `<svg class="enso" viewBox="0 0 100 100"><defs><linearGradient id="eg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a342b"/><stop offset="1" stop-color="#1e1b16"/></linearGradient></defs><path d="M63 13.5A37 37 0 1 0 86.5 42" fill="none" stroke="url(#eg)" stroke-width="8" stroke-linecap="round"/><path d="M63 13.5A37 37 0 1 0 86.5 42" fill="none" stroke="#f2ebde" stroke-width="1.1" stroke-dasharray="1.5 7" stroke-linecap="round" opacity=".55" transform="translate(1.4 0.8)"/></svg>`;

// ---------- Datos ----------
const G = (type, strikes = 1, vol = 80) => ({ type, strikes, vol });
const P_ = (name, min, mix, extra = {}) => ({ id: uid('p_'), name, min, trans: 90, mix: mix.map(([sound, vol]) => ({ sound, vol })), ...extra });

function defaultSessions() {
  return [
    {
      id: uid('s_'), name: 'Ronda 22', prep: 5, fadeIn: 25, tail: 30, master: 90,
      phases: [
        P_('Relajación', 11, [['bosque', 60], ['riachuelo', 38], ['jardin', 45]], { trans: 0 }),
        P_('Meditación', 11, [['cuencos', 26], ['riachuelo', 14]], { trans: 150, gong: G('cuenco', 1, 75) }),
      ],
      gongs: { start: G('cuenco', 1, 80), end: G('cuenco', 3, 80), extra: [] },
    },
    {
      id: uid('s_'), name: 'Lluvia y silencio', prep: 5, fadeIn: 30, tail: 40, master: 90,
      phases: [
        P_('Relajación', 8, [['lluvia-tejado', 62], ['pad', 30]], { trans: 0 }),
        P_('Silencio', 12, [['lluvia-tejado', 28]], { trans: 180, gong: G('rin', 1, 70) }),
      ],
      gongs: { start: G('rin', 2, 75), end: G('rin', 3, 75), extra: [] },
    },
    {
      id: uid('s_'), name: 'Pausa de 10', prep: 3, fadeIn: 15, tail: 25, master: 90,
      phases: [P_('Meditación', 10, [['olas', 50], ['cristal', 20]], { trans: 0 })],
      gongs: { start: G('koshi', 1, 70), end: G('rin', 3, 75), extra: [{ at: 300, type: 'koshi', strikes: 1, vol: 45 }] },
    },
    {
      id: uid('s_'), name: 'Tren nocturno', prep: 5, fadeIn: 30, tail: 35, master: 90,
      phases: [
        P_('Relajación', 9, [['tren', 62], ['om', 20]], { trans: 0 }),
        P_('Meditación', 6, [['grillos', 45], ['om', 26]], { trans: 120, gong: G('grave', 1, 70) }),
      ],
      gongs: { start: G('grave', 1, 80), end: G('grave', 2, 80), extra: [] },
    },
  ];
}

function newSession() {
  return {
    id: uid('s_'), name: 'Nueva sesión', prep: 5, fadeIn: 20, tail: 30, master: 90,
    phases: [
      P_('Relajación', 10, [['lluvia-bosque', 55], ['jardin', 40]], { trans: 0 }),
      P_('Meditación', 10, [['cuencos', 25]], { trans: 120, gong: G('cuenco', 1, 75) }),
    ],
    gongs: { start: G('cuenco', 1, 80), end: G('cuenco', 3, 80), extra: [] },
  };
}

const state = {
  tab: 'home',
  sessions: LS.get('sessions', null) || defaultSessions(),
  history: LS.get('history', []),
  user: [],
  draft: null, draftOrig: null, editingId: null,
  listen: null, pickPhase: null, auditions: new Set(),
  libVol: LS.get('libVol', {}),
};
const saveSessions = () => LS.set('sessions', state.sessions);

// Ajusta sesiones antiguas: sin «Gong profundo» y con nombres claros
(function migrate() {
  const ren = { Llegar: 'Relajación', Viaje: 'Relajación', Llegada: 'Meditación', Respirar: 'Meditación' };
  const fixG = g => { if (g && g.type === 'gong') g.type = 'grave'; };
  state.sessions.forEach(s => {
    s.gongs ||= {}; s.gongs.extra ||= [];
    fixG(s.gongs.start); fixG(s.gongs.end); s.gongs.extra.forEach(fixG);
    s.phases.forEach(p => { fixG(p.gong); if (ren[p.name]) p.name = ren[p.name]; });
  });
})();
const saveHistory = () => LS.set('history', state.history);

// ---------- Metadatos de sonidos ----------
const userAmbients = () => state.user.filter(u => u.kind === 'ambient').map(u => ({ id: u.id, name: u.name, desc: `Tuyo · ${fmt(u.duration)}`, art: USER_ART }));
const userGongs = () => state.user.filter(u => u.kind === 'gong').map(u => ({ id: u.id, name: u.name, color: USER_GONG_COLOR }));
function soundMeta(id) {
  return NATURE.find(s => s.id === id) || TONES.find(s => s.id === id) || userAmbients().find(s => s.id === id)
    || { id, name: 'Sonido borrado', art: '#333' };
}
const gongMeta = t => GONGS.find(g => g.id === t) || userGongs().find(g => g.id === t) || { id: t, name: 'Gong borrado', color: '#666' };
const gongColor = t => gongMeta(t).color;

async function loadUser() {
  try {
    const all = await userSounds.all();
    state.user = all.map(({ blob, ...m }) => m).sort((a, b) => a.created - b.created);
  } catch (e) { console.warn(e); state.user = []; }
  E.setUserMeta(state.user);
}

// ---------- Utilidades UI ----------
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
}
function paintRange(r) { r.style.setProperty('--v', ((r.value - r.min) / (r.max - r.min || 1)) * 100 + '%'); }
const paintRanges = root => root.querySelectorAll('input[type=range]').forEach(paintRange);

function render() {
  const v = $('#view');
  const ed = state.tab === 'edit';
  $('#tabs').hidden = ed;
  v.classList.toggle('no-tabs', ed);
  v.innerHTML = state.tab === 'lib' ? viewLib() : state.tab === 'diary' ? viewDiary() : ed ? viewEditor() : viewHome();
  document.querySelectorAll('#tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  paintRanges(v);
  if (ed) bindTimeline();
}

function go(tab) {
  if (tab !== state.tab) {
    E.previewStopAll(); state.listen = null;
    state.tab = tab; render(); window.scrollTo(0, 0);
  }
}

// ---------- Línea de tiempo ----------
function tlHTML(s, P, big) {
  const n = PHASE_COLORS.length;
  const ph = P.phases.map((p, i) => {
    const c = PHASE_COLORS[i % n], pc = i > 0 ? PHASE_COLORS[(i - 1) % n] : '';
    const trw = i > 0 ? (Math.min(p.trans ?? 60, p.dur * 0.9) / p.dur) * 100 : 0;
    return `<div class="tl-ph" style="flex:${p.dur} 1 0;--pc:${c};--pp:${pc}">${trw > 0 ? `<div class="tr" style="width:${trw}%"></div>` : ''}${big ? `<span>${esc(p.name)}</span>` : ''}</div>`;
  }).join('');
  const pins = P.gongs.map(g => `<div class="tl-pin k-${g.kind}" style="left:${(g.t / P.D) * 100}%;--gc:${gongColor(g.type)}" ${g.kind === 'extra' ? `data-k="${g.k}"` : ''}${g.kind === 'phase' ? ` data-ph="${g.phase}"` : ''}>${big ? '<i></i>' : ''}</div>`).join('');
  const labels = big ? `<div class="tl-labels"><span>0:00</span><span>${fmt(P.D / 2)}</span><span>${fmt(P.D)}</span></div>` : '';
  return `<div class="tl ${big ? 'big' : 'mini'}"${big ? ' id="tl"' : ''}><div class="tl-track">${ph}</div>${pins}${labels}</div>`;
}

function bindTimeline() {
  const tl = $('#tl'); if (!tl) return;
  const track = tl.querySelector('.tl-track');
  const D = plan(state.draft).D;
  const tAt = x => { const r = track.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1) * D; };
  track.addEventListener('click', e => {
    const t = Math.round(tAt(e.clientX) / 15) * 15;
    if (t <= 5 || t >= D - 5) return;
    state.draft.gongs.extra.push({ at: t, type: 'rin', strikes: 1, vol: 70 });
    render(); toast(`Gong añadido en ${fmt(t)}`);
  });
  // El gong de cambio de tramo mueve la frontera entre los dos tramos
  tl.querySelectorAll('.tl-pin.k-phase').forEach(pin => {
    pin.addEventListener('pointerdown', e => {
      e.preventDefault();
      pin.setPointerCapture(e.pointerId);
      pin.classList.add('drag');
      const i = +pin.dataset.ph, ph = state.draft.phases, a = ph[i - 1], b = ph[i];
      const startA = plan(state.draft).phases[i - 1].start, both = (+a.min) + (+b.min);
      const lab = document.createElement('div'); lab.className = 'tl-time'; lab.style.left = '50%';
      pin.appendChild(lab);
      const move = ev => {
        const am = clamp(Math.round(((tAt(ev.clientX) - startA) / 60) * 2) / 2, 0.5, both - 0.5);
        a.min = am; b.min = both - am;
        pin.style.left = ((startA + am * 60) / D) * 100 + '%';
        lab.textContent = `${a.min}′ · ${b.min}′`;
      };
      const up = () => {
        pin.removeEventListener('pointermove', move);
        pin.removeEventListener('pointerup', up);
        pin.removeEventListener('pointercancel', up);
        render();
      };
      move(e);
      pin.addEventListener('pointermove', move);
      pin.addEventListener('pointerup', up);
      pin.addEventListener('pointercancel', up);
    });
  });
  tl.querySelectorAll('.tl-pin.k-extra').forEach(pin => {
    pin.addEventListener('pointerdown', e => {
      e.preventDefault();
      pin.setPointerCapture(e.pointerId);
      pin.classList.add('drag');
      const k = +pin.dataset.k;
      const lab = document.createElement('div'); lab.className = 'tl-time'; lab.style.left = '50%';
      pin.appendChild(lab);
      const move = ev => {
        const t = clamp(Math.round(tAt(ev.clientX) / 5) * 5, 5, D - 5);
        state.draft.gongs.extra[k].at = t;
        pin.style.left = (t / D) * 100 + '%';
        lab.textContent = fmt(t);
      };
      const up = () => {
        pin.removeEventListener('pointermove', move);
        pin.removeEventListener('pointerup', up);
        pin.removeEventListener('pointercancel', up);
        render();
      };
      move(e);
      pin.addEventListener('pointermove', move);
      pin.addEventListener('pointerup', up);
      pin.addEventListener('pointercancel', up);
    });
  });
}

function refreshEditorTimeline() {
  const P = plan(state.draft);
  const w = $('#tl-wrap'); if (!w) return;
  w.innerHTML = tlHTML(state.draft, P, true);
  bindTimeline();
  $('#ed-total').innerHTML = `Duración total <b>${fmtMin(P.D)}</b>`;
}

// ---------- Inicio ----------
function viewHome() {
  const st = stats();
  const h = new Date().getHours();
  const greet = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  return `<header class="hero">${ENSO}<span class="hanko">静</span><h1>PETIZ BAMBU</h1><p>${greet}${st.streak ? ` · ${st.streak} ${st.streak === 1 ? 'día' : 'días'} seguidos` : ''}</p></header>
    ${!standalone && isIOS ? `<div class="install">Para tenerla como app: toca <b>Compartir</b> y luego <b>Añadir a pantalla de inicio</b>.</div>` : ''}
    ${state.sessions.map(rowHTML).join('')}
    <button class="new-row" data-act="new">+ Nueva sesión</button>`;
}

function rowHTML(s) {
  const P = plan(s);
  const desc = P.phases.map(p => p.mix.length ? p.mix.map(m => esc(soundMeta(m.sound).name.toLowerCase())).join(' · ') : 'silencio')
    .join('<span class="to"> → </span>');
  return `<article class="srow" data-act="edit" data-id="${s.id}">
    <div><div class="srow-h"><h3>${esc(s.name)}</h3><span class="dur">${Math.round(P.D / 60)}′</span></div>
      ${tlHTML(s, P, false)}
      <p class="srow-s">${desc}</p></div>
    <div class="srow-side"><button class="play-btn" data-act="play" data-id="${s.id}" aria-label="Empezar">${I.play}</button>
      <button class="more" data-act="more" data-id="${s.id}" aria-label="Más opciones">···</button></div>
  </article>`;
}

function openMore(id) {
  const s = findSession(id);
  openSheet(`<div class="sheet-h"><h3>${esc(s.name)}</h3><button class="icon-btn" data-act="sheet-close">${I.close}</button></div>
    <button class="menu-item" data-act="edit" data-id="${id}">Editar</button>
    <button class="menu-item" data-act="dup" data-id="${id}">Duplicar</button>
    <button class="menu-item danger" data-act="del" data-id="${id}">Borrar</button>`);
}

// ---------- Editor ----------
function rangeRow(label, path, min, max, step, f) {
  const v = getPath(state.draft, path) ?? min;
  return `<div class="row"><label>${label}</label><input class="grow" type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-bind="${path}" data-fmt="${f}"><output data-out="${path}">${FMT[f](v)}</output></div>`;
}

function gongOptions(sel) {
  const opt = g => `<option value="${g.id}" ${g.id === sel ? 'selected' : ''}>${esc(g.name)}</option>`;
  const ug = userGongs();
  return GONGS.map(opt).join('') + (ug.length ? `<optgroup label="Mis gongs">${ug.map(opt).join('')}</optgroup>` : '');
}

function gongRow(spec, path, label, sub, extraK) {
  const on = !!spec, isExtra = extraK != null;
  let title = esc(label);
  if (isExtra) {
    const m = Math.floor(spec.at / 60), s = Math.round(spec.at % 60);
    title = `Gong en <span class="time-in"><input inputmode="numeric" data-time="${path}" data-part="m" value="${m}">:<input inputmode="numeric" data-time="${path}" data-part="s" value="${String(s).padStart(2, '0')}"></span>`;
  }
  const ctl = isExtra
    ? `<button class="icon-btn sm" data-act="ex-del" data-k="${extraK}" aria-label="Quitar">${I.close}</button>`
    : `<label class="switch"><input type="checkbox" data-toggle="${path}" ${on ? 'checked' : ''}><span></span></label>`;
  const body = on ? `<div class="gr-body">
      <select data-bind="${path}.type">${gongOptions(spec.type)}</select>
      <div class="stepper sm"><button data-act="step" data-path="${path}.strikes" data-d="-1" data-min="1" data-max="9">−</button><span>${spec.strikes}×</span><button data-act="step" data-path="${path}.strikes" data-d="1" data-min="1" data-max="9">+</button></div>
      <button class="icon-btn sm" data-act="g-test" data-path="${path}" aria-label="Probar">${I.play}</button>
      <input type="range" min="0" max="100" value="${spec.vol}" data-bind="${path}.vol">
    </div>` : '';
  return `<div class="gong-row ${on ? '' : 'off'}" style="--gc:${on ? gongColor(spec.type) : 'transparent'}">
    <div class="gr-top"><span class="gdot"></span><span class="lbl">${title}${sub ? `<small>${sub}</small>` : ''}</span>${ctl}</div>${body}</div>`;
}

function layerHTML(m, i, j) {
  const sm = soundMeta(m.sound);
  return `<div class="layer"><span class="sw" style="background:${sm.art}"></span><span class="ln">${esc(sm.name)}</span>
    <input type="range" min="0" max="100" value="${m.vol}" data-bind="phases.${i}.mix.${j}.vol" data-sound="${m.sound}" data-phase="${i}">
    <button class="x" data-act="mix-del" data-i="${i}" data-j="${j}" aria-label="Quitar">${I.close}</button></div>`;
}

function phaseHTML(p, i, all) {
  const c = PHASE_COLORS[i % PHASE_COLORS.length], listening = state.listen === i;
  return `<div class="phase" style="--pc:${c}">
    <div class="ph-head"><span class="ph-num">${i + 1}</span><input data-bind="phases.${i}.name" value="${esc(p.name)}" aria-label="Nombre del tramo">
      ${all.length > 1 ? `<button class="icon-btn sm" data-act="ph-del" data-i="${i}" aria-label="Borrar tramo">${I.close}</button>` : ''}</div>
    <div class="row"><label>Duración</label><div class="stepper">
      <button data-act="step" data-path="phases.${i}.min" data-d="-1" data-min="1" data-max="240">−</button>
      <input type="number" inputmode="numeric" data-bind="phases.${i}.min" value="${p.min}">
      <button data-act="step" data-path="phases.${i}.min" data-d="1" data-min="1" data-max="240">+</button></div><span class="muted">min</span></div>
    ${i > 0 ? `${rangeRow('Transición', `phases.${i}.trans`, 0, 300, 10, 's')}<div class="sub">Fundido desde la mezcla del tramo anterior</div>
      ${gongRow(p.gong, `phases.${i}.gong`, 'Gong al entrar', '')}` : ''}
    <div class="mix">${p.mix.length ? p.mix.map((m, j) => layerHTML(m, i, j)).join('') : '<div class="empty-mix">Silencio. Añade sonidos a este tramo.</div>'}</div>
    <div class="ph-actions"><button class="btn sm" data-act="mix-add" data-i="${i}">+ Sonido</button>
      ${p.mix.length ? `<button class="btn sm ${listening ? 'on' : ''}" data-act="ph-listen" data-i="${i}">${listening ? 'Parar' : 'Escuchar mezcla'}</button>` : ''}</div>
    ${i < all.length - 1 && p.mix.length ? `<button class="copy-next" data-act="mix-copy" data-i="${i}">Copiar esta mezcla a «${esc(all[i + 1].name)}» ↓</button>` : ''}
  </div>`;
}

function viewEditor() {
  const d = state.draft, P = plan(d);
  return `<div class="ed-head"><button class="btn sm ghost" data-act="ed-back">‹ Volver</button><span class="t">${state.editingId ? 'Editar' : 'Nueva'} sesión</span><button class="btn sm gold" data-act="ed-save">Guardar</button></div>
    <input class="title-input" data-bind="name" value="${esc(d.name)}" placeholder="Nombre de la sesión">
    <div class="total" id="ed-total">Duración total <b>${fmtMin(P.D)}</b></div>
    <div id="tl-wrap">${tlHTML(d, P, true)}</div>
    <p class="hint">Toca la barra para añadir un gong · arrastra los gongs para moverlos</p>
    <h2 class="sec">Tramos</h2>
    ${d.phases.map((p, i, a) => phaseHTML(p, i, a)).join('')}
    <button class="add-line" data-act="ph-add">+ Añadir tramo</button>
    <h2 class="sec">Gongs</h2>
    ${gongRow(d.gongs.start, 'gongs.start', 'Gong de comienzo', 'Al empezar la sesión')}
    ${gongRow(d.gongs.end, 'gongs.end', 'Gong final', 'Al terminar')}
    <div class="kicker" style="margin:20px 0 10px">Gongs extra</div>
    ${d.gongs.extra.map((g, k) => gongRow(g, `gongs.extra.${k}`, '', '', k)).join('') || '<p class="empty-mix">Ninguno todavía.</p>'}
    <div class="ph-actions"><button class="btn sm" data-act="ex-add">+ Gong extra</button><button class="btn sm" data-act="ex-repeat">Repetir cada…</button></div>
    <div id="repeat-box"></div>
    <h2 class="sec">Ajustes</h2>
    ${rangeRow('Preparación', 'prep', 0, 60, 1, 's')}<div class="sub">Silencio antes del primer gong</div>
    ${rangeRow('Entrada suave', 'fadeIn', 0, 120, 5, 's')}
    ${rangeRow('Cola final', 'tail', 5, 120, 5, 's')}<div class="sub">Lo que tardan los sonidos en irse al final</div>
    ${rangeRow('Volumen', 'master', 10, 100, 1, 'pct')}
    <div style="height:22px"></div>
    <button class="btn gold wide" data-act="ed-play">Empezar ahora</button>`;
}

function openPicker(i) {
  state.pickPhase = i;
  const used = new Set(state.draft.phases[i].mix.map(m => m.sound));
  const item = s => `<div class="pick ${used.has(s.id) ? 'used' : ''}"><span class="sw" style="background:${s.art}"></span>
    <button class="pn" style="text-align:left" data-act="pick" data-id="${s.id}"><b>${esc(s.name)}</b><small>${esc(s.desc || s.group || '')}</small></button>
    <button class="icon-btn sm" data-act="audition" data-id="${s.id}" aria-label="Escuchar">${state.auditions.has(s.id) ? I.pause : I.play}</button></div>`;
  const ua = userAmbients();
  openSheet(`<div class="sheet-h"><h3>Añadir sonido</h3><button class="icon-btn" data-act="sheet-close">${I.close}</button></div>
    <div class="kicker grp">Naturaleza</div>${NATURE.map(item).join('')}
    <div class="kicker grp">Tonos</div>${TONES.map(item).join('')}
    ${ua.length ? `<div class="kicker grp">Mis sonidos</div>${ua.map(item).join('')}` : ''}`);
}

function openSheet(html) {
  const s = $('#sheet');
  s.innerHTML = `<div class="sheet-in">${html}</div>`;
  s.hidden = false;
  paintRanges(s);
}

function closeSheet() {
  const s = $('#sheet');
  s.hidden = true; s.innerHTML = '';
  if (rec && rec.mr && rec.mr.state === 'recording') rec.mr.stop();
  rec = null;
  const keep = state.listen != null && state.draft ? new Set(state.draft.phases[state.listen].mix.map(m => m.sound)) : new Set();
  state.auditions.forEach(id => { if (!keep.has(id)) E.previewStop(id); });
  state.auditions.clear();
}

function toggleListen(i) {
  E.previewStopAll();
  if (state.listen === i) state.listen = null;
  else {
    state.listen = i;
    state.draft.phases[i].mix.forEach(m => E.previewSet(m.sound, m.vol).catch(() => toast('No se pudo cargar un sonido')));
  }
  render();
}

// ---------- Biblioteca ----------
function viewLib() {
  const tile = s => {
    const on = E.isPreviewing(s.id), v = state.libVol[s.id] ?? 60;
    return `<div class="tile-wrap"><button class="tile ${on ? 'on' : ''}" data-act="lib-toggle" data-id="${s.id}" style="--art:${s.art}">
      <span class="art"></span><span class="eq"><i></i><i></i><i></i></span><span class="tn">${esc(s.name)}</span>${s.desc ? `<span class="td">${esc(s.desc)}</span>` : ''}</button>
      ${on ? `<input type="range" min="0" max="100" value="${v}" data-libvol="${s.id}" aria-label="Volumen">` : ''}</div>`;
  };
  const urow = u => `<div class="urow"><span class="sw" style="background:${u.kind === 'gong' ? USER_GONG_COLOR : USER_ART}"></span>
    <div class="grow"><input class="name" value="${esc(u.name)}" data-urename="${u.id}"><small>${fmt(u.duration)} · ${u.kind === 'gong' ? 'gong' : 'ambiente en bucle'}</small></div>
    <div class="seg"><button class="${u.kind === 'ambient' ? 'on' : ''}" data-act="u-kind" data-id="${u.id}" data-k="ambient">Amb.</button><button class="${u.kind === 'gong' ? 'on' : ''}" data-act="u-kind" data-id="${u.id}" data-k="gong">Gong</button></div>
    <button class="icon-btn sm" data-act="u-play" data-id="${u.id}">${E.isPreviewing(u.id) ? I.pause : I.play}</button>
    <button class="icon-btn sm" data-act="u-del" data-id="${u.id}" aria-label="Borrar">${I.close}</button></div>`;
  const any = E.previews.size > 0;
  return `<div class="page-h"><h1>Sonidos</h1><p>Toca para escuchar. Puedes mezclar varios a la vez.</p></div>
    <div class="kicker grp">Naturaleza · grabaciones reales</div><div class="grid">${NATURE.map(tile).join('')}</div>
    <div class="kicker grp" style="margin-top:22px">Tonos de meditación</div><div class="grid">${TONES.map(tile).join('')}</div>
    <h2 class="sec">Gongs</h2>
    ${GONGS.map(g => `<div class="urow"><span class="gdot" style="--gc:${g.color};margin:0 10px"></span><div class="grow"><b style="font-weight:600">${g.name}</b></div><button class="icon-btn sm" data-act="lib-gong" data-id="${g.id}">${I.play}</button></div>`).join('')}
    <h2 class="sec">Mis sonidos</h2>
    ${state.user.map(urow).join('') || '<p class="empty-mix">Graba tu cuenco, tu voz o la lluvia de tu ventana, o importa un audio (por ejemplo, la lluvia de 4 horas de YouTube).</p>'}
    <div class="ph-actions" style="margin-top:12px"><button class="btn" data-act="rec-open">${I.mic.replace('<svg', '<svg width="18" height="18"')} Grabar</button><button class="btn" data-act="imp">${I.file.replace('<svg', '<svg width="18" height="18"')} Importar</button></div>
    <div class="credits">Grabaciones de naturaleza en dominio público (CC0) de Freesound:
      ${NATURE.map(s => `<a href="https://freesound.org/s/${s.fs}/" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(' · ')}.
      Tonos y gongs sintetizados en el propio móvil.</div>
    ${any ? `<button class="btn gold stop-all" data-act="lib-stop">${I.pause.replace('<svg', '<svg width="16" height="16"')} Parar todo</button>` : ''}`;
}

// ---------- Grabación e importación ----------
let rec = null;
function openRecorder() {
  openSheet(`<div class="sheet-h"><h3>Grabar sonido</h3><button class="icon-btn" data-act="sheet-close">${I.close}</button></div>
    <div class="rec" id="rec"><div class="rec-time" id="rec-t">0:00</div><div class="rec-meter"><i id="rec-m"></i></div>
    <button class="rec-btn" data-act="rec-toggle" aria-label="Grabar"><i></i></button>
    <p class="muted" id="rec-msg">Toca para grabar. Un cuenco real, tu voz guiando, la lluvia de tu ventana…</p></div>`);
}

async function recToggle(btn) {
  if (rec && rec.mr && rec.mr.state === 'recording') { rec.mr.stop(); return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch { toast('No se pudo acceder al micrófono'); return; }
  const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 192000 } : undefined);
  const chunks = [];
  mr.ondataavailable = e => e.data.size && chunks.push(e.data);
  const ctx = E.unlock();
  const src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser();
  an.fftSize = 1024; src.connect(an);
  const data = new Float32Array(an.fftSize), t0 = Date.now();
  const r = rec = { mr };
  r.timer = setInterval(() => {
    an.getFloatTimeDomainData(data);
    let pk = 0; for (const v of data) pk = Math.max(pk, Math.abs(v));
    const m = $('#rec-m'), t = $('#rec-t');
    if (m) m.style.width = Math.min(100, pk * 140) + '%';
    if (t) t.textContent = fmt((Date.now() - t0) / 1000);
  }, 80);
  mr.onstop = () => {
    clearInterval(r.timer);
    stream.getTracks().forEach(t => t.stop());
    src.disconnect();
    if (rec !== r) return;
    const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/mp4' });
    showRecSave(blob, (Date.now() - t0) / 1000);
  };
  mr.start(250);
  btn.classList.add('on');
  $('#rec-msg').textContent = 'Grabando… toca para parar';
}

function showRecSave(blob, dur) {
  rec.blob = blob; rec.dur = dur; rec.kind = dur < 25 ? 'gong' : 'ambient';
  const url = URL.createObjectURL(blob);
  $('#rec').innerHTML = `<audio controls src="${url}" style="width:100%"></audio>
    <div class="field"><span class="kicker">Nombre</span><input type="text" id="rec-name" value="Mi grabación ${state.user.length + 1}"></div>
    <div class="field"><span class="kicker">Usar como</span><div class="seg"><button class="${rec.kind === 'ambient' ? 'on' : ''}" data-act="rec-kind" data-k="ambient">Ambiente en bucle</button><button class="${rec.kind === 'gong' ? 'on' : ''}" data-act="rec-kind" data-k="gong">Gong / campana</button></div></div>
    <div style="display:flex;gap:10px;margin-top:8px"><button class="btn" data-act="sheet-close">Descartar</button><button class="btn gold" style="flex:1" data-act="rec-save">Guardar</button></div>`;
}

async function saveUserSound(blob, name, kind, duration) {
  await userSounds.put({ id: uid('u_'), name, kind, duration, created: Date.now(), blob, type: blob.type });
  await loadUser();
}

function mediaDuration(file) {
  return new Promise(res => {
    const a = new Audio(), url = URL.createObjectURL(file);
    const done = d => { URL.revokeObjectURL(url); res(isFinite(d) ? d : 60); };
    a.preload = 'metadata';
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(60);
    a.src = url;
  });
}

async function importFiles(files) {
  for (const f of files) {
    const d = await mediaDuration(f);
    await saveUserSound(f, f.name.replace(/\.[^.]+$/, ''), d < 30 ? 'gong' : 'ambient', d);
  }
  toast(files.length > 1 ? `${files.length} sonidos importados` : 'Sonido importado');
  render();
}

// ---------- Diario ----------
const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`; };
function stats() {
  const per = {};
  state.history.forEach(h => { const k = dayKey(h.date); per[k] = (per[k] || 0) + h.done / 60; });
  let streak = 0;
  const d = new Date();
  if (!per[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (per[dayKey(d)]) { streak++; d.setDate(d.getDate() - 1); }
  const total = Math.round(state.history.reduce((a, h) => a + h.done / 60, 0));
  return { streak, total, count: state.history.length, per };
}

function viewDiary() {
  const st = stats();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 34);
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const m = st.per[dayKey(d)] || 0;
    cells.push(`<i class="${m >= 20 ? 'l3' : m >= 10 ? 'l2' : m > 0 ? 'l1' : ''} ${i === 34 ? 'today' : ''}" title="${d.toLocaleDateString('es')}"></i>`);
  }
  const MOOD = ['', '😣', '😐', '🙂', '😌', '✨'];
  const rows = state.history.slice().reverse().slice(0, 40).map(h => {
    const d = new Date(h.date);
    return `<div class="hrow"><div class="d"><b>${d.getDate()}</b><span>${d.toLocaleDateString('es', { month: 'short' }).replace('.', '')}</span></div>
      <div class="grow"><b style="font-weight:600">${esc(h.name)}</b><div class="muted" style="font-size:13px">${Math.round(h.done / 60)} min${h.completed ? '' : ' · incompleta'} · ${d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</div></div>
      <span class="mood">${MOOD[h.mood || 0]}</span></div>`;
  }).join('');
  return `<div class="page-h"><h1>Diario</h1><p>Tu práctica, día a día.</p></div>
    <div class="stats"><div class="stat"><b>${st.streak}</b><span>racha (días)</span></div><div class="stat"><b>${st.total}</b><span>minutos</span></div><div class="stat"><b>${st.count}</b><span>sesiones</span></div></div>
    <div class="heat">${cells.join('')}</div>
    <h2 class="sec">Sesiones</h2>
    ${rows || '<p class="empty-mix">Aquí aparecerán tus meditaciones.</p>'}
    <h2 class="sec">Copia de seguridad</h2>
    <p class="muted" style="font-size:13.5px;margin-top:-4px">Tus sesiones y tu diario viven en este móvil. Exporta una copia de vez en cuando.</p>
    <div class="ph-actions"><button class="btn sm" data-act="export">Exportar</button><button class="btn sm" data-act="import-json">Importar copia</button></div>
    <div class="credits">PETIZ BAMBU v${VERSION} · hecha a medida 🙏</div>`;
}

async function exportBackup() {
  const data = JSON.stringify({ app: 'petiz', v: 1, sessions: state.sessions, history: state.history }, null, 1);
  const file = new File([data], `petiz-copia-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Copia PETIZ BAMBU' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
}

async function importBackup(file) {
  try {
    const j = JSON.parse(await file.text());
    if (!Array.isArray(j.sessions)) throw 0;
    const ids = new Set(state.sessions.map(s => s.id));
    j.sessions.forEach(s => { if (!ids.has(s.id)) state.sessions.push(s); });
    const hs = new Set(state.history.map(h => h.date));
    (j.history || []).forEach(h => { if (!hs.has(h.date)) state.history.push(h); });
    state.history.sort((a, b) => a.date.localeCompare(b.date));
    saveSessions(); saveHistory(); render(); toast('Copia importada');
  } catch { toast('Ese archivo no es una copia válida'); }
}

// ---------- Reproductor ----------
let PL = null;
const RING_C = 2 * Math.PI * 140;
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

async function startSession(s) {
  E.previewStopAll(); state.listen = null;
  E.unlock();
  const P = plan(s);
  const ticks = P.gongs.map(g => {
    const a = (g.t / P.D) * 2 * Math.PI;
    return `<circle class="tick" cx="${150 + 140 * Math.cos(a)}" cy="${150 + 140 * Math.sin(a)}" r="4.5" style="--gc:${gongColor(g.type)}"/>`;
  }).join('');
  const el = $('#player');
  el.className = '';
  el.innerHTML = `<div class="pl-bg"></div>
    <div class="pl">
      <div class="pl-top"><button class="icon-btn" data-act="pl-stop" aria-label="Terminar">${I.close}</button><span class="nm">${esc(s.name)}</span><button class="icon-btn" data-act="pl-black" aria-label="Pantalla negra">${I.moon}</button></div>
      <div class="pl-mid">
        <div class="ring"><div class="breath"></div>
          <svg viewBox="0 0 300 300"><circle class="trk" cx="150" cy="150" r="140"/><circle class="prg" id="pl-prg" cx="150" cy="150" r="140" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/>${ticks}</svg>
          <div class="ring-c"><div class="pl-time" id="pl-time">${fmt(P.D)}</div><div class="pl-phase" id="pl-phase">${esc(P.phases[0].name)}</div></div>
        </div>
        <div class="pl-next" id="pl-next"></div>
      </div>
      <div class="pl-bottom"><button class="pl-btn" data-act="pl-pause" id="pl-pp" aria-label="Pausa">${I.pause}</button></div>
      <p class="pl-tip">Puedes bloquear el móvil y el sonido sigue. La luna pone la pantalla en negro sin bloquearla.</p>
    </div>
    <div class="pl-layer" id="pl-load"><p class="kicker">Un momento</p><h2 id="pl-load-t">Preparando…</h2></div>
    <div class="pl-layer" id="pl-prep" hidden><p class="kicker">Siéntate cómodo</p><div class="prep-n" id="pl-prep-n"></div><p>Respira hondo</p></div>
    <div class="pl-layer" id="pl-confirm" hidden><h2>¿Terminar ya?</h2><p id="pl-confirm-t"></p><div class="btns"><button class="btn" data-act="pl-no">Seguir</button><button class="btn gold" data-act="pl-yes">Terminar</button></div></div>
    <div class="pl-layer" id="pl-int" hidden><h2>En pausa</h2><p>El sistema ha parado el sonido (una llamada, otra app…).</p><div class="btns"><button class="btn gold" data-act="pl-resume">Continuar</button></div></div>
    <div class="pl-layer" id="pl-done" hidden><p class="kicker">Sesión completada</p><h2>${Math.round(P.D / 60)} ${Math.round(P.D / 60) === 1 ? "minuto" : "minutos"}</h2><p>¿Cómo te sientes?</p>
      <div class="moods">${['😣', '😐', '🙂', '😌', '✨'].map((m, i) => `<button data-act="mood" data-m="${i + 1}">${m}</button>`).join('')}</div>
      <div class="btns"><button class="btn gold" data-act="pl-close">Cerrar</button></div></div>
    <div class="black" id="pl-black" hidden><p>Toca dos veces para volver</p></div>`;
  el.hidden = false;
  PL = { s, P, done: false, lastTap: 0, wake: null, intSince: 0, histIdx: -1 };
  try {
    await E.start(s, p => { const t = $('#pl-load-t'); if (t) t.textContent = `Preparando… ${Math.round(p * 100)}%`; });
  } catch (err) {
    console.error(err); toast('No se pudieron cargar los sonidos'); closePlayer(); return;
  }
  if (!PL) { E.stop(true); return; }
  $('#pl-load').hidden = true;
  setupMediaSession(s);
  PL.timer = setInterval(tickPlayer, 250);
  tickPlayer();
}

function setupMediaSession(s) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: s.name, artist: 'PETIZ BAMBU', album: 'Meditación', artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
    navigator.mediaSession.setActionHandler('pause', () => setPaused(true));
    navigator.mediaSession.setActionHandler('play', () => setPaused(false));
    navigator.mediaSession.playbackState = 'playing';
  } catch { }
}

async function setPaused(p) {
  if (!PL || PL.done) return;
  if (p) { await E.pause(); E.holdAudio(false); } else { await E.resume(); }
  const b = $('#pl-pp'); if (b) b.innerHTML = p ? I.play : I.pause;
  $('#player').classList.toggle('paused', p);
  try { navigator.mediaSession.playbackState = p ? 'paused' : 'playing'; } catch { }
}

function tickPlayer() {
  if (!PL) return;
  const st = E.status();
  if (!st) return;
  const { P } = PL;
  const prep = $('#pl-prep');
  if (st.state === 'prep') { prep.hidden = false; $('#pl-prep-n').textContent = Math.ceil(st.prepLeft); }
  else if (!prep.hidden) prep.hidden = true;

  const el = clamp(st.elapsed, 0, P.D);
  $('#pl-prg').style.strokeDashoffset = RING_C * (1 - el / P.D);
  $('#pl-time').textContent = fmt(st.state === 'prep' ? P.D : st.remaining);
  let cur = P.phases[0];
  for (const p of P.phases) if (p.start <= el) cur = p;
  const col = PHASE_COLORS[cur.i % PHASE_COLORS.length];
  const root = $('#player');
  if (PL.col !== col) {
    PL.col = col;
    root.style.setProperty('--pcol', col);
    root.style.setProperty('--glow', hexA(col, 0.24));
    root.style.setProperty('--glow2', hexA(col, 0.2));
    $('#pl-phase').textContent = cur.name;
  }
  const nx = P.gongs.find(g => g.t > el + 0.5);
  const np = P.phases.find(p => p.start > el + 0.5);
  let txt = '';
  if (np && (!nx || np.start <= nx.t)) txt = `${esc(np.name)} en ${fmt(np.start - el)}`;
  else if (nx && nx.kind !== 'end') txt = `Gong en ${fmt(nx.t - el)}`;
  else if (st.state === 'run') txt = 'Último tramo';
  $('#pl-next').innerHTML = txt;

  // Pausa provocada por el sistema (llamadas, otra app…)
  const int = $('#pl-int');
  if (!st.paused && st.ctxState !== 'running' && st.state !== 'done') {
    PL.intSince = PL.intSince || Date.now();
    if (Date.now() - PL.intSince > 1500) int.hidden = false;
  } else { PL.intSince = 0; if (!int.hidden) int.hidden = true; }

  if ((st.state === 'tail' || st.state === 'done') && !PL.done) finish(true, P.D);
  if (st.state === 'done') { clearInterval(PL.timer); E.stop(); }
}

function record(done, completed) {
  state.history.push({ date: new Date().toISOString(), name: PL.s.name, planned: PL.P.D, done: Math.round(done), completed });
  PL.histIdx = state.history.length - 1;
  saveHistory();
}

function finish(completed, done) {
  PL.done = true;
  record(done, completed);
  $('#pl-done').hidden = false;
  $('#pl-black').hidden = true;
  releaseWake();
}

async function enterBlack() {
  $('#pl-black').hidden = false;
  try { PL.wake = await navigator.wakeLock.request('screen'); } catch { }
}
function releaseWake() { if (PL && PL.wake) { PL.wake.release().catch(() => { }); PL.wake = null; } }

function closePlayer() {
  if (PL) { clearInterval(PL.timer); releaseWake(); }
  PL = null;
  const el = $('#player'); el.hidden = true; el.innerHTML = '';
  try { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } catch { }
  render();
}

// ---------- Eventos ----------
function armDelete(btn, fn) {
  if (btn.dataset.armed) { fn(); return; }
  btn.dataset.armed = '1';
  const old = btn.textContent; btn.textContent = '¿Seguro?';
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = old; } }, 3000);
}

const findSession = id => state.sessions.find(s => s.id === id);

function saveDraft() {
  const d = state.draft;
  d.phases.forEach(p => { p.min = clamp(Math.round((+p.min || 1) * 2) / 2, 0.5, 240); });
  const i = state.sessions.findIndex(s => s.id === d.id);
  if (i >= 0) state.sessions[i] = clone(d); else state.sessions.unshift(clone(d));
  saveSessions();
  state.editingId = d.id;
  state.draftOrig = JSON.stringify(d);
}

document.addEventListener('click', async e => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) return go(tabBtn.dataset.tab);
  if (e.target.id === 'sheet') return closeSheet();
  if (e.target.closest('#pl-black')) {
    const now = Date.now();
    if (now - PL.lastTap < 450) { $('#pl-black').hidden = true; releaseWake(); }
    PL.lastTap = now;
    return;
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act, d = state.draft;
  const id = el.dataset.id, i = el.dataset.i != null ? +el.dataset.i : null;

  switch (a) {
    // Inicio
    case 'new': state.draft = newSession(); state.draftOrig = JSON.stringify(state.draft); state.editingId = null; state.tab = 'edit'; render(); window.scrollTo(0, 0); break;
    case 'more': openMore(id); break;
    case 'edit': closeSheet(); state.draft = clone(findSession(id)); state.draft.gongs.extra ||= []; state.draftOrig = JSON.stringify(state.draft); state.editingId = id; state.tab = 'edit'; render(); window.scrollTo(0, 0); break;
    case 'dup': {
      closeSheet();
      const s = clone(findSession(id)); s.id = uid('s_'); s.name += ' (copia)';
      state.sessions.splice(state.sessions.findIndex(x => x.id === id) + 1, 0, s); saveSessions(); render(); toast('Duplicada'); break;
    }
    case 'del': armDelete(el, () => { closeSheet(); state.sessions = state.sessions.filter(s => s.id !== id); saveSessions(); render(); toast('Sesión borrada'); }); break;
    case 'play': startSession(findSession(id)); break;

    // Editor
    case 'ed-back':
      if (JSON.stringify(d) !== state.draftOrig) { armDelete(el, () => go('home')); el.textContent = '¿Descartar?'; }
      else go('home');
      break;
    case 'ed-save': saveDraft(); toast('Sesión guardada'); go('home'); break;
    case 'ed-play': saveDraft(); startSession(clone(state.draft)); break;
    case 'step': {
      const v = clamp((+getPath(d, el.dataset.path) || 0) + +el.dataset.d, +el.dataset.min, +el.dataset.max);
      setPath(d, el.dataset.path, v); render(); break;
    }
    case 'ph-add': {
      const prev = d.phases[d.phases.length - 1];
      d.phases.push({ id: uid('p_'), name: `Tramo ${d.phases.length + 1}`, min: 5, trans: 90, gong: G('rin', 1, 70), mix: clone(prev.mix) });
      render(); break;
    }
    case 'ph-del':
      if (state.listen != null) { E.previewStopAll(); state.listen = null; }
      d.phases.splice(i, 1); if (d.phases[0]) { delete d.phases[0].gong; d.phases[0].trans = 0; }
      render(); break;
    case 'mix-add': openPicker(i); break;
    case 'mix-del': {
      const [m] = d.phases[i].mix.splice(+el.dataset.j, 1);
      if (state.listen === i) E.previewStop(m.sound);
      render(); break;
    }
    case 'ph-listen': toggleListen(i); break;
    case 'mix-copy': {
      const next = d.phases[i + 1];
      if (state.listen === i + 1) { E.previewStopAll(); state.listen = null; }
      next.mix = clone(d.phases[i].mix);
      render(); toast(`Mezcla copiada a «${next.name}»`); break;
    }
    case 'g-test': E.playGong(getPath(d, el.dataset.path)).catch(() => toast('No se pudo cargar el gong')); break;
    case 'ex-add': d.gongs.extra.push({ at: Math.round(plan(d).D / 2 / 15) * 15, type: 'rin', strikes: 1, vol: 70 }); render(); break;
    case 'ex-del': d.gongs.extra.splice(+el.dataset.k, 1); render(); break;
    case 'ex-repeat':
      $('#repeat-box').innerHTML = `<div class="repeat-box">Un gong cada <span class="time-in"><input id="rp-n" inputmode="numeric" value="5"></span> min de <select id="rp-t">${gongOptions('koshi')}</select><button class="btn sm gold" data-act="ex-repeat-go">Crear</button></div>`;
      break;
    case 'ex-repeat-go': {
      const n = +$('#rp-n').value, type = $('#rp-t').value, D = plan(d).D;
      if (!(n > 0)) return toast('Pon cada cuántos minutos');
      const taken = new Set(plan(d).gongs.map(g => Math.round(g.t)));
      let c = 0;
      for (let t = n * 60; t < D - 5; t += n * 60) if (!taken.has(t)) { d.gongs.extra.push({ at: t, type, strikes: 1, vol: 55 }); c++; }
      d.gongs.extra.sort((x, y) => x.at - y.at);
      render(); toast(`${c} gongs añadidos`); break;
    }
    case 'pick': {
      const ph = d.phases[state.pickPhase];
      ph.mix.push({ sound: id, vol: 50 });
      if (state.listen === state.pickPhase) E.previewSet(id, 50).catch(() => { });
      state.auditions.delete(id);
      closeSheet(); render(); break;
    }
    case 'audition':
      if (state.auditions.has(id)) { state.auditions.delete(id); E.previewStop(id); el.innerHTML = I.play; }
      else { state.auditions.add(id); el.innerHTML = I.pause; E.previewSet(id, 60).catch(() => toast('No se pudo cargar')); }
      break;
    case 'sheet-close': closeSheet(); break;

    // Biblioteca
    case 'lib-toggle':
      if (E.isPreviewing(id)) E.previewStop(id);
      else E.previewSet(id, state.libVol[id] ?? 60).catch(() => { toast('No se pudo cargar'); render(); });
      render(); break;
    case 'lib-stop': E.previewStopAll(); render(); break;
    case 'lib-gong': E.playGong({ type: id, strikes: 1, vol: 80 }); break;
    case 'u-kind': {
      const u = await userSounds.get(id); u.kind = el.dataset.k; await userSounds.put(u); E.forgetUser(id); await loadUser(); render(); break;
    }
    case 'u-play': {
      const u = state.user.find(x => x.id === id);
      if (u.kind === 'gong') E.playGong({ type: id, strikes: 1, vol: 80 }).catch(() => toast('No se pudo reproducir'));
      else { if (E.isPreviewing(id)) E.previewStop(id); else E.previewSet(id, 70).catch(() => toast('No se pudo reproducir')); render(); }
      break;
    }
    case 'u-del': armDelete(el, async () => { E.previewStop(id); await userSounds.del(id); E.forgetUser(id); await loadUser(); render(); }); break;
    case 'rec-open': openRecorder(); break;
    case 'rec-toggle': recToggle(el); break;
    case 'rec-kind': rec.kind = el.dataset.k; el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); break;
    case 'rec-save': {
      const name = ($('#rec-name').value || 'Mi grabación').trim();
      await saveUserSound(rec.blob, name, rec.kind, rec.dur);
      closeSheet(); render(); toast('Guardado en Mis sonidos'); break;
    }
    case 'imp': $('#file-in').click(); break;

    // Diario
    case 'export': exportBackup(); break;
    case 'import-json': $('#json-in').click(); break;

    // Reproductor
    case 'pl-pause': setPaused(!E.session?.paused); break;
    case 'pl-stop': {
      if (!PL) return;
      if (PL.done) { E.stop(); closePlayer(); break; }
      const st = E.status();
      $('#pl-confirm-t').textContent = st && st.elapsed > 0 ? `Llevas ${fmt(st.elapsed)} de ${fmt(PL.P.D)}.` : '';
      $('#pl-confirm').hidden = false; break;
    }
    case 'pl-no': $('#pl-confirm').hidden = true; break;
    case 'pl-yes': {
      const st = E.status();
      if (st && st.elapsed >= 60) record(Math.min(st.elapsed, PL.P.D), false);
      E.stop(); closePlayer(); break;
    }
    case 'pl-resume': await E.resume(); $('#pl-int').hidden = true; break;
    case 'pl-black': enterBlack(); break;
    case 'mood':
      if (PL && PL.histIdx >= 0) { state.history[PL.histIdx].mood = +el.dataset.m; saveHistory(); }
      el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
      break;
    case 'pl-close': E.stop(); closePlayer(); break;
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.type === 'range') paintRange(t);
  if (t.dataset.libvol) {
    const v = +t.value; state.libVol[t.dataset.libvol] = v; LS.set('libVol', state.libVol);
    E.previewSet(t.dataset.libvol, v).catch(() => { });
    return;
  }
  const b = t.dataset.bind;
  if (!b || !state.draft) return;
  if (t.type === 'number' && t.value === '') return;
  const v = t.type === 'range' || t.type === 'number' ? +t.value : t.value;
  setPath(state.draft, b, v);
  const out = document.querySelector(`[data-out="${b}"]`);
  if (out) out.textContent = FMT[t.dataset.fmt](v);
  if (t.dataset.sound && state.listen === +t.dataset.phase) E.previewSet(t.dataset.sound, v).catch(() => { });
  if (/\.(min|trans)$|^phases\.\d+\.name$/.test(b)) refreshEditorTimeline();
});

document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'file-in') { if (t.files.length) await importFiles([...t.files]); t.value = ''; return; }
  if (t.id === 'json-in') { if (t.files[0]) await importBackup(t.files[0]); t.value = ''; return; }
  if (t.dataset.urename) {
    const u = await userSounds.get(t.dataset.urename); u.name = t.value.trim() || u.name; await userSounds.put(u); await loadUser(); return;
  }
  if (!state.draft) return;
  if (t.dataset.toggle) {
    const p = t.dataset.toggle;
    setPath(state.draft, p, t.checked ? G(p.includes('phases') ? 'rin' : 'cuenco', 1, 75) : null);
    render(); return;
  }
  if (t.dataset.time) {
    const p = t.dataset.time, cur = getPath(state.draft, p).at;
    const m = t.dataset.part === 'm' ? +t.value || 0 : Math.floor(cur / 60);
    const s = t.dataset.part === 's' ? clamp(+t.value || 0, 0, 59) : Math.round(cur % 60);
    getPath(state.draft, p).at = clamp(m * 60 + s, 5, plan(state.draft).D - 5);
    render(); return;
  }
  if (t.dataset.bind && (t.tagName === 'SELECT' || t.type === 'number')) {
    if (t.type === 'number') setPath(state.draft, t.dataset.bind, clamp(+t.value || 1, 0.5, 240));
    else setPath(state.draft, t.dataset.bind, t.value);
    render();
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && E.session && !E.session.paused && E.ctx.state !== 'running') E.ctx.resume().catch(() => { });
});

// ---------- Arranque ----------
(async function boot() {
  if (!LS.get('sessions', null)) saveSessions();
  await loadUser();
  render();
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
})();
