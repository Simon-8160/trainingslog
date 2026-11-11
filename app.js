'use strict';
/* Trainingslog – alle Daten lokal in localStorage, kein Login, kein Server. */

const KEY = 'trainingslog.v1';
const RACE = { date: '2027-01-24', name: 'Winter Run Graz', goal: '10 km unter 50:00 (5:00/km)' };
const ZONES = [[146, 'Z1'], [162, 'Z2'], [171, 'Z3'], [182, 'Z4'], [999, 'Z5']]; // Schwelle 182, Max 193
const LONGRUN_STAGES = ['2×10 min', '3×10 min', '2×15 min', '20–25 min am Stück'];
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAYSHORT = { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 7: 'So' };
const KINDS = { lh: 'Langhantel (+2,5 kg)', kh: 'Kurzhantel (nächste Hantel)', ma: 'Maschine / Kabel', kg: 'Körpergewicht / Core' };
const DEFAULT_DB = '1 2 3 4 5 6 7 8 9 10 12,5 15 17,5 20 22,5 25 27,5 30 32,5 35 37,5 40 42,5 45 47,5 50';

/* ---------- Helfer ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
const num = v => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const fmt = n => n == null ? '–' : String(Math.round(n * 100) / 100).replace('.', ',');
const range = n => Array.from({ length: n }, (_, i) => i);
const norm = s => String(s || '').trim().toLowerCase();
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => iso(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
const fmtDate = s => { const d = parseD(s); return WD[d.getDay()] + ' ' + d.getDate() + '.' + (d.getMonth() + 1) + '.'; };
const fmtDateY = s => { const d = parseD(s); return d.getDate() + '.' + (d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(2); };
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const zone = hr => hr ? ZONES.find(z => hr <= z[0])[1] : null;
const zoneTag = hr => hr ? `<span class="zone ${zone(hr).toLowerCase()}">${zone(hr)}</span>` : '';
const paceStr = (min, km) => { if (!min || !km) return null; const p = min / km; let m = Math.floor(p), s = Math.round((p - m) * 60); if (s === 60) { m++; s = 0; } return m + ':' + String(s).padStart(2, '0'); };
const durStr = min => { if (!min) return '–'; const h = Math.floor(min / 60), m = Math.floor(min % 60), s = Math.round((min % 1) * 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + (s ? ':' + String(s).padStart(2, '0') : '') + (h ? ' h' : ' min'); };
function parseDur(v) { // "45" = 45 min, "45:30" = 45 min 30 s, "1:15:00" = 75 min
  if (!v) return null; const p = String(v).trim().split(':').map(x => num(x));
  if (p.some(x => x == null)) return null;
  if (p.length === 1) return p[0]; if (p.length === 2) return p[0] + p[1] / 60; return p[0] * 60 + p[1] + p[2] / 60;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1800); }

/* ---------- Daten ---------- */
function seed() {
  const ex = (name, sets, repMin, repMax, kind, note = '') => ({ id: uid(), name, sets, repMin, repMax, kind, step: 2.5, note });
  const core = () => ex('Core', 3, null, null, 'kg', 'Wdh oder Sekunden eintragen');
  const units = [
    { id: 'beine', name: 'Beine', type: 'kraft', day: 1, time: '05:00', dur: 60, exercises: [
      ex('Kniebeuge', 4, 6, 10, 'lh'),
      ex('Rumänisches Kreuzheben', 3, 8, 10, 'lh'),
      ex('Hip Thrust / Glute Bridge (Multipresse)', 3, 10, 10, 'ma'),
      ex('Goblet Squat', 2, 12, 12, 'kh'),
      ex('Wadenheben', 3, 12, 12, 'kh', 'Handtuch unter den Zehen · 3 s hoch, 2 s halten, 3 s runter'),
      core()] },
    { id: 'oka', name: 'Oberkörper A', sub: 'Bank-Fokus', type: 'kraft', day: 3, time: '05:00', dur: 60, exercises: [
      ex('Bankdrücken', 4, 6, 10, 'lh'),
      ex('Rudern, Ellbogen weit', 4, 8, 10, 'lh'),
      ex('Schrägbank Kurzhantel', 3, 8, 12, 'kh', 'Gewicht pro Hantel'),
      ex('Seitheben', 4, 12, 15, 'kh', 'Gewicht pro Hantel'),
      ex('Reverse Flys', 3, 15, 15, 'kh'),
      ex('Bizeps Curls', 3, 10, 12, 'kh'),
      core()] },
    { id: 'rad', name: 'Rad indoor', type: 'cardio', cardio: 'Rad', plan: 'rad', day: 4, time: '05:00', dur: 45, exercises: [] },
    { id: 'okb', name: 'Oberkörper B', sub: 'Schulter-/Zug-Fokus', type: 'kraft', day: 5, time: '05:00', dur: 60, exercises: [
      ex('Schulterdrücken', 3, 6, 10, 'lh'),
      ex('Klimmzug / Latzug', 4, 6, 10, 'ma'),
      ex('Kurzhantel-Bankdrücken / Dips', 3, 8, 12, 'kh'),
      ex('Seitheben', 4, 12, 15, 'kh', 'Gewicht pro Hantel'),
      ex('Face Pulls', 3, 15, 15, 'ma'),
      ex('Trizeps', 3, 10, 12, 'ma'),
      core()] },
    { id: 'lockerlauf', name: 'Lockerer Lauf', type: 'cardio', cardio: 'Lauf', plan: 'locker', optional: true, day: 6, time: '07:00', dur: 40, exercises: [] },
    { id: 'longrun', name: 'Long Run', type: 'cardio', cardio: 'Lauf', plan: 'longrun', day: 7, time: '08:00', dur: 80, exercises: [] },
  ];
  const one = (name, w, r) => ({ name, sets: [{ w, r }] });
  return {
    version: 1, units, cardio: [], active: null, settings: { dbSteps: DEFAULT_DB }, lastExport: null,
    sessions: [{ id: uid(), unitId: null, unitName: 'Ausgangswerte (Juni 2026)', date: '2026-06-15', seed: true, entries: [
      one('Bankdrücken', 70, 7), one('Rudern, Ellbogen weit', 75, 8), one('Schrägbank Kurzhantel', 25, 10),
      one('Klimmzug / Latzug', 65, 10), one('Seitheben', 10, 10)] }],
  };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.units)) { s.settings ||= { dbSteps: DEFAULT_DB }; s.cardio ||= []; s.sessions ||= []; return s; } } catch (e) { }
  return seed();
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { alert('Speichern fehlgeschlagen: ' + e.message); } }
save();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });

