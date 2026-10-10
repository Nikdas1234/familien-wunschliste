'use strict';

const cfg = window.WUNSCHLISTE_CONFIG || {};
// Ohne Zugangsdaten zur Datenbank läuft die App im Demo-Modus (Daten nur auf diesem Gerät).
const DEMO = !cfg.supabaseUrl || !cfg.supabaseKey;

const PRIORITIES = [
  { value: 1, label: 'Wäre nett' },
  { value: 2, label: 'Gern' },
  { value: 3, label: 'Herzenswunsch' },
];

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// localStorage kann gesperrt sein (privates Fenster) — dann läuft die App ohne Merken weiter.
const store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ohne Speicher weiter */ }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch { /* ohne Speicher weiter */ }
  },
};

const state = {
  code: store.get('wl.code'),
  me: store.get('wl.me'),
  view: null,
  data: null,
  offline: false,
  loadError: null,
  codeError: null,
  shared: null,
  appVersion: null,
  appUpdate: null,
  updateProgress: null,
};

// ---------------------------------------------------------------------------
// Datenzugriff
// ---------------------------------------------------------------------------

class CodeError extends Error {}
class NetError extends Error {}

async function rpc(fn, args = {}) {
  let res;
  try {
    res = await fetch(`${cfg.supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: cfg.supabaseKey,
        Authorization: `Bearer ${cfg.supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_code: state.code, ...args }),
    });
  } catch {
    throw new NetError('Keine Verbindung');
  }
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* keine JSON-Antwort */ }
  if (!res.ok) {
    const msg = (body && body.message) || `Fehler ${res.status}`;
    if (msg.includes('FALSCHER_CODE')) throw new CodeError('Der Familiencode stimmt nicht.');
    throw new Error(msg);
  }
  return body;
}

const remote = {
  load: () => rpc('wl_load'),
  addMember: (name) => rpc('wl_add_member', { p_name: name }),
  saveWish: (w) => rpc('wl_save_wish', {
    p_id: w.id || null,
    p_member: w.member_id,
    p_title: w.title,
    p_url: w.url,
    p_price: w.price,
    p_priority: w.priority,
  }),
  setDone: (id, done) => rpc('wl_set_done', { p_id: id, p_done: done }),
  deleteWish: (id) => rpc('wl_delete_wish', { p_id: id }),
};

const demo = (() => {
  const KEY = 'wl.demo';
  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const now = () => new Date().toISOString();

  function seed() {
    const [mama, papa, oma] = [uid(), uid(), uid()];
    return {
      family: 'Beispielfamilie',
      members: [
        { id: mama, name: 'Mama' },
        { id: papa, name: 'Papa' },
        { id: oma, name: 'Oma' },
      ],
      wishes: [
        { id: uid(), member_id: mama, title: 'Wanderrucksack 30 Liter', url: 'https://www.example.com/rucksack', price: 89.95, priority: 3, done: false, created_at: now() },
        { id: uid(), member_id: mama, title: 'Gutschein fürs Kino', url: null, price: 25, priority: 1, done: false, created_at: now() },
        { id: uid(), member_id: papa, title: 'Akkuschrauber', url: 'https://www.example.com/akkuschrauber', price: 129, priority: 2, done: false, created_at: now() },
        { id: uid(), member_id: oma, title: 'Großes Puzzle mit 1000 Teilen', url: null, price: null, priority: 2, done: false, created_at: now() },
      ],
    };
  }

  let db = store.get(KEY) || seed();
  const save = () => store.set(KEY, db);

  return {
    async load() { return JSON.parse(JSON.stringify(db)); },
    async addMember(name) {
      const hit = db.members.find((m) => m.name.toLowerCase() === name.toLowerCase());
      if (hit) return hit.id;
      const member = { id: uid(), name };
      db.members.push(member);
      save();
      return member.id;
    },
    async saveWish(w) {
      const fields = { title: w.title, url: w.url, price: w.price, priority: w.priority };
      const hit = w.id && db.wishes.find((x) => x.id === w.id);
      if (hit) Object.assign(hit, fields);
      else db.wishes.push({ id: uid(), member_id: w.member_id, done: false, created_at: now(), ...fields });
      save();
    },
    async setDone(id, done) {
      const hit = db.wishes.find((x) => x.id === id);
      if (hit) hit.done = done;
      save();
    },
    async deleteWish(id) {
      db.wishes = db.wishes.filter((x) => x.id !== id);
      save();
    },
  };
})();

