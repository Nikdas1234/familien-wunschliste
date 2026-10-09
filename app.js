'use strict';

const cfg = window.WUNSCHLISTE_CONFIG || {};
// Ohne Zugangsdaten zur Datenbank läuft die App im Demo-Modus (Daten nur auf diesem Gerät).
const DEMO = !cfg.supabaseUrl || !cfg.supabaseKey;

const PRIORITIES = [
  { value: 1, label: 'Wäre nett' },
  { value: 2, label: 'Gern' },
  { value: 3, label: 'Herzenswunsch' },
];

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

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
  const chips = app.querySelector('.chips');
  const chipScroll = chips ? chips.scrollLeft : 0;

  let screen;
  if (!DEMO && !state.code) screen = codeScreen();
  else if (!state.data) screen = state.loadError ? errorScreen() : loadingScreen();
  else if (!memberById(state.me)) screen = whoScreen();
  else screen = mainScreen();

  app.replaceChildren(screen);
  const newChips = app.querySelector('.chips');
  if (newChips) newChips.scrollLeft = chipScroll;
}

function loadingScreen() {
  return h('main', { class: 'center' }, h('p', { class: 'muted' }, 'Lädt …'));
}

function errorScreen() {
  return h('main', { class: 'center' },
    h('h1', null, 'Wunschliste'),
    h('p', { class: 'muted' }, state.loadError),
    h('button', { class: 'btn primary', onclick: () => { state.loadError = null; render(); refresh(); } },
      'Noch einmal versuchen'),
    !DEMO && h('button', { class: 'btn ghost', onclick: () => { forgetCode(); state.loadError = null; render(); } },
      'Anderen Familiencode eingeben'));
}

function codeScreen() {
  const input = h('input', {
    id: 'code', type: 'text', required: true, autocomplete: 'off', autocapitalize: 'none',
    spellcheck: 'false', placeholder: 'Familiencode',
  });
  const button = h('button', { class: 'btn primary', type: 'submit' }, 'Weiter');
  const form = h('form', {
    class: 'stack',
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
    button);

  return h('main', { class: 'center' },
    h('div', { class: 'logo', 'aria-hidden': 'true' }, '🎁'),
    h('h1', null, 'Familien-Wunschliste'),
    h('p', { class: 'muted' }, 'Gib den Code ein, den ihr in der Familie teilt. Das Handy merkt ihn sich.'),
    form);
}

function whoScreen() {
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
    h('label', { for: 'newname' }, state.data.members.length ? 'Noch nicht dabei?' : 'Trag dich als Erstes ein'),
    input,
    button);

  return h('main', { class: 'center' },
    h('h1', null, 'Wer bist du?'),
    state.data.members.length > 0 && h('div', { class: 'people' },
      state.data.members.map((m) =>
        h('button', { class: 'btn person', onclick: () => { setMe(m.id); render(); } }, m.name))),
    form);
}

function mainScreen() {
  if (!memberById(state.view)) state.view = state.me;
  const me = memberById(state.me);
  const viewed = memberById(state.view);
  const mine = viewed.id === me.id;
  const wishes = wishesOf(viewed.id);
  const members = [me, ...state.data.members.filter((m) => m.id !== me.id)];

  return h('div', { class: 'main' },
    h('header', { class: 'top' },
      h('h1', null, state.data.family || 'Wunschliste'),
      h('button', { class: 'icon-btn', 'aria-label': 'Aktualisieren', onclick: refresh }, '↻'),
      h('button', { class: 'icon-btn avatar', 'aria-label': `Angemeldet als ${me.name} – Menü`, onclick: openMenu },
        me.name.charAt(0).toUpperCase())),

    DEMO && h('p', { class: 'banner' }, 'Demo-Modus: Die Wünsche liegen nur auf diesem Gerät.'),
    state.offline && h('p', { class: 'banner' }, 'Keine Verbindung – du siehst den letzten Stand.'),

    h('nav', { class: 'chips', 'aria-label': 'Familienmitglieder' },
      members.map((m) => {
        const open = state.data.wishes.filter((w) => w.member_id === m.id && !w.done).length;
        return h('button', {
          class: 'chip',
          'aria-pressed': String(m.id === viewed.id),
          onclick: () => { state.view = m.id; render(); },
        }, m.id === me.id ? 'Meine Wünsche' : m.name, h('span', { class: 'count' }, open));
      })),

    h('main', { class: 'list' },
      wishes.length
        ? wishes.map((w) => wishCard(w, mine))
        : h('p', { class: 'empty' }, mine
          ? 'Noch keine Wünsche. Tippe unten auf „Wunsch“, um den ersten einzutragen.'
          : `${viewed.name} hat noch nichts eingetragen.`)),

    h('button', { class: 'fab', disabled: state.offline, onclick: () => openWishForm(null) },
      h('span', { 'aria-hidden': 'true' }, '＋'), ' Wunsch'));
}