const unitById = id => S.units.find(u => u.id === id);
const dbSteps = () => String(S.settings.dbSteps || DEFAULT_DB).split(/\s+/).map(num).filter(x => x != null).sort((a, b) => a - b);

/* ---------- Progression ---------- */
function lastPerf(name) {
  const k = norm(name); let best = null;
  for (const s of S.sessions) for (const e of s.entries) {
    if (norm(e.name) !== k || !e.sets.length) continue;
    const key = s.date + (s.end || 0);
    if (!best || key > best.key) best = { key, date: s.date, sets: e.sets };
  }
  return best;
}
function nextWeight(ex, w) {
  if (ex.kind === 'kh') { const n = dbSteps().find(s => s > w + 1e-9); return n ?? w + 2.5; }
  if (ex.kind === 'lh') return w + 2.5;
  return w + (num(ex.step) || 2.5);
}
function prevWeight(ex, w) {
  if (ex.kind === 'kh') { const st = dbSteps().filter(s => s < w - 1e-9); return st.length ? st[st.length - 1] : Math.max(0, w - 1); }
  return Math.max(0, w - (ex.kind === 'lh' ? 2.5 : (num(ex.step) || 2.5)));
}
function suggest(ex) {
  const n = ex.sets || 3, last = lastPerf(ex.name);
  if (!last) return { last: null, sets: range(n).map(() => ({ w: null, r: ex.repMin ?? null })), text: 'Kein Vorwert – Startgewicht mit 1–2 Wdh Reserve wählen' };
  const L = last.sets, get = i => L[Math.min(i, L.length - 1)];
  if (ex.repMax == null) return { last, sets: range(n).map(i => ({ ...get(i) })), text: 'Wie letztes Mal' };
  const atTop = L.every(s => (s.r || 0) >= ex.repMax);
  if (atTop && L.length >= n) {
    if (ex.kind === 'kg') return { last, sets: range(n).map(i => ({ w: get(i).w, r: (get(i).r || 0) + 1 })), text: 'Oberes Ende geschafft – Zusatzgewicht oder schwerere Variante', up: true };
    const top = Math.max(...L.map(s => s.w || 0)), nw = nextWeight(ex, top);
    return { last, up: true, sets: range(n).map(() => ({ w: nw, r: ex.repMin })), text: `Alle Sätze am oberen Ende → +${fmt(nw - top)} kg, neu bei ${ex.repMin} Wdh` };
  }
  const sets = range(n).map(i => { const b = get(i); return { w: b.w, r: Math.min((b.r || 0) + 1, ex.repMax) }; });
  return { last, sets, text: atTop ? `Oberes Ende erreicht – erst alle ${n} Sätze schaffen` : 'Gleiches Gewicht, +1 Wdh anpeilen' };
}
const setsText = sets => {
  const ws = [...new Set(sets.map(s => s.w))];
  if (ws.length === 1) return (ws[0] == null ? '? kg' : fmt(ws[0]) + ' kg') + ' × ' + sets.map(s => s.r ?? '?').join(' / ');
  return sets.map(s => `${fmt(s.w)}×${s.r ?? '?'}`).join(' · ');
};
const targetText = ex => ex.repMax == null ? `${ex.sets} Sätze` : ex.repMin === ex.repMax ? `${ex.sets}×${ex.repMin}` : `${ex.sets}×${ex.repMin}–${ex.repMax}`;

/* ---------- Woche ---------- */
function doneMap(mon) {
  const a = iso(mon), b = iso(addDays(mon, 7)), m = {};
  for (const s of S.sessions) if (s.unitId && s.date >= a && s.date < b) m[s.unitId] = s.date;
  for (const c of S.cardio) if (c.unitId && c.date >= a && c.date < b) m[c.unitId] = c.date;
  return m;
}
function nextUnit() {
  const m = doneMap(monday(new Date())), U = S.units; let last = -1;
  U.forEach((u, i) => { if (m[u.id]) last = i; });
  const ok = u => !m[u.id] && !u.optional;
  for (let i = last + 1; i < U.length; i++) if (ok(U[i])) return U[i];
  for (let i = 0; i < U.length; i++) if (ok(U[i])) return U[i];
  return U.find(u => !m[u.id]) || null;
}
function cardioHint(u, ahead = 0) {
  if (!u) return '';
  const n = S.cardio.filter(c => c.unitId === u.id).length + ahead;
  if (u.plan === 'rad') return n % 2 === 0 ? 'Intervalle: 4×4 min hart / 3 min locker' : 'Locker 45 min (Z2)';
  if (u.plan === 'longrun') {
    if (n % 3 === 2) return '70–80 min ganz locker, ohne Tempoblock (jede 3. Woche)';
    return `70–80 min mit Tempoblock ${LONGRUN_STAGES[Math.min(n - Math.floor(n / 3), 3)]} @ 5:00–5:05/km`;
  }
  if (u.plan === 'locker') return '30–40 min locker (Z2), optional';
  return u.hint || '';
}

/* ---------- Navigation ---------- */
let route = { name: 'heute' };
let ui = { histSeg: 'ex', weekOff: 0, calWeek: 1 };
function go(r) { route = r; render(); window.scrollTo(0, 0); }
const TABOF = { heute: 'heute', workout: 'heute', cardio: 'heute', woche: 'woche', verlauf: 'verlauf', exercise: 'verlauf', mehr: 'mehr', editUnit: 'mehr' };

function render() {
  const v = { heute: vHeute, workout: vWorkout, cardio: vCardio, woche: vWoche, verlauf: vVerlauf, exercise: vExercise, mehr: vMehr, editUnit: vEditUnit }[route.name] || vHeute;
  $('#main').innerHTML = v();
  document.body.classList.toggle('in-workout', route.name === 'workout');
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === TABOF[route.name]));
}