const api = DEMO ? demo : remote;

// ---------------------------------------------------------------------------
// Hilfen für die Oberfläche
// ---------------------------------------------------------------------------

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (typeof value === 'boolean' || key === 'value') el[key] = value;
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

// Eigene Liniensymbole (24er-Raster) statt Schriftzeichen und Emoji.
const ICONS = {
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  plus: 'M12 5v14M5 12h14',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  link: 'M14 5h5v5M19 5l-8 8M11 7H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7C10.5 7 8 6.5 8 4.5S10.5 2.5 12 7zM12 7c1.5 0 4-.5 4-2.5S13.5 2.5 12 7z',
};

function icon(name, extra) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', extra ? `icon ${extra}` : 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS(NS, 'path');
  shape.setAttribute('d', ICONS[name]);
  svg.append(shape);
  return svg;
}

// Jede Person bekommt aus ihrem Namen einen festen Farbton für ihr Kürzel.
const AVATAR_HUES = [14, 40, 150, 200, 262, 332];
function avatar(member, extra) {
  let sum = 0;
  for (const ch of member.name) sum += ch.codePointAt(0);
  return h('span', {
    class: extra ? `avatar ${extra}` : 'avatar',
    style: `--h: ${AVATAR_HUES[sum % AVATAR_HUES.length]}`,
    'aria-hidden': 'true',
  }, member.name.charAt(0).toUpperCase());
}

let toastTimer;
function toast(message) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), 3500);
}

function errorText(err) {
  if (err instanceof NetError) return 'Keine Verbindung – bitte später noch einmal versuchen.';
  return err.message || 'Das hat nicht geklappt.';
}