function wishCard(wish, mine) {
  const prio = PRIORITIES.find((p) => p.value === wish.priority) || PRIORITIES[1];

  return h('article', { class: wish.done ? 'card done' : 'card' },
    mine && h('input', {
      type: 'checkbox', class: 'check', checked: wish.done, disabled: state.offline,
      'aria-label': `„${wish.title}“ als erfüllt markieren`,
      onchange: (event) => mutate(() => api.setDone(wish.id, event.target.checked)),
    }),
    h('div', { class: 'body' },
      h('h2', null, wish.title),
      h('div', { class: 'meta' },
        h('span', { class: `prio p${prio.value}`, title: prio.label },
          h('span', { 'aria-hidden': 'true' }, '♥'.repeat(prio.value)), ` ${prio.label}`),
        wish.price != null && h('span', { class: 'price' }, `ca. ${euro.format(wish.price)}`),
        wish.done && h('span', { class: 'tag' }, 'erfüllt')),
      wish.url && h('a', { class: 'link', href: wish.url, target: '_blank', rel: 'noopener noreferrer' },
        `${hostOf(wish.url)} ↗`)),
    mine && h('button', {
      class: 'icon-btn', 'aria-label': `„${wish.title}“ bearbeiten`, disabled: state.offline,
      onclick: () => openWishForm(wish),
    }, '✎'));
}

// ---------------------------------------------------------------------------
// Dialoge
// ---------------------------------------------------------------------------

function openDialog(className, ...children) {
  const dialog = h('dialog', { class: className }, children);
  dialog.addEventListener('close', () => dialog.remove());
  // Tippen neben den Dialog schließt ihn.
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

function openMenu() {
  const me = memberById(state.me);
  const dialog = openDialog('sheet',
    h('h2', null, `Angemeldet als ${me.name}`),
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

function openWishForm(wish) {
  const editing = Boolean(wish);
  const title = h('input', {
    id: 'w-title', type: 'text', required: true, maxlength: '120', autocomplete: 'off',
    placeholder: 'z. B. Wanderrucksack', value: wish ? wish.title : '',
  });
  const url = h('input', {
    id: 'w-url', type: 'text', inputmode: 'url', autocapitalize: 'none', autocomplete: 'off',
    spellcheck: 'false', maxlength: '2000', placeholder: 'https://…', value: wish && wish.url ? wish.url : '',
  });
  const price = h('input', {
    id: 'w-price', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: 'z. B. 49,99',
    value: wish && wish.price != null ? String(wish.price).replace('.', ',') : '',
  });
  const current = wish ? wish.priority : 2;
  const prio = h('fieldset', { class: 'segmented' },
    h('legend', null, 'Wie wichtig ist es dir?'),
    PRIORITIES.map((p) => h('label', null,
      h('input', { type: 'radio', name: 'prio', value: String(p.value), checked: p.value === current }),
      h('span', null, p.label))));
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
    h('label', { for: 'w-url' }, 'Link zum Shop ', h('span', { class: 'muted' }, '(freiwillig)')), url,
    h('label', { for: 'w-price' }, 'Preis ungefähr in € ', h('span', { class: 'muted' }, '(freiwillig)')), price,
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

  const dialog = openDialog('sheet', h('h2', null, editing ? 'Wunsch bearbeiten' : 'Neuer Wunsch'), form);
  if (!editing) title.focus();
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

document.addEventListener('visibilitychange', () => {
  // Beim Zurückkehren in die App den neuesten Stand holen — außer es ist gerade ein Dialog offen.
  if (document.visibilityState === 'visible' && state.data && !document.querySelector('dialog[open]')) refresh();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* App läuft auch ohne */ });
}

state.view = state.me;
render();
if (DEMO || state.code) refresh();