/* ---------- Heute ---------- */
function vHeute() {
  const m = doneMap(monday(new Date())), nx = nextUnit(), a = S.active;
  const days = Math.round((parseD(RACE.date) - parseD(todayStr())) / 864e5);
  let h = `<div class="row between"><h1>Heute</h1><span class="muted small">${fmtDate(todayStr())}</span></div>`;
  if (a) h += `<div class="card hero"><div class="label">Läuft gerade</div><div class="big">${esc(a.unitName)}</div>
    <p class="muted small">${Object.values(a.log).reduce((n, l) => n + l.length, 0)} Sätze eingetragen</p>
    <button class="btn pri block" data-act="resume">Weiter trainieren</button></div>`;
  else if (nx) h += `<div class="card hero"><div class="label">Als Nächstes fällig</div><div class="big">${esc(nx.name)}</div>
    <p class="muted small">${nx.type === 'kraft' ? (nx.sub ? esc(nx.sub) + ' · ' : '') + nx.exercises.length + ' Übungen' : esc(cardioHint(nx))}</p>
    <button class="btn pri block" data-act="start" data-v="${nx.id}">${nx.type === 'kraft' ? 'Einheit starten' : 'Eintragen'}</button></div>`;
  else h += `<div class="card hero"><div class="label">Woche komplett 🎉</div><p>Alle Einheiten dieser Woche erledigt.</p></div>`;
  h += `<h2>Andere Einheit wählen</h2><div class="unit-list">` + S.units.map(u => `
    <button class="unit-btn ${m[u.id] ? 'done' : ''}" data-act="start" data-v="${u.id}">
      <span class="day">${DAYSHORT[u.day] || ''}</span><span class="nm">${esc(u.name)}${u.optional ? ' <span class="muted small">(optional)</span>' : ''}</span>
      ${m[u.id] ? `<span class="chk">✓ ${fmtDate(m[u.id]).split(' ')[0]}</span>` : '<span class="muted">›</span>'}</button>`).join('') + `</div>
    <button class="btn block" style="margin-top:10px" data-act="free-cardio">+ Ausdauer frei eintragen</button>
    <p class="race" style="margin-top:18px">🏁 ${RACE.name}: noch ${days} Tage · Ziel ${RACE.goal}</p>`;
  return h;
}