// "49,99", "49.99" und "1.299,00 €" verstehen. Leer = kein Preis, NaN = ungültig.
function parsePrice(input) {
  let s = input.replace(/[€\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
}

// Nur http(s)-Adressen zulassen; ohne Angabe wird https:// ergänzt. undefined = ungültig.
function parseUrl(input) {
  const s = input.trim();
  if (!s) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

// Über "Teilen" empfangener Text (z. B. aus der Amazon-App): Link heraussuchen, der Rest ist der Titel.
// Browser schicken oft nur den Link als Text und den Seitentitel als Betreff.
function parseShared({ text = '', subject = '' }) {
  const match = text.match(/https?:\/\/\S+/i);
  const url = match ? parseUrl(match[0].replace(/[)\].,;!]+$/, '')) : null;
  const title = (match ? text.replace(match[0], ' ') : text)
    .replace(/\s+/g, ' ')
    .trim()
    // Übliche Einleitungen der Shop-Apps abschneiden ("Schau dir das mal an: …").
    .replace(/^(hey,?\s*)?(schau|sieh|guck|check (this|it) out|look at this)\b[^:!]{0,40}[:!]\s*/i, '');
  return { title: (title || subject.trim()).slice(0, 120), url: url || null };
}

function handleShared(data) {
  const shared = parseShared(data || {});
  if (!shared.title && !shared.url) return;
  state.shared = shared;
  render();
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Link'; }
}

const memberById = (id) => state.data.members.find((m) => m.id === id);

function wishesOf(memberId) {
  return state.data.wishes
    .filter((w) => w.member_id === memberId)
    .sort((a, b) =>
      (a.done - b.done) || (b.priority - a.priority) || a.created_at.localeCompare(b.created_at));
}

// ---------------------------------------------------------------------------
// Abläufe
// ---------------------------------------------------------------------------

async function refresh() {
  try {
    state.data = await api.load();
    state.offline = false;
    state.loadError = null;
    store.set('wl.cache', state.data);
  } catch (err) {
    if (err instanceof CodeError) {
      forgetCode();
      state.codeError = err.message;
    } else if (err instanceof NetError && (state.data || store.get('wl.cache'))) {
      // Ohne Netz den zuletzt geladenen Stand zeigen.
      state.data = state.data || store.get('wl.cache');
      state.offline = true;
    } else {
      state.loadError = errorText(err);
    }
  }
  render();
}

// Änderung ausführen, danach neu laden. Gibt true zurück, wenn es geklappt hat.
async function mutate(action) {
  try {
    await action();
  } catch (err) {
    if (err instanceof CodeError) {
      forgetCode();
      state.codeError = err.message;
      render();
    } else {
      toast(errorText(err));
    }
    return false;
  }
  await refresh();
  return true;
}

function forgetCode() {
  state.code = null;
  state.data = null;
  store.del('wl.code');
  store.del('wl.cache');
}

function setMe(id) {
  state.me = id;
  state.view = id;
  store.set('wl.me', id);
}

// ---------------------------------------------------------------------------
// Bildschirme
// ---------------------------------------------------------------------------

const app = document.getElementById('app');

function render() {
  const people = app.querySelector('.people');
  const peopleScroll = people ? people.scrollLeft : 0;

  let screen;
  let onMain = false;
  if (!DEMO && !state.code) screen = codeScreen();
  else if (!state.data) screen = state.loadError ? errorScreen() : loadingScreen();
  else if (!memberById(state.me)) screen = whoScreen();
  else { screen = mainScreen(); onMain = true; }

  app.replaceChildren(screen);
  const newPeople = app.querySelector('.people');
  if (newPeople) newPeople.scrollLeft = peopleScroll;

  // Über "Teilen" empfangenen Inhalt als neuen Wunsch anbieten, sobald man angemeldet ist.
  if (onMain && state.shared && !state.offline) {
    const shared = state.shared;
    state.shared = null;
    const open = document.querySelector('dialog[open]');
    if (open) open.close();
    openWishForm(null, shared);
  }
}

// Farbfläche mit dem Geschenk aus dem App-Symbol: Kopf aller Bildschirme vor der eigentlichen Liste.
function brand(title, text) {
  return h('div', { class: 'brand' },
    h('div', { class: 'brand-mark' }, icon('gift')),
    h('h1', null, title),
    text && h('p', null, text));
}

function loadingScreen() {
  return h('main', { class: 'welcome' }, brand('Familien-Wunschliste', 'Lädt …'));
}

function errorScreen() {
  return h('main', { class: 'welcome' },
    brand('Familien-Wunschliste', 'Die Wunschliste konnte nicht geladen werden.'),
    h('div', { class: 'panel stack' },
      h('p', { class: 'error', role: 'alert' }, state.loadError),
      h('button', { class: 'btn primary', onclick: () => { state.loadError = null; render(); refresh(); } },
        'Noch einmal versuchen'),
      !DEMO && h('button', { class: 'btn ghost', onclick: () => { forgetCode(); state.loadError = null; render(); } },
        'Anderen Familiencode eingeben')));
}

function codeScreen() {
  const input = h('input', {
    id: 'code', type: 'text', required: true, autocomplete: 'off', autocapitalize: 'none',
    spellcheck: 'false', placeholder: 'Code eingeben',
  });
  const button = h('button', { class: 'btn primary', type: 'submit' }, 'Weiter');
  const form = h('form', {
    class: 'panel stack',
    onsubmit: async (event) => {
      event.preventDefault();
      const code = input.value.trim();
      if (!code) return;
      button.disabled = true;
      state.code = code;
      state.codeError = null;
      store.set('wl.code', code);
      await refresh();
    },
  },
    h('label', { for: 'code' }, 'Familiencode'),
    input,
    state.codeError && h('p', { class: 'error', role: 'alert' }, state.codeError),
    button,
    h('p', { class: 'hint' }, 'Den Code bekommst du von deiner Familie. Das Handy merkt ihn sich.'));

  return h('main', { class: 'welcome' },
    brand('Familien-Wunschliste', 'Alle Wünsche der Familie an einem Ort.'),
    form);
}

function whoScreen() {
  const known = state.data.members.length > 0;
  const input = h('input', {
    id: 'newname', type: 'text', required: true, maxlength: '30', autocomplete: 'given-name',
    placeholder: 'Dein Name',
  });
  const button = h('button', { class: 'btn primary', type: 'submit' }, 'Hinzufügen');
  const form = h('form', {
    class: 'stack',
    onsubmit: async (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      button.disabled = true;
      let id;
      const ok = await mutate(async () => { id = await api.addMember(name); });
      if (ok && id) { setMe(id); render(); } else button.disabled = false;
    },
  },
    h('label', { for: 'newname' }, known ? 'Noch nicht dabei?' : 'Trag dich als Erstes ein'),
    input,
    button);

  return h('main', { class: 'welcome' },
    brand('Wer bist du?', state.data.family),
    h('div', { class: 'panel stack' },
      known && h('div', { class: 'who' },
        state.data.members.map((m) =>
          h('button', { class: 'who-item', onclick: () => { setMe(m.id); render(); } },
            avatar(m, 'large'), h('span', null, m.name)))),
      form));
}

function mainScreen() {
  if (!memberById(state.view)) state.view = state.me;
  const me = memberById(state.me);
  const viewed = memberById(state.view);
  const mine = viewed.id === me.id;
  const wishes = wishesOf(viewed.id);
  const open = wishes.filter((w) => !w.done);
  const done = wishes.filter((w) => w.done);
  const sum = open.reduce((total, w) => total + (Number(w.price) || 0), 0);
  const members = [me, ...state.data.members.filter((m) => m.id !== me.id)];

  const summary = open.length
    ? `${open.length} ${open.length === 1 ? 'offener Wunsch' : 'offene Wünsche'}${sum ? ` · zusammen ca. ${euro.format(sum)}` : ''}`
    : 'Keine offenen Wünsche';

  return h('div', { class: 'main' },
    h('header', { class: 'top' },
      h('div', { class: 'top-text' },
        h('p', { class: 'eyebrow' }, state.data.family || 'Wunschliste'),
        h('h1', null, mine ? 'Meine Wünsche' : viewed.name)),
      h('button', { class: 'icon-btn', 'aria-label': 'Aktualisieren', onclick: refresh }, icon('refresh')),
      h('button', { class: 'icon-btn', 'aria-label': `Menü – angemeldet als ${me.name}`, onclick: openMenu },
        icon('more', 'bold'))),

    state.appUpdate && updateBanner(),
    DEMO && h('p', { class: 'banner' }, 'Demo-Modus: Die Wünsche liegen nur auf diesem Gerät.'),
    state.offline && h('p', { class: 'banner' }, 'Keine Verbindung – du siehst den letzten Stand.'),

    h('nav', { class: 'people', 'aria-label': 'Familienmitglieder' },
      members.map((m) => {
        const count = state.data.wishes.filter((w) => w.member_id === m.id && !w.done).length;
        return h('button', {
          class: 'person',
          'aria-pressed': String(m.id === viewed.id),
          'aria-label': `${m.id === me.id ? 'Meine Wünsche' : m.name}, ${count} offen`,
          onclick: () => { state.view = m.id; render(); },
        },
          h('span', { class: 'ring' }, avatar(m), count > 0 && h('span', { class: 'badge' }, count)),
          h('span', { class: 'person-name' }, m.id === me.id ? 'Ich' : m.name));
      })),

    h('p', { class: 'summary' }, summary),

    h('main', { class: 'list' },
      open.map((w) => wishCard(w, mine)),
      wishes.length === 0 && h('p', { class: 'empty' }, mine
        ? 'Noch keine Wünsche. Tippe unten auf „Wunsch“, um den ersten einzutragen.'
        : `${viewed.name} hat noch nichts eingetragen.`),
      done.length > 0 && h('h2', { class: 'section' }, 'Erfüllt'),
      done.map((w) => wishCard(w, mine))),

    h('button', { class: 'fab', disabled: state.offline, onclick: () => openWishForm(null) },
      icon('plus'), 'Wunsch'));
}

function updateBanner() {
  const intro = `Es gibt eine neue App-Version (${state.appUpdate}). `;
  // Ältere Hüllen (bis 1.2.0) können nicht selbst installieren: dort führt der Link in den Browser.
  if (!appUpdater) {
    return h('p', { class: 'banner' },
      intro, 'Nach dem Herunterladen die Datei antippen und „Aktualisieren“ wählen. ',
      h('a', { class: 'link', href: APK_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Jetzt herunterladen'));
  }
  if (state.updateProgress != null) {
    return h('p', { class: 'banner', role: 'status' }, `Neue Version wird geladen … ${state.updateProgress} %`);
  }
  return h('p', { class: 'banner' },
    intro, 'Android fragt danach noch einmal nach – dort „Aktualisieren“ wählen. ',
    h('button', { class: 'link', onclick: installAppUpdate }, 'Jetzt aktualisieren'));
}

async function installAppUpdate() {
  if (state.updateProgress != null) return;
  state.updateProgress = 0;
  render();
  try {
    await appUpdater.install();
  } catch {
    toast('Das Update konnte nicht geladen werden. Bitte später noch einmal versuchen.');
  }
  state.updateProgress = null;
  render();
}

function wishCard(wish, mine) {
  const prio = PRIORITIES.find((p) => p.value === wish.priority) || PRIORITIES[1];

  return h('article', { class: `card p${prio.value}${wish.done ? ' done' : ''}` },
    mine && h('input', {
      type: 'checkbox', class: 'check', checked: wish.done, disabled: state.offline,
      'aria-label': `„${wish.title}“ als erfüllt markieren`,
      onchange: (event) => mutate(() => api.setDone(wish.id, event.target.checked)),
    }),
    h('div', { class: 'body' },
      h('div', { class: 'row' },
        h('h3', null, wish.title),
        // Preise sind ohnehin Circa-Angaben, deshalb auf ganze Euro gerundet.
        wish.price != null && h('span', { class: 'price' }, euro.format(wish.price))),
      h('div', { class: 'meta' },
        h('span', { class: 'prio' }, icon('heart', prio.value === 3 ? 'fill' : null), prio.label),
        wish.url && h('a', { class: 'shop', href: wish.url, target: '_blank', rel: 'noopener noreferrer' },
          icon('link'), h('span', null, hostOf(wish.url))),
        mine && h('button', {
          class: 'icon-btn edit', 'aria-label': `„${wish.title}“ bearbeiten`, disabled: state.offline,
          onclick: () => openWishForm(wish),
        }, icon('pencil')))));
}

// ---------------------------------------------------------------------------
// Dialoge
// ---------------------------------------------------------------------------

// Von unten eingeschobenes Blatt.
function openDialog(...children) {
  const dialog = h('dialog', { class: 'sheet' }, h('div', { class: 'grabber', 'aria-hidden': 'true' }), children);
  dialog.addEventListener('close', () => dialog.remove());
  // Tippen neben den Dialog schließt ihn.
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

function openMenu() {
  const me = memberById(state.me);
  const details = [state.data.family, state.appVersion && `App-Version ${state.appVersion}`].filter(Boolean);
  const dialog = openDialog(
    h('div', { class: 'menu-head' },
      avatar(me),
      h('div', null, h('h2', null, me.name), h('p', { class: 'hint left' }, details.join(' · ')))),
    h('div', { class: 'stack' },
      h('button', {
        class: 'btn',
        onclick: () => { dialog.close(); state.me = null; store.del('wl.me'); render(); },
      }, 'Person wechseln'),
      !DEMO && h('button', {
        class: 'btn',
        onclick: () => { dialog.close(); forgetCode(); render(); },
      }, 'Anderen Familiencode eingeben'),
      h('button', { class: 'btn ghost', onclick: () => dialog.close() }, 'Schließen')));
}

// prefill: Vorbelegung für einen neuen Wunsch, z. B. aus einem geteilten Link.
function openWishForm(wish, prefill = {}) {
  const editing = Boolean(wish);
  const title = h('input', {
    id: 'w-title', type: 'text', required: true, maxlength: '120', autocomplete: 'off',
    placeholder: 'z. B. Wanderrucksack', value: wish ? wish.title : (prefill.title || ''),
  });
  const url = h('input', {
    id: 'w-url', type: 'text', inputmode: 'url', autocapitalize: 'none', autocomplete: 'off',
    spellcheck: 'false', maxlength: '2000', placeholder: 'https://…', value: wish ? (wish.url || '') : (prefill.url || ''),
  });
  const price = h('input', {
    id: 'w-price', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '49,99',
    value: wish && wish.price != null ? String(wish.price).replace('.', ',') : '',
  });
  const current = wish ? wish.priority : 2;
  const prio = h('fieldset', { class: 'segmented' },
    h('legend', null, 'Wie wichtig ist es dir?'),
    PRIORITIES.map((p) => h('label', null,
      h('input', { type: 'radio', name: 'prio', value: String(p.value), checked: p.value === current }),
      h('span', null, icon('heart', p.value === 3 ? 'fill' : null), p.label))));
  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn primary', type: 'submit' }, 'Speichern');

  const fail = (message, field) => {
    error.textContent = message;
    error.hidden = false;
    field.focus();
  };

  const form = h('form', {
    class: 'stack',
    onsubmit: async (event) => {
      event.preventDefault();
      const cleanTitle = title.value.trim();
      const cleanUrl = parseUrl(url.value);
      const cleanPrice = parsePrice(price.value);
      if (!cleanTitle) return fail('Bitte gib an, was du dir wünschst.', title);
      if (cleanUrl === undefined) return fail('Der Link sieht nicht nach einer Internetadresse aus.', url);
      if (Number.isNaN(cleanPrice)) return fail('Bitte den Preis als Zahl eingeben, z. B. 49,99.', price);

      save.disabled = true;
      const ok = await mutate(() => api.saveWish({
        id: wish ? wish.id : null,
        member_id: state.me,
        title: cleanTitle,
        url: cleanUrl,
        price: cleanPrice,
        priority: Number(form.elements.prio.value),
      }));
      if (ok) {
        dialog.close();
        if (state.view !== state.me) { state.view = state.me; render(); }
      } else {
        save.disabled = false;
      }
    },
  },
    h('label', { for: 'w-title' }, 'Was wünschst du dir?'), title,
    h('div', { class: 'pair' },
      h('div', { class: 'stack' }, h('label', { for: 'w-url' }, 'Link zum Shop'), url),
      h('div', { class: 'stack narrow' }, h('label', { for: 'w-price' }, 'Preis ca. €'), price)),
    prio,
    error,
    save,
    h('button', { class: 'btn ghost', type: 'button', onclick: () => dialog.close() }, 'Abbrechen'),
    editing && h('button', {
      class: 'btn danger', type: 'button',
      onclick: async () => {
        if (!confirm(`„${wish.title}“ wirklich löschen?`)) return;
        if (await mutate(() => api.deleteWish(wish.id))) dialog.close();
      },
    }, 'Wunsch löschen'));

  const dialog = openDialog(h('h2', null, editing ? 'Wunsch bearbeiten' : 'Neuer Wunsch'), form);
  if (!editing && !prefill.title) title.focus();
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

document.addEventListener('visibilitychange', () => {
  // Beim Zurückkehren in die App den neuesten Stand holen — außer es ist gerade ein Dialog offen.
  if (document.visibilityState === 'visible' && state.data && !document.querySelector('dialog[open]')) refresh();
});

// In der Android-App (Capacitor): Zurück-Taste schließt einen offenen Dialog,
// sonst legt sie die App in den Hintergrund.
const nativeApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
if (nativeApp) {
  nativeApp.addListener('backButton', () => {
    const dialog = document.querySelector('dialog[open]');
    if (dialog) dialog.close();
    else nativeApp.minimizeApp();
  });
}

// In der Android-App (ab 1.3.0): neue Version direkt herunterladen und die Installation öffnen.
const appUpdater = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppUpdate;
if (appUpdater) {
  appUpdater.addListener('progress', ({ percent }) => {
    if (state.updateProgress == null) return;
    state.updateProgress = percent;
    render();
  });
}

// In der Android-App: Inhalte annehmen, die über "Teilen" an die Wunschliste geschickt werden.
const shareTarget = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ShareTarget;
if (shareTarget) shareTarget.addListener('shared', handleShared);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* App läuft auch ohne */ });
}

// Android-App: Der Inhalt aktualisiert sich von selbst. Nur wenn sich die Hülle ändert, braucht es
// eine neue Installationsdatei — dann erscheint ein Hinweis mit Download-Link. Still und von allein
// darf sich eine App außerhalb des Play Store unter Android nicht ersetzen.
const RELEASE_API = 'https://api.github.com/repos/Nikdas1234/familien-wunschliste/releases/latest';
const APK_URL = 'https://github.com/Nikdas1234/familien-wunschliste/releases/latest/download/Wunschliste.apk';
const UPDATE_CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

function isNewerVersion(latest, installed) {
  const a = latest.split('.').map(Number);
  const b = installed.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

async function checkAppUpdate() {
  if (!nativeApp) return;
  try {
    state.appVersion = (await nativeApp.getInfo()).version;
    // GitHub erlaubt ohne Anmeldung nur wenige Abfragen pro Stunde, deshalb das Ergebnis merken.
    let latest = store.get('wl.latest');
    if (!latest || Date.now() - latest.at > UPDATE_CHECK_EVERY_MS) {
      const res = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) return;
      latest = { version: String((await res.json()).tag_name).replace(/^v/, ''), at: Date.now() };
      store.set('wl.latest', latest);
    }
    if (isNewerVersion(latest.version, state.appVersion)) {
      state.appUpdate = latest.version;
      render();
    }
  } catch {
    // Ohne Prüfung läuft die App normal weiter.
  }
}

state.view = state.me;
render();
checkAppUpdate();
if (DEMO || state.code) refresh();
