// Catálogo de sonidos. Las grabaciones son CC0 (dominio público) de freesound.org.
const g = (a, b, c) => `radial-gradient(circle at 30% 25%, ${c || b} 0%, transparent 60%), linear-gradient(150deg, ${a}, ${b})`;

export const NATURE = [
  { id: 'lluvia-bosque', name: 'Lluvia en el bosque', group: 'Lluvia', fs: 865323, art: g('#1d3a36', '#5f8f86', '#9cc7bb') },
  { id: 'lluvia-tejado', name: 'Lluvia en el tejado', group: 'Lluvia', fs: 669487, art: g('#232c3a', '#5d6f88', '#9fb2c9') },
  { id: 'tormenta', name: 'Tormenta lejana', group: 'Lluvia', fs: 700358, art: g('#14182a', '#3d4670', '#8a93c9') },
  { id: 'bosque', name: 'Bosque', group: 'Bosque', fs: 564436, art: g('#16301f', '#4f7d4f', '#a7c98a') },
  { id: 'pajaros', name: 'Pájaros', group: 'Bosque', fs: 553452, art: g('#2a3b1c', '#8a9f4a', '#e1d98a') },
  { id: 'grillos', name: 'Noche de grillos', group: 'Bosque', fs: 522299, art: g('#0e1424', '#2f3b62', '#c9c48a') },
  { id: 'riachuelo', name: 'Riachuelo', group: 'Agua', fs: 231536, art: g('#123236', '#3f8f94', '#b7e3dc') },
  { id: 'rio', name: 'Río tranquilo', group: 'Agua', fs: 459412, art: g('#1b2f3a', '#4a7f98', '#a8d0de') },
  { id: 'olas', name: 'Olas', group: 'Agua', fs: 636552, art: g('#0f2a3a', '#2f7290', '#e8d9b5') },
  { id: 'hoguera', name: 'Hoguera nocturna', group: 'Fuego', fs: 248303, art: g('#1e1210', '#8a3f1f', '#f0a95a') },
  { id: 'chimenea', name: 'Chimenea', group: 'Fuego', fs: 81801, art: g('#2a1812', '#9a5a2a', '#f3c27a') },
  { id: 'tren', name: 'Tren', group: 'Viaje', fs: 525058, art: g('#1c1a2a', '#5a4a6e', '#d2a4a0') },
].map(s => ({ ...s, kind: 'nature', file: `sounds/${s.id}.m4a` }));

export const TONES = [
  { id: 'jardin', name: 'Jardín zen', desc: 'Handpan generativo, nunca se repite', art: g('#20302a', '#6f9a7e', '#f0e2b0') },
  { id: 'cuencos', name: 'Cuencos cantores', desc: 'Drone de cuencos tibetanos', art: g('#2e2414', '#a07a3a', '#f3d58a') },
  { id: 'pad', name: 'Pad cálido', desc: 'Acorde suave que respira', art: g('#2a1f30', '#7a5a8a', '#e6b8c8') },
  { id: 'om', name: 'Om suave', desc: 'Drone vocal cálido', art: g('#1f1418', '#6e3a3a', '#d89a7a') },
  { id: 'cristal', name: 'Cristal', desc: 'Armónicos agudos, muy etéreos', art: g('#1a2430', '#6a8aa8', '#ffffff') },
  { id: 'theta', name: 'Ondas theta', desc: 'Binaural 6 Hz · con auriculares', art: g('#141828', '#4a4f8a', '#b8b0f0') },
  { id: 'marron', name: 'Ruido marrón', desc: 'Manta de ruido grave', art: g('#1e1a16', '#5a4a3a', '#a08a70') },
].map(s => ({ ...s, kind: 'tone' }));

// Música grabada (CC0). Larga: se reproduce en streaming, no se carga entera en memoria.
export const MUSIC = [
  { id: 'm-meditacion', name: 'Meditación sanadora', desc: 'Cuencos y pads envolventes', fs: 795401, art: g('#2a2236', '#8a6aa0', '#f0d0a8') },
  { id: 'm-handpan', name: 'Handpan y pájaros', desc: '9 min · grabado al aire libre', fs: 618350, art: g('#1f3024', '#7a9a62', '#f2e2a0') },
  { id: 'm-errante', name: 'Errante', desc: 'Ambient profundo', fs: 455855, art: g('#162232', '#4a6a9a', '#c8d8f0') },
  { id: 'm-dunas', name: 'Dunas', desc: 'Ambient cálido', fs: 447511, art: g('#3a2618', '#b0784a', '#f6d29a') },
  { id: 'm-piano', name: 'Piano de tarde', desc: 'Piano ambient suave', fs: 418442, art: g('#24201c', '#7a6a5a', '#efe2cc') },
].map(s => ({ ...s, kind: 'music', file: `sounds/music/${s.id}.m4a` }));

export const GONGS = [
  { id: 'cuenco', name: 'Cuenco tibetano', color: '#c99a4b' },
  { id: 'grave', name: 'Cuenco grave', color: '#a8774a' },
  { id: 'rin', name: 'Campana zen', color: '#a3abb2' },
];

// Pigmentos naturales para los tramos (musgo, añil, ocre, ciruela, celadón, terracota)
export const PHASE_COLORS = ['#a5b384', '#8f9fc0', '#d4ae72', '#bf93a6', '#8db3ae', '#cf977a'];
export const USER_ART = g('#5a3446', '#b07a92', '#f3c9d6');
export const USER_GONG_COLOR = '#c98196';