/* ---------- Training ---------- */
function startUnit(id) {
  const u = unitById(id); if (!u) return;
  if (u.type === 'cardio') return go({ name: 'cardio', unitId: id });
  if (S.active) {
    if (S.active.unitId === id) return go({ name: 'workout' });
    if (!confirm(`„${S.active.unitName}“ läuft noch. Verwerfen und „${u.name}“ starten?`)) return;
  }
  S.active = { id: uid(), unitId: u.id, unitName: u.name, date: todayStr(), start: Date.now(), exercises: u.exercises.map(e => ({ ...e })), log: {}, drafts: {}, lastSetAt: null };
  save(); go({ name: 'workout' });
}
function draft(i) {
  const a = S.active, ex = a.exercises[i];
  if (a.drafts[i]) return a.drafts[i];
  const sg = suggest(ex).sets, k = (a.log[i] || []).length;
  return { ...(sg[k] || sg[sg.length - 1]) };
}
function exCard(i) {
  const a = S.active, ex = a.exercises[i], sg = suggest(ex), logged = a.log[i] || [], d = draft(i);
  const complete = logged.length >= ex.sets;
  return `<div class="card ex ${complete ? 'complete' : ''}" id="ex-${i}">
    <div class="ex-top"><div class="ex-name">${esc(ex.name)}</div><div class="target">${targetText(ex)}</div></div>
    ${ex.note ? `<div class="note">${esc(ex.note)}</div>` : ''}
    <div class="info">
      <div class="k">Zuletzt</div><div>${sg.last ? `<span class="muted">${fmtDateY(sg.last.date)}:</span> ${setsText(sg.last.sets)}` : '<span class="muted">–</span>'}</div>
      <div class="k">Heute</div><div class="sug ${sg.up ? 'up' : ''}">${sg.last ? setsText(sg.sets) : '–'}<div class="reason">${esc(sg.text)}</div></div>
    </div>
    ${logged.length ? `<div class="chips">${logged.map((s, k) => `<button class="chip" data-act="delset" data-i="${i}" data-k="${k}">${k + 1}: ${fmt(s.w)}×${s.r} ✓</button>`).join('')}</div>` : ''}
    <div class="entry">
      <div class="stepper"><button data-act="step" data-i="${i}" data-f="w" data-d="-1" aria-label="weniger Gewicht">−</button>
        <div class="val"><input data-in="w" data-i="${i}" inputmode="decimal" value="${d.w == null ? '' : fmt(d.w)}" placeholder="0"><span class="u">kg</span></div>
        <button data-act="step" data-i="${i}" data-f="w" data-d="1" aria-label="mehr Gewicht">+</button></div>
      <div class="stepper"><button data-act="step" data-i="${i}" data-f="r" data-d="-1" aria-label="weniger Wdh">−</button>
        <div class="val"><input data-in="r" data-i="${i}" inputmode="numeric" value="${d.r ?? ''}" placeholder="0"><span class="u">${ex.repMax == null ? 'Wdh / Sek' : 'Wdh'}</span></div>
        <button data-act="step" data-i="${i}" data-f="r" data-d="1" aria-label="mehr Wdh">+</button></div>
      <button class="btn pri log ${complete ? 'extra' : ''}" data-act="log" data-i="${i}">✓ ${complete ? 'Extra-Satz' : 'Satz ' + (logged.length + 1) + ' von ' + ex.sets}</button>
    </div></div>`;
}
function vWorkout() {
  const a = S.active; if (!a) { route = { name: 'heute' }; return vHeute(); }
  return `<div class="wk-head"><div class="row between"><h1>${esc(a.unitName)}</h1><span class="rest" id="rest"></span></div>
    <div class="row" style="margin-top:6px"><input type="date" data-in="date" value="${a.date}" style="min-height:36px;padding:4px 10px;width:auto">
    <span class="grow"></span><button class="btn sm" data-act="tab" data-v="heute">‹ Pause</button></div></div>
    <p class="muted tiny">Alle Kraftübungen mit 1–2 Wdh Reserve (RIR 1–2). Satz antippen zum Löschen.</p>
    ${a.exercises.map((_, i) => exCard(i)).join('')}
    <button class="btn pri block" style="margin-top:16px" data-act="finish">Einheit beenden &amp; speichern</button>
    <button class="btn danger block" style="margin-top:8px" data-act="discard">Einheit verwerfen</button>`;
}
function refreshCard(i) { const el = $('#ex-' + i); if (el) el.outerHTML = exCard(i); }
function logSet(i) {
  const a = S.active, ex = a.exercises[i], card = $('#ex-' + i);
  const w = num($('[data-in=w]', card).value), r = num($('[data-in=r]', card).value);
  if (r == null) return toast('Wdh eintragen');
  a.log[i] = (a.log[i] || []).concat({ w: w ?? 0, r });
  const k = a.log[i].length, sg = suggest(ex).sets, prev = sg[k - 1], nx = sg[k] || sg[sg.length - 1];
  // Nächster Satz: Vorschlag, aber wenn du heute ein anderes Gewicht genommen hast, bleibt dieses
  a.drafts[i] = { w: prev && prev.w != null && w !== prev.w ? w : (nx.w ?? w), r: nx.r ?? r };
  a.lastSetAt = Date.now(); save(); refreshCard(i);
  if (k === ex.sets && i + 1 < a.exercises.length) setTimeout(() => $('#ex-' + (i + 1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
  toast(`Satz ${k}: ${fmt(w ?? 0)} kg × ${r}`);
}
function finishWorkout() {
  const a = S.active, entries = a.exercises.map((ex, i) => ({ name: ex.name, sets: a.log[i] || [] })).filter(e => e.sets.length);
  if (!entries.length && !confirm('Noch keine Sätze eingetragen. Trotzdem beenden (wird nicht gespeichert)?')) return;
  if (entries.length) S.sessions.push({ id: a.id, unitId: a.unitId, unitName: a.unitName, date: a.date, start: a.start, end: Date.now(), entries });
  S.active = null; save(); go({ name: 'heute' }); if (entries.length) toast('Einheit gespeichert 💪');
}
setInterval(() => {
  const el = $('#rest'); if (!el || !S.active) return;
  if (!S.active.lastSetAt) { el.textContent = ''; return; }
  const s = Math.floor((Date.now() - S.active.lastSetAt) / 1000);
  el.textContent = s > 3600 ? '' : 'Pause ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}, 1000);

/* ---------- Ausdauer ---------- */
function vCardio() {
  const u = unitById(route.unitId), type = route.type || u?.cardio || 'Lauf';
  return `<div class="row between"><h1>${esc(u ? u.name : 'Ausdauer')}</h1><button class="btn sm" data-act="tab" data-v="heute">Abbrechen</button></div>
  ${u ? `<div class="card hero"><div class="label">Plan heute</div><p>${esc(cardioHint(u))}</p></div>` : ''}
  <div class="card" id="cform">
    <div class="seg">${['Lauf', 'Rad'].map(t => `<button class="${t === type ? 'on' : ''}" data-act="ctype" data-v="${t}">${t === 'Lauf' ? '🏃 Lauf' : '🚴 Rad'}</button>`).join('')}</div>
    <div class="grid2">
      <div><label>Datum</label><input type="date" name="date" value="${todayStr()}"></div>
      <div><label>Dauer (min oder h:mm:ss)</label><input name="dur" inputmode="decimal" placeholder="${u?.dur || 45}" data-in="cpace"></div>
      <div><label>Distanz (km)</label><input name="km" inputmode="decimal" placeholder="z. B. 10,5" data-in="cpace"></div>
      <div><label>HF Ø</label><input name="hr" inputmode="numeric" placeholder="z. B. 150" data-in="cpace"></div>
    </div>
    <p id="cpace" class="small muted" style="margin-top:10px">Pace wird automatisch berechnet.</p>
    <label>Details</label><input name="detail" value="${esc(u ? cardioHint(u) : '')}">
    <label>Notiz</label><textarea name="note" placeholder="Gefühl, Wetter, Strecke …"></textarea>
    <button class="btn pri block" style="margin-top:12px" data-act="csave" data-type="${type}">Speichern</button>
  </div>
  <p class="tiny muted">HF-Zonen (Schwelle 182): Z1 &lt;147 · Z2 147–162 · Z3 163–171 · Z4 172–182 · Z5 &gt;182</p>`;
}
function updatePace() {
  const f = $('#cform'); if (!f) return;
  const min = parseDur(f.querySelector('[name=dur]').value), km = num(f.querySelector('[name=km]').value), hr = num(f.querySelector('[name=hr]').value);
  const parts = [];
  if (min && km) parts.push(`Pace <b>${paceStr(min, km)} /km</b>`, `${fmt(Math.round(km / min * 600) / 10)} km/h`);
  if (hr) parts.push(`HF ${hr} ${zoneTag(hr)}`);
  $('#cpace').innerHTML = parts.length ? parts.join(' · ') : 'Pace wird automatisch berechnet.';
}
function saveCardio(type) {
  const f = $('#cform'), g = n => f.querySelector(`[name=${n}]`).value;
  const min = parseDur(g('dur')), km = num(g('km')), hr = num(g('hr'));
  if (!min) return toast('Dauer eintragen');
  const u = unitById(route.unitId);
  S.cardio.push({ id: uid(), unitId: u?.id || null, unitName: u?.name || type, date: g('date') || todayStr(), type, min, km, hr, detail: g('detail').trim(), note: g('note').trim() });
  save(); go({ name: 'heute' }); toast('Ausdauer gespeichert');
}

/* ---------- Woche ---------- */
function vWoche() {
  const mon = addDays(monday(new Date()), 7 * ui.weekOff), m = doneMap(mon), today = todayStr();
  const req = S.units.filter(u => !u.optional), done = req.filter(u => m[u.id]).length;
  const kw = (() => { const d = addDays(mon, 3), j = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - monday(j)) / 864e5) / 7); })();
  let h = `<h1>Woche</h1><div class="row between"><button class="btn sm" data-act="wk" data-d="-1">‹</button>
    <div style="text-align:center"><b>KW ${kw}</b><div class="muted small">${fmtDate(iso(mon))} – ${fmtDate(iso(addDays(mon, 6)))}</div></div>
    <button class="btn sm" data-act="wk" data-d="1">›</button></div>
    <div class="card"><div class="row between"><b>${done} von ${req.length} Einheiten erledigt</b><span class="muted small">${S.units.some(u => u.optional && m[u.id]) ? '+ optional ✓' : ''}</span></div>
    <div class="prog"><div style="width:${req.length ? done / req.length * 100 : 0}%"></div></div>
    <div style="margin-top:10px">${S.units.map(u => `<span class="tag ${m[u.id] ? 'ok' : ''}">${m[u.id] ? '✓' : '○'} ${esc(u.name)}${u.optional ? '*' : ''}</span>`).join('')}</div>
    <p class="tiny muted">* optional</p></div><div class="card">`;
  for (let i = 0; i < 7; i++) {
    const ds = iso(addDays(mon, i));
    const items = [...S.sessions.filter(s => s.date === ds && !s.seed).map(s => `<span class="tag ok">🏋️ ${esc(s.unitName)} · ${s.entries.reduce((n, e) => n + e.sets.length, 0)} Sätze</span>`),
      ...S.cardio.filter(c => c.date === ds).map(c => `<span class="tag ok">${c.type === 'Rad' ? '🚴' : '🏃'} ${esc(c.unitName)} · ${durStr(c.min)}${c.km ? ' · ' + fmt(c.km) + ' km' : ''}</span>`)];
    const planned = S.units.filter(u => u.day === i + 1 && !m[u.id]).map(u => `<span class="tag">○ ${esc(u.name)}</span>`);
    h += `<div class="weekday ${ds === today ? 'today' : ''}"><div class="d">${fmtDate(ds)}</div><div>${items.join('')}${planned.join('') || (items.length ? '' : '<span class="muted small">–</span>')}</div></div>`;
  }
  return h + `</div><button class="btn block" data-act="tab" data-v="mehr">📆 Woche in Kalender exportieren</button>`;
}

/* ---------- Verlauf ---------- */
function exerciseNames() {
  const seen = new Map();
  for (const u of S.units) for (const e of u.exercises) if (!seen.has(norm(e.name))) seen.set(norm(e.name), e.name);
  for (const s of S.sessions) for (const e of s.entries) if (!seen.has(norm(e.name))) seen.set(norm(e.name), e.name);
  return [...seen.values()];
}
function historyOf(name) {
  const k = norm(name), out = [];
  for (const s of S.sessions) for (const e of s.entries) if (norm(e.name) === k && e.sets.length) out.push({ date: s.date, end: s.end || 0, unit: s.unitName, sets: e.sets });
  return out.sort((a, b) => (a.date + a.end) < (b.date + b.end) ? -1 : 1);
}
function vVerlauf() {
  const seg = ui.histSeg;
  let h = `<h1>Verlauf</h1><div class="seg">${[['ex', 'Übungen'], ['ses', 'Einheiten'], ['car', 'Ausdauer']].map(([k, l]) => `<button class="${seg === k ? 'on' : ''}" data-act="hseg" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (seg === 'ex') {
    h += `<div class="card">` + exerciseNames().map(n => { const l = lastPerf(n); return `<button class="list-item" data-act="exopen" data-v="${esc(n)}">
      <span class="grow"><b>${esc(n)}</b><br><span class="small muted">${l ? fmtDateY(l.date) + ': ' + setsText(l.sets) : 'noch kein Eintrag'}</span></span><span class="muted">›</span></button>`; }).join('') + `</div>`;
  } else if (seg === 'ses') {
    const list = [...S.sessions].sort((a, b) => (b.date + (b.end || 0)) > (a.date + (a.end || 0)) ? 1 : -1);
    h += list.length ? list.map(s => `<div class="card"><div class="row between"><b>${esc(s.unitName)}</b><span class="muted small">${fmtDate(s.date)} ${s.date.slice(0, 4)}</span></div>
      <table class="hist">${s.entries.map(e => `<tr><td>${esc(e.name)}</td><td>${setsText(e.sets)}</td></tr>`).join('')}</table>
      <button class="btn sm danger" style="margin-top:8px" data-act="delses" data-v="${s.id}">Löschen</button></div>`).join('') : '<p class="muted">Noch keine Einheiten.</p>';
  } else {
    const list = [...S.cardio].sort((a, b) => b.date > a.date ? 1 : -1);
    h += list.length ? list.map(c => `<div class="card"><div class="row between"><b>${c.type === 'Rad' ? '🚴' : '🏃'} ${esc(c.unitName)}</b><span class="muted small">${fmtDate(c.date)} ${c.date.slice(0, 4)}</span></div>
      <p>${durStr(c.min)}${c.km ? ` · ${fmt(c.km)} km · ${paceStr(c.min, c.km)} /km` : ''}${c.hr ? ` · HF ${c.hr} ${zoneTag(c.hr)}` : ''}</p>
      ${c.detail ? `<p class="small muted">${esc(c.detail)}</p>` : ''}${c.note ? `<p class="small">${esc(c.note)}</p>` : ''}
      <button class="btn sm danger" data-act="delcar" data-v="${c.id}">Löschen</button></div>`).join('') : '<p class="muted">Noch keine Ausdauer-Einträge.</p>';
  }
  return h;
}
function chartSVG(hist) {
  if (hist.length < 2) return '<p class="muted small">Die Kurve erscheint ab zwei Einträgen.</p>';
  const pts = hist.map(h => { const w = Math.max(...h.sets.map(s => s.w || 0)); const r = Math.max(...h.sets.filter(s => (s.w || 0) === w).map(s => s.r || 0)); return { date: h.date, w, r, e: w * (1 + r / 30) }; });
  const W = 340, H = 190, P = { l: 34, r: 12, t: 22, b: 24 }, n = pts.length;
  let lo = Math.min(...pts.map(p => p.w)), hi = Math.max(...pts.map(p => p.e));
  if (hi - lo < 5) { hi += 2.5; lo -= 2.5; } const pad = (hi - lo) * .08; lo = Math.max(0, lo - pad); hi += pad;
  const x = i => P.l + i * (W - P.l - P.r) / (n - 1), y = v => P.t + (hi - v) * (H - P.t - P.b) / (hi - lo);
  const line = k => pts.map((p, i) => `${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  const every = Math.ceil(n / 8);
  const ticks = [lo, (lo + hi) / 2, hi].map(v => `<text x="${P.l - 4}" y="${y(v) + 4}" text-anchor="end" fill="#8d95a3" font-size="10">${Math.round(v)}</text><line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="#2a2f38"/>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${ticks}
    <polyline points="${line('e')}" fill="none" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="4 3"/>
    <polyline points="${line('w')}" fill="none" stroke="#4ade80" stroke-width="2.5"/>
    ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.w)}" r="3.5" fill="#4ade80"/>${(i % every === 0 || i === n - 1) ? `<text x="${x(i)}" y="${y(p.w) - 8}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}" fill="#eef1f5" font-size="10" font-weight="600">${fmt(p.w)}×${p.r}</text>` : ''}`).join('')}
    <text x="${P.l}" y="${H - 6}" fill="#8d95a3" font-size="10">${fmtDateY(pts[0].date)}</text>
    <text x="${W - P.r}" y="${H - 6}" text-anchor="end" fill="#8d95a3" font-size="10">${fmtDateY(pts[n - 1].date)}</text></svg>
    <p class="tiny muted"><span style="color:#4ade80">━</span> schwerster Satz (Gewicht×Wdh) · <span style="color:#60a5fa">┅</span> geschätztes 1RM (Epley)</p>`;
}
function vExercise() {
  const hist = historyOf(route.ex);
  return `<div class="row between"><h1>${esc(route.ex)}</h1><button class="btn sm" data-act="tab" data-v="verlauf">‹ Zurück</button></div>
    <div class="card">${chartSVG(hist)}</div>
    <div class="card">${hist.length ? `<table class="hist">${[...hist].reverse().map(h => `<tr><td>${fmtDateY(h.date)}</td><td>${setsText(h.sets)}<div class="tiny muted">${esc(h.unit)}</div></td></tr>`).join('')}</table>` : '<p class="muted">Noch keine Einträge.</p>'}</div>`;
}

/* ---------- Mehr: Plan, Kalender, Export ---------- */
function vMehr() {
  const le = S.lastExport ? new Date(S.lastExport).toLocaleDateString('de-AT') : 'noch nie';
  return `<h1>Mehr</h1>
  <h2>Wochenplan bearbeiten</h2><div class="unit-list">${S.units.map(u => `<button class="unit-btn" data-act="editunit" data-v="${u.id}">
    <span class="day">${DAYSHORT[u.day] || ''}</span><span class="nm">${esc(u.name)}<br><span class="small muted">${u.type === 'kraft' ? u.exercises.length + ' Übungen' : esc(u.cardio)} · ${u.time} · ${u.dur} min</span></span><span class="muted">›</span></button>`).join('')}</div>
  <button class="btn block" style="margin-top:8px" data-act="addunit">+ Einheit hinzufügen</button>

  <h2>Kalender-Export</h2><div class="card">
    <p class="small muted">Erstellt eine .ics-Datei mit allen Einheiten der gewählten Woche (Tag &amp; Uhrzeit laut Plan, Übungen in der Beschreibung).</p>
    <div class="seg">${[[0, 'Diese Woche'], [1, 'Nächste'], [2, 'Übernächste']].map(([k, l]) => `<button class="${ui.calWeek === k ? 'on' : ''}" data-act="calw" data-v="${k}">${l}</button>`).join('')}</div>
    <p class="small">${fmtDate(iso(addDays(monday(new Date()), 7 * ui.calWeek)))} – ${fmtDate(iso(addDays(monday(new Date()), 7 * ui.calWeek + 6)))}</p>
    <button class="btn pri block" data-act="ics-open">📆 Zum Kalender hinzufügen</button>
    <button class="btn block" style="margin-top:8px" data-act="ics-file">.ics-Datei teilen / sichern</button>
    <p class="tiny muted">iPhone: „Zum Kalender hinzufügen“ öffnet den Import-Dialog („Alle hinzufügen“). Klappt das in der Home-Bildschirm-App nicht, die Datei teilen und in „Dateien“ sichern, dann antippen.</p></div>

  <h2>Daten &amp; Backup</h2><div class="card">
    <p class="small muted">Alle Daten liegen nur auf diesem Gerät. Letzter Export: <b>${le}</b></p>
    <div class="grid2"><button class="btn" data-act="exp-json">Backup (JSON)</button><button class="btn" data-act="exp-csv">Tabelle (CSV)</button></div>
    <button class="btn block" style="margin-top:8px" data-act="imp">Backup wiederherstellen …</button>
    <input type="file" id="impfile" accept="application/json,.json" hidden>
  </div>

  <h2>Einstellungen</h2><div class="card">
    <label>Verfügbare Kurzhanteln (kg, mit Leerzeichen getrennt)</label>
    <input data-in="dbsteps" value="${esc(S.settings.dbSteps)}">
    <p class="tiny muted">Für den Progressionsvorschlag „nächste Kurzhantel“.</p>
    <label>HF-Zonen (Schwelle 182, Max 193)</label>
    <p class="small"><span class="zone z1">Z1</span> &lt;147 <span class="zone z2">Z2</span> 147–162 <span class="zone z3">Z3</span> 163–171 <span class="zone z4">Z4</span> 172–182 <span class="zone z5">Z5</span> &gt;182</p>
  </div>
  <button class="btn danger block" style="margin-top:20px" data-act="reset">Alles zurücksetzen</button>
  <p class="tiny muted" style="text-align:center;margin-top:16px">Trainingslog · offline · ohne Konto</p>`;
}
function vEditUnit() {
  const u = unitById(route.id); if (!u) return vMehr();
  const opt = (v, cur) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>`;
  return `<div class="row between"><h1>${esc(u.name)}</h1><button class="btn sm" data-act="tab" data-v="mehr">‹ Fertig</button></div>
  <div class="card">
    <label>Name</label><input data-u="name" value="${esc(u.name)}">
    <div class="grid2">
      <div><label>Richtwert-Tag</label><select data-u="day">${[1, 2, 3, 4, 5, 6, 7].map(d => opt(d, u.day) + DAYSHORT[d] + '</option>').join('')}</select></div>
      <div><label>Uhrzeit (Kalender)</label><input type="time" data-u="time" value="${u.time}"></div>
      <div><label>Dauer (min)</label><input data-u="dur" inputmode="numeric" value="${u.dur}"></div>
      <div><label>Art</label><select data-u="type">${opt('kraft', u.type)}Kraft</option>${opt('cardio', u.type)}Ausdauer</option></select></div>
    </div>
    ${u.type === 'cardio' ? `<label>Ausdauer-Typ</label><select data-u="cardio">${opt('Lauf', u.cardio)}Lauf</option>${opt('Rad', u.cardio)}Rad</option></select>
      ${u.plan ? `<p class="small muted" style="margin-top:8px">Automatischer Plan: ${esc(cardioHint(u))}</p>` : `<label>Plan-Hinweis</label><input data-u="hint" value="${esc(u.hint || '')}">`}` : ''}
    <label class="row" style="gap:10px;margin-top:12px;color:var(--text);font-size:15px"><input type="checkbox" data-u="optional" ${u.optional ? 'checked' : ''} style="width:22px;min-height:22px"> optional (zählt nicht zur Woche)</label>
  </div>
  ${u.type === 'kraft' ? `<h2>Übungen</h2><div class="card">${u.exercises.map((e, i) => `<div class="ex-edit" ${i === 0 ? 'style="border:0;margin:0;padding:0"' : ''}>
      <div class="row"><input class="grow" data-e="${i}" data-k="name" value="${esc(e.name)}">
        <button class="btn sm" data-act="exmv" data-i="${i}" data-d="-1">↑</button><button class="btn sm" data-act="exmv" data-i="${i}" data-d="1">↓</button><button class="btn sm danger" data-act="exdel" data-i="${i}">✕</button></div>
      <div class="g"><div><label>Sätze</label><input data-e="${i}" data-k="sets" inputmode="numeric" value="${e.sets}"></div>
        <div><label>Wdh min</label><input data-e="${i}" data-k="repMin" inputmode="numeric" value="${e.repMin ?? ''}" placeholder="–"></div>
        <div><label>Wdh max</label><input data-e="${i}" data-k="repMax" inputmode="numeric" value="${e.repMax ?? ''}" placeholder="–"></div></div>
      <div class="grid2"><div><label>Gerät / Steigerung</label><select data-e="${i}" data-k="kind">${Object.entries(KINDS).map(([k, l]) => opt(k, e.kind) + l + '</option>').join('')}</select></div>
        <div><label>Stufe (kg, Maschine)</label><input data-e="${i}" data-k="step" inputmode="decimal" value="${fmt(e.step ?? 2.5)}"></div></div>
      <label>Hinweis</label><input data-e="${i}" data-k="note" value="${esc(e.note || '')}"></div>`).join('')}
    <button class="btn block" style="margin-top:12px" data-act="exadd">+ Übung</button></div>
    <p class="tiny muted">Wdh min/max leer lassen = freie Eingabe ohne Progression (z. B. Core). Umbenennen übernimmt auf Wunsch den Verlauf.</p>` : ''}
  <button class="btn danger block" style="margin-top:16px" data-act="delunit">Einheit löschen</button>`;
}

/* ---------- Export ---------- */
async function saveFile(name, mime, text) {
  const blob = new Blob([text], { type: mime });
  if (isIOS() && navigator.canShare) {
    const file = new File([blob], name, { type: mime });
    if (navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return true; } catch (e) { if (e.name === 'AbortError') return false; } }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); return true;
}
function buildCSV() {
  const q = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['Datum', 'Einheit', 'Übung', 'Satz', 'Gewicht (kg)', 'Wdh']];
  for (const s of [...S.sessions].sort((a, b) => a.date < b.date ? -1 : 1)) for (const e of s.entries) e.sets.forEach((st, k) => rows.push([s.date, s.unitName, e.name, k + 1, fmt(st.w), st.r]));
  rows.push([], ['Datum', 'Einheit', 'Typ', 'Dauer (min)', 'km', 'Pace (min/km)', 'HF Ø', 'Zone', 'Details', 'Notiz']);
  for (const c of [...S.cardio].sort((a, b) => a.date < b.date ? -1 : 1)) rows.push([c.date, c.unitName, c.type, fmt(Math.round(c.min * 10) / 10), fmt(c.km), paceStr(c.min, c.km) || '', c.hr || '', zone(c.hr) || '', c.detail, c.note]);
  return '\uFEFF' + rows.map(r => r.map(q).join(';')).join('\r\n');
}
function buildICS(weekOff) {
  const mon = addDays(monday(new Date()), 7 * weekOff), p2 = n => String(n).padStart(2, '0');
  const dt = d => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`;
  const tx = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const fold = l => { const o = []; while (l.length > 70) { o.push(l.slice(0, 70)); l = ' ' + l.slice(70); } o.push(l); return o.join('\r\n'); };
  const now = new Date(), stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trainingslog//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Training'];
  for (const u of S.units) {
    const [hh, mm] = (u.time || '05:00').split(':').map(Number), st = addDays(mon, (u.day || 1) - 1);
    st.setHours(hh, mm, 0, 0); const en = new Date(st.getTime() + (u.dur || 60) * 60000);
    const icon = u.type === 'kraft' ? '🏋️' : u.cardio === 'Rad' ? '🚴' : '🏃';
    const desc = u.type === 'kraft' ? u.exercises.map(e => `• ${e.name} ${targetText(e)}`).join('\n') + '\nRIR 1–2' : cardioHint(u, weekOff - (doneMap(monday(new Date()))[u.id] ? 1 : 0));
    L.push('BEGIN:VEVENT', `UID:${iso(st)}-${u.id}@trainingslog.local`, `DTSTAMP:${stamp}`, `DTSTART:${dt(st)}`, `DTEND:${dt(en)}`,
      fold(`SUMMARY:${tx(icon + ' ' + u.name + (u.optional ? ' (optional)' : ''))}`), fold(`DESCRIPTION:${tx(desc)}`), 'END:VEVENT');
  }
  L.push('END:VCALENDAR'); return L.join('\r\n');
}
function markExport() { S.lastExport = Date.now(); save(); }

/* ---------- Events ---------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, v = b.dataset.v, i = +b.dataset.i;
  const a = S.active;
  switch (act) {
    case 'tab': ui.weekOff = act === 'tab' && v === 'woche' ? 0 : ui.weekOff; go({ name: v }); break;
    case 'start': startUnit(v); break;
    case 'resume': go({ name: 'workout' }); break;
    case 'free-cardio': go({ name: 'cardio', unitId: null }); break;
    case 'step': {
      const ex = a.exercises[i], card = $('#ex-' + i), f = b.dataset.f, d = +b.dataset.d, inp = $(`[data-in=${f}]`, card);
      let val = num(inp.value) ?? 0;
      if (f === 'w') val = d > 0 ? (ex.kind === 'kg' && !val ? 2.5 : nextWeight(ex, val)) : prevWeight(ex, val);
      else val = Math.max(0, val + d);
      inp.value = fmt(val); a.drafts[i] = { ...draft(i), [f]: val }; save(); break;
    }
    case 'log': logSet(i); break;
    case 'delset': if (confirm('Diesen Satz löschen?')) { a.log[i].splice(+b.dataset.k, 1); delete a.drafts[i]; save(); refreshCard(i); } break;
    case 'finish': finishWorkout(); break;
    case 'discard': if (confirm('Einheit wirklich verwerfen? Eingetragene Sätze gehen verloren.')) { S.active = null; save(); go({ name: 'heute' }); } break;
    case 'ctype': route.type = v; $('[data-act=csave]').dataset.type = v; b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); break;
    case 'csave': saveCardio(b.dataset.type); break;
    case 'wk': ui.weekOff += +b.dataset.d; render(); break;
    case 'hseg': ui.histSeg = v; render(); break;
    case 'exopen': go({ name: 'exercise', ex: v }); break;
    case 'delses': if (confirm('Einheit löschen?')) { S.sessions = S.sessions.filter(s => s.id !== v); save(); render(); } break;
    case 'delcar': if (confirm('Eintrag löschen?')) { S.cardio = S.cardio.filter(c => c.id !== v); save(); render(); } break;
    case 'editunit': go({ name: 'editUnit', id: v }); break;
    case 'addunit': { const u = { id: uid(), name: 'Neue Einheit', type: 'kraft', day: 2, time: '05:00', dur: 60, exercises: [] }; S.units.push(u); save(); go({ name: 'editUnit', id: u.id }); break; }
    case 'delunit': { const u = unitById(route.id); if (confirm(`„${u.name}“ aus dem Plan löschen? (Der Verlauf bleibt erhalten.)`)) { S.units = S.units.filter(x => x !== u); save(); go({ name: 'mehr' }); } break; }
    case 'exadd': unitById(route.id).exercises.push({ id: uid(), name: 'Neue Übung', sets: 3, repMin: 8, repMax: 12, kind: 'kh', step: 2.5, note: '' }); save(); render(); break;
    case 'exdel': { const u = unitById(route.id); if (confirm(`„${u.exercises[i].name}“ entfernen?`)) { u.exercises.splice(i, 1); save(); render(); } break; }
    case 'exmv': { const ex = unitById(route.id).exercises, j = i + +b.dataset.d; if (j >= 0 && j < ex.length) { [ex[i], ex[j]] = [ex[j], ex[i]]; save(); render(); } break; }
    case 'calw': ui.calWeek = +v; render(); break;
    case 'ics-open': location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(buildICS(ui.calWeek)); break;
    case 'ics-file': saveFile(`training-${iso(addDays(monday(new Date()), 7 * ui.calWeek))}.ics`, 'text/calendar', buildICS(ui.calWeek)); break;
    case 'exp-json': { const { active, ...data } = S; if (await saveFile(`trainingslog-${todayStr()}.json`, 'application/json', JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2))) { markExport(); render(); } break; }
    case 'exp-csv': if (await saveFile(`trainingslog-${todayStr()}.csv`, 'text/csv', buildCSV())) { markExport(); render(); } break;
    case 'imp': $('#impfile').click(); break;
    case 'reset': if (confirm('Wirklich ALLE Daten löschen und den Startplan wiederherstellen? Vorher am besten ein Backup exportieren.')) { S = seed(); save(); go({ name: 'heute' }); } break;
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.in === 'w' || t.dataset.in === 'r') { const i = +t.dataset.i; S.active.drafts[i] = { ...draft(i), [t.dataset.in]: num(t.value) }; save(); }
  else if (t.dataset.in === 'cpace') updatePace();
  else if (t.dataset.in === 'dbsteps') { S.settings.dbSteps = t.value; save(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.in === 'date' && S.active) { S.active.date = t.value || todayStr(); save(); }
  if (t.id === 'impfile' && t.files[0]) {
    t.files[0].text().then(txt => {
      const d = JSON.parse(txt);
      if (!Array.isArray(d.units) || !Array.isArray(d.sessions)) throw new Error('Keine Trainingslog-Datei');
      if (!confirm(`Backup laden? ${d.sessions.length} Einheiten, ${(d.cardio || []).length} Ausdauer-Einträge. Aktuelle Daten werden ersetzt.`)) return;
      delete d.exportedAt; S = { ...seed(), ...d, active: null }; save(); go({ name: 'heute' }); toast('Backup geladen');
    }).catch(err => alert('Import fehlgeschlagen: ' + err.message));
    t.value = '';
  }
  // Plan-Editor
  const u = route.name === 'editUnit' && unitById(route.id); if (!u) return;
  if (t.dataset.u) {
    const k = t.dataset.u;
    u[k] = k === 'optional' ? t.checked : (k === 'day' || k === 'dur') ? (num(t.value) || u[k]) : t.value;
    if (k === 'type' && t.value === 'cardio' && !u.cardio) u.cardio = 'Lauf';
    save(); if (k === 'type' || k === 'cardio') render();
  } else if (t.dataset.e != null) {
    const ex = u.exercises[+t.dataset.e], k = t.dataset.k;
    if (k === 'name') {
      const old = ex.name, nw = t.value.trim(); if (!nw) { t.value = old; return; }
      ex.name = nw;
      if (norm(old) !== norm(nw) && historyOf(old).length && confirm(`Bisherige Einträge von „${old}“ auf „${nw}“ übertragen?`))
        for (const s of S.sessions) for (const en of s.entries) if (norm(en.name) === norm(old)) en.name = nw;
    } else if (k === 'sets') ex.sets = Math.max(1, num(t.value) || 1);
    else if (k === 'repMin' || k === 'repMax') ex[k] = num(t.value);
    else if (k === 'step') ex.step = num(t.value) || 2.5;
    else ex[k] = t.value;
    if (ex.repMin != null && ex.repMax == null) ex.repMax = ex.repMin;
    if (ex.repMax != null && ex.repMin == null) ex.repMin = ex.repMax;
    save();
  }
});
// Fokus ins Eingabefeld markiert den Inhalt → direkt überschreiben
document.addEventListener('focusin', e => { if (e.target.dataset.in === 'w' || e.target.dataset.in === 'r') setTimeout(() => e.target.select(), 0); });

render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
