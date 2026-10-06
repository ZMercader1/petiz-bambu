// Datos locales: sesiones/diario en localStorage, audios propios en IndexedDB.
export const LS = {
  get(k, d) {
    try { const v = localStorage.getItem('petiz:' + k); return v == null ? d : JSON.parse(v); } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem('petiz:' + k, JSON.stringify(v)); } catch (e) { console.warn('No se pudo guardar', e); }
  },
};

let dbp;
function db() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('petiz', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('sounds', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function run(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('sounds', mode);
    const req = fn(t.objectStore('sounds'));
    t.oncomplete = () => res(req && req.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

export const userSounds = {
  all: () => run('readonly', s => s.getAll()),
  get: id => run('readonly', s => s.get(id)),
  put: rec => run('readwrite', s => s.put(rec)),
  del: id => run('readwrite', s => s.delete(id)),
};

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
