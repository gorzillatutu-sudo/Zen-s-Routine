/* =====================================================================
   My Routine — app logic
   Plain JS, no build step. Works in any browser and inside Capacitor.
   ===================================================================== */
(() => {
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const mondayOf = d => { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const vib = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

const ICONS = {
  water: 'assets/water.webp', dumbbell: 'assets/dumbbell.webp', book: 'assets/book.webp',
  meditate: 'assets/meditate.webp', pills: 'assets/pills.webp', sleep: 'assets/sleep.webp',
  wake: 'assets/wake.webp', alarm: 'assets/alarm.webp', walk: 'assets/walk.webp'
};
// icons offered in the "Choose icon" grid (alarm clock replaced by the walking boy)
const PICKER = ['water', 'dumbbell', 'book', 'meditate', 'pills', 'sleep', 'wake', 'walk'];
const SVG = {
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.800 4.600 4.700L19 7.400"/></svg>',
  go: '<svg class="go" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>'
};
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ---------- state ---------- */
const STORE = 'myroutine.v1';
let state;

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function freshState(demo) {
  const habits = [
    { id: 'h1', name: 'Drink Water', icon: 'water', target: 1 },
    { id: 'h2', name: 'Exercise', icon: 'dumbbell', target: 1 },
    { id: 'h3', name: 'Read Book', icon: 'book', target: 1 },
    { id: 'h4', name: 'Meditate', icon: 'meditate', target: 1 },
    { id: 'h5', name: 'Take Vitamins', icon: 'pills', target: 1 },
    { id: 'h6', name: 'Sleep Early', icon: 'sleep', target: 1 }
  ];
  const log = {};
  const today = startOfDay(new Date());
  if (demo) {
    // demo history so the week row, stats and calendar look alive (matches the design file)
    const r = rng(20261104);
    for (let i = 1; i <= 40; i++) {
      const d = addDays(today, -i);
      const inWeek = d >= mondayOf(today);
      const want = inWeek ? 4 + Math.floor(r() * 3) : Math.floor(r() * 7);
      const order = [...habits].sort(() => r() - .5).slice(0, want);
      const l = {}; order.forEach(h => l[h.id] = 1);
      log[keyOf(d)] = l;
    }
    log[keyOf(today)] = { h1: 1, h4: 1, h5: 1 };
  }
  return {
    name: 'You', sound: true, habits, log,
    alarms: [{ id: 'a1', h: 7, m: 0, rep: 'daily', on: true }],
    lastRing: {}
  };
}

function load() {
  try { const raw = localStorage.getItem(STORE); if (raw) return JSON.parse(raw); } catch (e) {}
  return freshState(true);
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }

/* ---------- selectors ---------- */
const count = (id, k = keyOf(new Date())) => (state.log[k] && state.log[k][id]) || 0;
const isDone = (h, k) => count(h.id, k) >= h.target;
function dayStat(k) {
  const total = state.habits.length;
  const done = state.habits.filter(h => isDone(h, k)).length;
  return { done, total, rate: total ? done / total : 0 };
}
function streaks() {
  const today = startOfDay(new Date());
  const ok = d => dayStat(keyOf(d)).rate >= .5;
  let cur = 0, d = ok(today) ? today : addDays(today, -1);
  while (ok(d) && cur < 1000) { cur++; d = addDays(d, -1); }
  let best = 0, run = 0;
  const keys = Object.keys(state.log).sort();
  if (keys.length) {
    let t = new Date(keys[0] + 'T00:00:00');
    while (t <= today) { if (ok(t)) { run++; best = Math.max(best, run); } else run = 0; t = addDays(t, 1); }
  }
  return { cur, best: Math.max(best, cur) };
}

/* ---------- layout / scaling ---------- */
const app = $('#app'), dev = $('#device');
let S = 1;
function layout() {
  const W = innerWidth, H = innerHeight;
  const preview = W > 560 && !native;
  let fw, fh;
  if (preview) {
    fh = Math.min(H - 48, 940); fw = Math.round(fh * 941 / 1672);
    if (fw > W - 48) { fw = W - 48; fh = Math.round(fw * 1672 / 941); }
    dev.classList.add('preview'); dev.style.width = fw + 'px'; dev.style.height = fh + 'px';
  } else {
    dev.classList.remove('preview'); dev.style.width = W + 'px'; dev.style.height = H + 'px'; fw = W; fh = H;
  }
  S = fw / 941;
  app.style.transform = `scale(${S})`;
  app.style.height = (fh / S) + 'px';
  app.classList.toggle('native', !preview && native);
  let sat = 0, sab = 0;
  if (!preview) {
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(p);
    const cs = getComputedStyle(p);
    sat = parseFloat(cs.paddingTop) || 0; sab = parseFloat(cs.paddingBottom) || 0;
    p.remove();
  }
  app.style.setProperty('--sat', (sat / S) + 'px');
  app.style.setProperty('--sab', (sab / S) + 'px');
}
addEventListener('resize', layout);
addEventListener('orientationchange', () => setTimeout(layout, 200));

/* ---------- toast ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- number tween ---------- */
function tween(el, to, suffix = '', dur = 900) {
  const from = parseInt(el.textContent) || 0, t0 = performance.now();
  if (from === to) { el.textContent = to + suffix; return; }
  const step = now => {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * e) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- particles ---------- */
function burst(el, n = 12) {
  const r = el.getBoundingClientRect(), a = app.getBoundingClientRect();
  const x = (r.left + r.width / 2 - a.left) / S, y = (r.top + r.height / 2 - a.top) / S;
  const cols = ['#ffb02e', '#ff7a0a', '#ffd23a', '#ff5f00'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'); p.className = 'pt';
    const ang = Math.random() * 6.283, d = 70 + Math.random() * 90;
    p.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(ang) * d}px;--dy:${Math.sin(ang) * d}px;background:${cols[i % 4]};width:${10 + Math.random() * 10}px;height:${10 + Math.random() * 10}px`;
    app.appendChild(p); setTimeout(() => p.remove(), 950);
  }
}

/* =====================================================================
   RENDER — home
   ===================================================================== */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return ['Good Morning!', "Let's make today<br>more productive!"];
  if (h < 17) return ['Good Afternoon!', 'Keep the momentum<br>going strong!'];
  if (h < 21) return ['Good Evening!', 'Finish the day<br>with a win!'];
  return ['Good Night!', 'Rest well,<br>tomorrow awaits!'];
}
function progressMsg(done, total) {
  if (!total) return ['No habits yet', 'Tap Add Habit to begin'];
  const p = done / total;
  if (p === 0) return ["Let's begin!", 'Check in your first habit'];
  if (p < .5) return ['Nice start!', 'One more step, you got this'];
  if (p < .75) return ['Great start!', "Keep going, you're doing great!"];
  if (p < 1) return ['Almost there!', 'Just a little more to go'];
  return ['Perfect day!', 'You completed every habit'];
}

let ringFirst = true;
function renderProgress() {
  const { done, total, rate } = dayStat(keyOf(new Date()));
  const pct = Math.round(rate * 100);
  tween($('#cntDone'), done, '', 700);
  $('#cntTotal').textContent = total;
  tween($('#pct'), pct, '%', 1100);
  const bar = $('#ringBar'), C = 477.5;
  bar.style.strokeDashoffset = C * (1 - rate);
  const [t, s] = progressMsg(done, total);
  const mt = $('#msgTitle'), ms = $('#msgSub');
  const heart = ' <span class="heart">🧡</span>';
  if (mt.textContent !== t) {
    [mt, ms].forEach(e => { e.style.transition = 'none'; e.style.opacity = 0; e.style.transform = 'translateY(10px)'; });
    mt.textContent = t; ms.innerHTML = esc(s) + heart;
    requestAnimationFrame(() => requestAnimationFrame(() => [mt, ms].forEach(e => { e.style.transition = 'opacity .5s, transform .6s var(--spring)'; e.style.opacity = 1; e.style.transform = 'none'; })));
  } else ms.innerHTML = esc(s) + heart;
  $('.ring').classList.remove('pulse'); void $('.ring').offsetWidth; $('.ring').classList.add('pulse');
}

function renderGreeting() {
  const [g, s] = greeting();
  $('#greet').textContent = g;
  $('#greetSub').innerHTML = s + ' <span class="heart">🧡</span>';
}

function renderWeek(animate) {
  const mon = mondayOf(new Date()), today = startOfDay(new Date());
  let html = '', st = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), fut = d > today, isT = +d === +today;
    st.push({ done: !fut && dayStat(keyOf(d)).rate >= .5 && state.habits.length > 0, fut, isT });
  }
  st.forEach((s, i) => {
    const cx = 87 + 112.5 * i;
    html += `<div class="wd ${s.done ? 'done' : ''} ${s.isT ? 'today' : ''} ${s.fut ? 'future' : ''} ${animate ? 'wpop' : ''}" style="left:${cx}px;--i:${i}"><div class="c">${SVG.check}</div><span>${DAYS[i]}</span></div>`;
    if (i < 6) html += `<i class="wdash ${s.done && st[i + 1].done ? 'on' : ''}" style="left:${cx + 56.25}px"></i>`;
  });
  $('#week').innerHTML = html;
}

/* ---------- habit rows ---------- */
function rowHTML(h, i, isNew) {
  const c = count(h.id), done = c >= h.target;
  return `<div class="hr ${done ? 'done' : ''} ${isNew ? 'new' : ''}" data-id="${h.id}" style="--i:${i}">
    <div class="ico"><img src="${ICONS[h.icon] || ICONS.water}" alt=""></div>
    <div class="tx"><b>${esc(h.name)}</b><small>${subText(h, c)}</small></div>
    <button class="chk" aria-label="Check in">${SVG.check}</button>${SVG.go}
    <button class="del" aria-label="Delete">${SVG.minus}</button></div>`;
}
const EMPTY = `<div class="hempty"><img src="assets/sleep.webp" alt="">No habits yet.<br>Tap + to create your first one.</div>`;
let settledRows = false;
function renderLists(newId) {
  const html = state.habits.length ? state.habits.map((h, i) => rowHTML(h, i, h.id === newId)).join('') : EMPTY;
  ['#homeHabits', '#allHabits'].forEach(sel => { $(sel).innerHTML = html; });
  if (settledRows) $$('.hr').forEach(r => r.classList.add('nodelay'));
  $('#habitsSub').textContent = state.habits.length ? 'Tap the circle to check in.' : 'Start building your routine.';
}
function updateRows() {
  $$('.hr').forEach(r => {
    const h = state.habits.find(x => x.id === r.dataset.id); if (!h) return;
    const c = count(h.id), done = c >= h.target;
    r.classList.toggle('done', done);
    $('small', r).textContent = subText(h, c);
  });
}

/* ---------- alarms ---------- */
function repMatch(a, d) {
  const w = d.getDay();
  if (a.rep === 'weekdays') return w >= 1 && w <= 5;
  if (a.rep === 'weekends') return w === 0 || w === 6;
  return true;
}
function nextFire(a, from = new Date()) {
  for (let i = 0; i < 9; i++) {
    const d = addDays(from, i); d.setHours(a.h, a.m, 0, 0);
    if (d.getTime() <= from.getTime()) continue;
    if (repMatch(a, d)) return d;
  }
  return null;
}
const REP = { daily: 'Daily', weekdays: 'Weekdays', weekends: 'Weekends', once: 'Once' };
const fmt = a => ({ t: `${a.h % 12 || 12}:${pad(a.m)}`, ap: a.h >= 12 ? 'PM' : 'AM' });
// habit time window: { from:{h,m}, to:{h,m} } -> "6:00 AM – 7:00 AM"
const tstr = t => { const f = fmt(t); return `${f.t} ${f.ap}`; };
const subText = (h, c) => `${Math.min(c, h.target)} / ${h.target} times` + (winText(h) ? ` · ${winText(h)}${daysText(h) ? ' · ' + daysText(h) : ''}` : '');
const dayIdx = d => (d.getDay() + 6) % 7;                       // Mon=0 … Sun=6
const habitDays = h => (h.days && h.days.length ? h.days : [0, 1, 2, 3, 4, 5, 6]);
const daysText = h => { const d = habitDays(h); return d.length === 7 ? '' : d.length === 5 && !d.includes(5) && !d.includes(6) ? 'Weekdays' : d.length === 2 && d.includes(5) && d.includes(6) ? 'Weekends' : [...d].sort().map(i => DAYS[i]).join(' '); };
const winText = h => (h.from && h.to) ? `${tstr(h.from)} – ${tstr(h.to)}` : '';
function shownAlarm() {
  const on = state.alarms.filter(a => a.on).map(a => ({ a, d: nextFire(a) })).filter(x => x.d).sort((x, y) => x.d - y.d);
  if (on.length) return on[0].a;
  return state.alarms[0] || null;
}
function renderAlarmCard() {
  const a = shownAlarm(), sw = $('#aSwitch');
  if (!a) {
    $('#aTime').textContent = '--:--'; $('#aAmpm').textContent = '';
    $('#aSub').innerHTML = 'Tap to set an alarm'; sw.classList.remove('on'); $('#aclock').classList.remove('ring-on'); return;
  }
  const f = fmt(a);
  $('#aTime').textContent = f.t; $('#aAmpm').textContent = f.ap;
  $('#aSub').innerHTML = a.on ? 'Wake up &amp; start your day <span class="sun">☀️</span>' : 'Alarm is off';
  sw.classList.toggle('on', a.on); sw.setAttribute('aria-checked', a.on);
  $('#aclock').classList.toggle('ring-on', a.on);
}
function renderAlarmList() {
  const list = $('#alarmList');
  if (!state.alarms.length) { list.innerHTML = `<div class="hempty"><img src="assets/alarm.webp" alt="">No alarms yet.<br>Tap + to set one.</div>`; return; }
  const sorted = [...state.alarms].sort((x, y) => (x.h * 60 + x.m) - (y.h * 60 + y.m));
  list.innerHTML = sorted.map((a, i) => {
    const f = fmt(a);
    return `<div class="arow ${a.on ? '' : 'off'}" data-id="${a.id}" style="--i:${i}">
      <img src="assets/alarm.webp" alt=""><div class="tm"><b>${f.t}<small>${f.ap}</small></b><span>${REP[a.rep]}</span></div>
      <button class="xdel" aria-label="Delete alarm">${SVG.x}</button>
      <button class="switch ${a.on ? 'on' : ''}" role="switch"><i></i></button></div>`;
  }).join('');
}

/* ---------- profile ---------- */
function renderProfile() {
  const { cur } = streaks();
  $('#pfName').textContent = state.name || 'You'; $('#pfNameV').textContent = state.name || 'You';
  $('#pfLevel').textContent = cur >= 14 ? 'Habit Master' : cur >= 7 ? 'Routine Pro' : cur >= 3 ? 'Rising Star' : 'Habit Beginner';
  $('#pfStreak').textContent = cur; $('#pfHabits').textContent = state.habits.length;
  $('#pfRate').textContent = Math.round(weekRate() * 100) + '%';
  $('#soundSw').classList.toggle('on', state.sound);
}
function weekRate() {
  const today = startOfDay(new Date()); let s = 0;
  for (let i = 0; i < 7; i++) s += dayStat(keyOf(addDays(today, -i))).rate;
  return s / 7;
}

function renderAll(opts = {}) {
  renderGreeting(); renderProgress(); renderWeek(opts.animate); renderAlarmCard(); renderProfile();
}

/* =====================================================================
   ACTIONS
   ===================================================================== */
function setCount(id, n) {
  const h = state.habits.find(x => x.id === id); if (!h) return;
  const k = keyOf(new Date());
  const wasAll = dayStat(k).rate === 1;
  state.log[k] = state.log[k] || {};
  state.log[k][id] = Math.max(0, Math.min(h.target, n));
  if (state.log[k][id] === 0) delete state.log[k][id];
  save(); updateRows(); renderProgress(); renderWeek(false); renderProfile();
  if (!wasAll && dayStat(k).rate === 1 && state.habits.length) celebrate();
}
function toggleHabit(id, chkEl) {
  const h = state.habits.find(x => x.id === id); if (!h) return;
  const c = count(id);
  const next = c >= h.target ? 0 : c + 1;
  setCount(id, next);
  if (chkEl) { chkEl.classList.remove('boom'); void chkEl.offsetWidth; chkEl.classList.add('boom'); if (next >= h.target) burst(chkEl, 10); }
  vib(next >= h.target ? 18 : 8);
}
function celebrate() {
  vib([30, 40, 60]);
  burst($('.ring'), 26);
  squishCat(true);
  toast('All habits done today! 🎉');
}

function addHabit(name, icon, target, win, days) {
  const h = { id: 'h' + Date.now().toString(36), name: name.trim(), icon, target };
  if (win) { h.from = win.from; h.to = win.to; if (days && days.length < 7) h.days = days; }
  state.habits.push(h); save();
  renderLists(h.id); renderAll(); scheduleNative();
  toast(`“${h.name}” added`);
}
function deleteHabit(id) {
  const rows = $$(`.hr[data-id="${id}"]`);
  rows.forEach(r => r.classList.add('gone'));
  setTimeout(() => {
    state.habits = state.habits.filter(h => h.id !== id);
    Object.values(state.log).forEach(l => delete l[id]);
    save(); renderLists(); renderAll(); scheduleNative();
  }, 480);
}

function addOrUpdateAlarm(data) {
  const dup = state.alarms.find(x => x.h === data.h && x.m === data.m && x.rep === data.rep && x.id !== data.id);
  if (dup) { dup.on = true; if (data.id) state.alarms = state.alarms.filter(x => x.id !== data.id); }
  else if (data.id) { const a = state.alarms.find(x => x.id === data.id); Object.assign(a, data, { on: true }); }
  else state.alarms.push({ id: 'a' + Date.now().toString(36), on: true, ...data });
  save(); renderAlarmCard(); renderAlarmList(); scheduleNative();
}
function untilText(d) {
  const mins = Math.max(1, Math.round((d - new Date()) / 60000)), h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/* =====================================================================
   SHEETS + POPUPS
   ===================================================================== */
const overlays = $('#overlays'), scrim = $('#scrim');
const stack = [];
function syncScrim() { scrim.classList.toggle('show', stack.length > 0); }

function closeLayer(L) {
  const i = stack.indexOf(L); if (i < 0) return;
  stack.splice(i, 1); L.el.classList.remove('show'); syncScrim();
  if (L.onClose) L.onClose();
  setTimeout(() => L.el.remove(), 700);
}
const closeTop = () => { const L = stack[stack.length - 1]; if (L && !L.locked) closeLayer(L); return !!L; };
scrim.addEventListener('click', closeTop);

function openSheet({ title, body, mount, onClose }) {
  const el = document.createElement('div'); el.className = 'sheet';
  el.innerHTML = `<div class="grab"></div><div class="sh-head"><h2>${esc(title)}</h2><button class="sh-x" aria-label="Close">${SVG.x}</button></div><div class="sh-body">${body}</div>`;
  overlays.appendChild(el);
  const L = { el, onClose }; stack.push(L);
  $('.sh-x', el).onclick = () => closeLayer(L);
  // drag to dismiss
  const dragEls = [$('.grab', el), $('.sh-head', el)];
  let y0 = null, dy = 0, t0 = 0;
  dragEls.forEach(h => {
    h.addEventListener('pointerdown', e => { if (e.target.closest('.sh-x')) return; y0 = e.clientY; dy = 0; t0 = performance.now(); el.classList.add('drag'); h.setPointerCapture(e.pointerId); });
    h.addEventListener('pointermove', e => { if (y0 === null) return; dy = Math.max(0, (e.clientY - y0) / S); el.style.transform = `translateY(${dy}px)`; });
    const end = () => {
      if (y0 === null) return; y0 = null; el.classList.remove('drag');
      const v = dy / Math.max(1, performance.now() - t0);
      el.style.transform = '';
      if (dy > 220 || v > .9) closeLayer(L);
    };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  });
  void el.offsetWidth; // reflow so the slide-up transition runs
  requestAnimationFrame(() => { el.classList.add('show'); syncScrim(); });
  if (mount) mount(el, L);
  return L;
}

function openPopup({ img, title, text, bigtime, buttons = [], ringing, lock }) {
  const el = document.createElement('div'); el.className = 'pop' + (ringing ? ' ringing' : '');
  el.innerHTML = `${img ? `<div class="pimg"><img src="assets/${img}.webp" alt=""></div>` : ''}${bigtime ? `<div class="bigtime">${bigtime}</div>` : ''}<h2>${esc(title)}</h2>${text ? `<p>${text}</p>` : ''}<div class="btns"></div>`;
  overlays.appendChild(el);
  const L = { el, locked: lock }; stack.push(L);
  const box = $('.btns', el);
  buttons.forEach(b => {
    const bt = document.createElement('button'); bt.className = 'cta ' + (b.cls || ''); bt.textContent = b.label;
    bt.onclick = () => { closeLayer(L); b.onClick && b.onClick(); };
    box.appendChild(bt);
  });
  void el.offsetWidth;
  requestAnimationFrame(() => { el.classList.add('show'); syncScrim(); });
  return L;
}
function confirmPop(o) {
  openPopup({ img: o.img, title: o.title, text: o.text, buttons: [{ label: 'Cancel', cls: 'ghost' }, { label: o.ok, cls: o.danger ? 'danger' : '', onClick: o.onOk }] });
}

/* ---------- Time picker sheet (wheel) — used by habit time window ---------- */
function openTimeSheet(title, init, onSave) {
  let hr = init.h % 12 || 12, mn = init.m, ap = init.h >= 12 ? 1 : 0;
  const col = (id, items) => `<div class="col" id="${id}">${items.map((t, i) => `<div data-i="${i}">${t}</div>`).join('')}</div>`;
  openSheet({
    title,
    body: `<div class="wheel">${col('wh', Array.from({ length: 12 }, (_, i) => i + 1))}<span class="colon">:</span>${col('wm', Array.from({ length: 60 }, (_, i) => pad(i)))}${col('wa', ['AM', 'PM'])}</div>
      <button class="cta" id="save">OK</button>`,
    mount(el, L) {
      const setup = (id, idx, cb) => {
        const c = $('#' + id, el); let raf;
        const sync = () => {
          const i = Math.max(0, Math.min(c.children.length - 1, Math.round(c.scrollTop / 96)));
          [...c.children].forEach((x, j) => x.classList.toggle('sel', j === i));
          if (cb(i)) vib(4);
        };
        setTimeout(() => { c.scrollTop = idx * 96; sync(); }, 380);
        c.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); });
        [...c.children].forEach((x, j) => x.onclick = () => c.scrollTo({ top: j * 96, behavior: 'smooth' }));
      };
      let lastH = hr, lastM = mn, lastA = ap;
      setup('wh', hr - 1, i => { const ch = lastH !== i + 1; hr = i + 1; lastH = hr; return ch; });
      setup('wm', mn, i => { const ch = lastM !== i; mn = i; lastM = i; return ch; });
      setup('wa', ap, i => { const ch = lastA !== i; ap = i; lastA = i; return ch; });
      $('#save', el).onclick = () => { onSave({ h: (hr % 12) + (ap ? 12 : 0), m: mn }); closeLayer(L); };
    }
  });
}

/* ---------- Add Habit ---------- */
function openAddHabit() {
  let icon = 'water', target = 1, useWin = false;
  const days = new Set([0, 1, 2, 3, 4, 5, 6]);
  const n0 = new Date(); n0.setMinutes(0, 0, 0); n0.setHours(n0.getHours() + 1);
  const win = { from: { h: n0.getHours(), m: 0 }, to: { h: (n0.getHours() + 1) % 24, m: 0 } };
  openSheet({
    title: 'New Habit',
    body: `<div class="lbl">Habit name</div>
      <div class="field"><input id="hn" maxlength="28" placeholder="e.g. Drink Water" autocomplete="off"></div>
      <div class="lbl">Choose icon</div>
      <div class="igrid">${PICKER.map((k, i) => `<button class="ig ${i === 0 ? 'sel' : ''}" data-k="${k}"><img src="${ICONS[k]}" alt=""></button>`).join('')}</div>
      <div class="lbl">Daily goal</div>
      <div class="step"><b>Times per day</b><div class="sb"><button class="sbtn" id="m">${SVG.minus}</button><span class="num" id="num">1</span><button class="sbtn pl" id="p">${SVG.plus}</button></div></div>
      <div class="lbl">Time &amp; alarm</div>
      <div class="step"><b>Set time window</b><button class="switch" id="tw" role="switch" aria-checked="false"><i></i></button></div>
      <div class="twin" id="twin">
        <button class="tbox" id="tf"><small>From</small><b></b></button><span class="arr">${SVG.right}</span><button class="tbox" id="tt"><small>To</small><b></b></button>
      </div>
      <div class="dchips" id="dchips">${DAYS.map((d, i) => `<button class="dc sel" data-i="${i}">${d}</button>`).join('')}</div>
      <p class="twnote" id="twnote">An alarm will ring when the time starts, on the selected days.</p>
      <button class="cta" id="save" disabled>Save Habit</button>`,
    mount(el, L) {
      const inp = $('#hn', el), btn = $('#save', el), num = $('#num', el);
      inp.addEventListener('input', () => { btn.disabled = !inp.value.trim(); });
      $$('.ig', el).forEach(b => b.onclick = () => {
        $$('.ig', el).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); icon = b.dataset.k; vib(6);
        if (!inp.value.trim()) { /* keep empty */ }
      });
      const bump = n => { target = Math.max(1, Math.min(12, target + n)); num.textContent = target; num.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 350, easing: 'cubic-bezier(.22,1.18,.36,1)' }); vib(6); };
      $('#m', el).onclick = () => bump(-1); $('#p', el).onclick = () => bump(1);
      const paint = () => { $('#tf b', el).textContent = tstr(win.from); $('#tt b', el).textContent = tstr(win.to); };
      paint();
      $('#tw', el).onclick = e => {
        useWin = !useWin; e.currentTarget.classList.toggle('on', useWin); e.currentTarget.setAttribute('aria-checked', useWin);
        $('#twin', el).classList.toggle('show', useWin); $('#twnote', el).classList.toggle('show', useWin); $('#dchips', el).classList.toggle('show', useWin); vib(8);
        if (useWin) setTimeout(() => { const sb = el.querySelector('.sh-body'); sb.scrollTo({ top: sb.scrollHeight, behavior: 'smooth' }); }, 120);
      };
      $$('.dc', el).forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (days.has(i)) { if (days.size === 1) return; days.delete(i); } else days.add(i);   // keep at least one day
        b.classList.toggle('sel', days.has(i)); vib(6);
      });
      $('#tf', el).onclick = () => openTimeSheet('Start time', win.from, t => { win.from = t; paint(); });
      $('#tt', el).onclick = () => openTimeSheet('End time', win.to, t => { win.to = t; paint(); });
      btn.onclick = () => { addHabit(inp.value, icon, target, useWin ? { from: { ...win.from }, to: { ...win.to } } : null, [...days].sort()); closeLayer(L); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !btn.disabled) btn.click(); });
    }
  });
}

/* ---------- Set Alarm (wheel picker) ---------- */
function openAlarmSheet(existing) {
  const cur = existing ? { ...existing } : { h: 7, m: 0, rep: 'daily' };
  let hr = cur.h % 12 || 12, mn = cur.m, ap = cur.h >= 12 ? 1 : 0, rep = cur.rep;
  const col = (id, items) => `<div class="col" id="${id}">${items.map((t, i) => `<div data-i="${i}">${t}</div>`).join('')}</div>`;
  openSheet({
    title: existing ? 'Edit Alarm' : 'Set Alarm',
    body: `<div class="wheel">${col('wh', Array.from({ length: 12 }, (_, i) => i + 1))}<span class="colon">:</span>${col('wm', Array.from({ length: 60 }, (_, i) => pad(i)))}${col('wa', ['AM', 'PM'])}</div>
      <div class="lbl">Repeat</div>
      <div class="chips">${Object.keys(REP).map(k => `<button class="chip ${k === rep ? 'sel' : ''}" data-k="${k}">${REP[k]}</button>`).join('')}</div>
      <button class="cta" id="save">${existing ? 'Save Alarm' : 'Set Alarm'}</button>`,
    mount(el, L) {
      const setup = (id, idx, cb) => {
        const c = $('#' + id, el); let raf;
        const sync = () => {
          const i = Math.max(0, Math.min(c.children.length - 1, Math.round(c.scrollTop / 96)));
          [...c.children].forEach((x, j) => x.classList.toggle('sel', j === i));
          if (cb(i)) vib(4);
        };
        setTimeout(() => { c.scrollTop = idx * 96; sync(); }, 380);
        c.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); });
        [...c.children].forEach((x, j) => x.onclick = () => c.scrollTo({ top: j * 96, behavior: 'smooth' }));
      };
      let lastH = hr, lastM = mn, lastA = ap;
      setup('wh', hr - 1, i => { const ch = lastH !== i + 1; hr = i + 1; lastH = hr; return ch; });
      setup('wm', mn, i => { const ch = lastM !== i; mn = i; lastM = i; return ch; });
      setup('wa', ap, i => { const ch = lastA !== i; ap = i; lastA = i; return ch; });
      $$('.chip', el).forEach(c => c.onclick = () => { $$('.chip', el).forEach(x => x.classList.remove('sel')); c.classList.add('sel'); rep = c.dataset.k; vib(6); });
      $('#save', el).onclick = () => {
        const h24 = (hr % 12) + (ap ? 12 : 0);
        const data = { h: h24, m: mn, rep }; if (existing) data.id = existing.id;
        addOrUpdateAlarm(data);
        const a = { h: h24, m: mn, rep }, f = fmt(a), d = nextFire(a);
        toast(`Alarm ${f.t} ${f.ap} · rings in ${d ? untilText(d) : '—'}`);
        closeLayer(L);
      };
    }
  });
}

/* ---------- Habit detail ---------- */
function openDetail(id) {
  const h = state.habits.find(x => x.id === id); if (!h) return;
  openSheet({
    title: 'Habit',
    body: `<div class="det"><div class="big"><img src="${ICONS[h.icon]}" alt=""></div><h3>${esc(h.name)}</h3><div class="sub" id="dsub"></div>
      <div class="pbar"><i id="dbar"></i></div>
      <div class="step"><b>Today</b><div class="sb"><button class="sbtn" id="dm">${SVG.minus}</button><span class="num" id="dn">0</span><button class="sbtn pl" id="dp">${SVG.plus}</button></div></div></div>
      <button class="cta danger" id="ddel">Delete habit</button>`,
    mount(el, L) {
      const up = (anim) => {
        const c = Math.min(count(h.id), h.target);
        $('#dn', el).textContent = c;
        $('#dsub', el).textContent = c >= h.target ? 'Completed today ✓' : `${c} / ${h.target} times today`;
        $('#dbar', el).style.width = (h.target ? c / h.target * 100 : 0) + '%';
        if (anim) { const n = $('#dn', el); n.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 350, easing: 'cubic-bezier(.22,1.18,.36,1)' }); }
      };
      setTimeout(() => up(false), 250);
      $('#dm', el).onclick = () => { setCount(h.id, count(h.id) - 1); up(true); vib(6); };
      $('#dp', el).onclick = () => { setCount(h.id, count(h.id) + 1); up(true); vib(10); if (count(h.id) >= h.target) burst($('#dp', el), 12); };
      $('#ddel', el).onclick = () => confirmPop({ img: h.icon, title: 'Delete this habit?', text: `“${esc(h.name)}” and its history will be removed.`, ok: 'Delete', danger: true, onOk: () => { closeLayer(L); deleteHabit(h.id); } });
    }
  });
}

/* ---------- Statistics ---------- */
function openStats() {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const rates = days.map(d => dayStat(keyOf(d)));
  const { cur, best } = streaks();
  const avg = Math.round(rates.reduce((s, r) => s + r.rate, 0) / 7 * 100);
  openSheet({
    title: 'Statistics',
    body: `<div class="bigstats"><div class="bs"><b>${cur}</b><span>Day streak</span></div><div class="bs"><b>${best}</b><span>Best streak</span></div><div class="bs"><b>${avg}%</b><span>7-day avg</span></div></div>
      <div class="lbl">Last 7 days</div>
      <div class="chart">${days.map((d, i) => `<div class="bcol ${i === 6 ? 'today' : ''}" style="--i:${i}"><em>${rates[i].done}/${rates[i].total}</em><div class="tr"><div class="b ${rates[i].done ? '' : 'zero'}" data-h="${Math.round(rates[i].rate * 100)}"></div></div><span>${DAYS[(d.getDay() + 6) % 7]}</span></div>`).join('')}</div>`,
    mount(el) {
      setTimeout(() => $$('.b', el).forEach(b => { b.style.height = `calc(${b.dataset.h}% + 0px)`; if (+b.dataset.h === 0) b.style.height = '10px'; }), 420);
    }
  });
}

/* ---------- Calendar ---------- */
function openCalendar() {
  let view = new Date(); view.setDate(1);
  openSheet({
    title: 'Calendar',
    body: `<div class="cal-h"><button id="cp" aria-label="Previous">${SVG.left}</button><b id="cm"></b><button id="cn" aria-label="Next">${SVG.right}</button></div>
      <div class="cal-w">${DAYS.map(d => `<span>${d[0]}</span>`).join('')}</div><div class="cal-g" id="cg"></div>
      <div class="legend"><span><i style="background:var(--grad)"></i>All done</span><span><i style="background:rgba(255,138,31,.3);border:2px solid rgba(255,138,31,.6)"></i>Partial</span></div>`,
    mount(el) {
      const draw = () => {
        $('#cm', el).textContent = `${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
        const first = new Date(view), off = (first.getDay() + 6) % 7, dim = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
        const today = startOfDay(new Date());
        let h = '';
        for (let i = 0; i < off; i++) h += '<div class="cd empty"></div>';
        for (let d = 1; d <= dim; d++) {
          const dt = new Date(view.getFullYear(), view.getMonth(), d), k = keyOf(dt), st = dayStat(k), fut = dt > today;
          const cls = fut ? 'fut' : st.total && st.rate >= 1 ? 'full' : st.done > 0 ? 'part' : '';
          h += `<button class="cd ${cls} ${+dt === +today ? 'today' : ''}" data-k="${k}" style="--i:${off + d}">${d}</button>`;
        }
        $('#cg', el).innerHTML = h;
      };
      draw();
      $('#cg', el).addEventListener('click', e => {
        const b = e.target.closest('.cd[data-k]'); if (!b) return;
        const st = dayStat(b.dataset.k), d = new Date(b.dataset.k + 'T00:00:00');
        toast(`${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()} · ${st.done}/${st.total} habits`);
      });
      const go = n => { view = new Date(view.getFullYear(), view.getMonth() + n, 1); draw(); vib(6); };
      $('#cp', el).onclick = () => go(-1); $('#cn', el).onclick = () => go(1);
    }
  });
}

/* ---------- Search ---------- */
function openSearch() {
  openSheet({
    title: 'Search',
    body: `<div class="field"><input id="sq" placeholder="Search habits…" autocomplete="off"></div><div class="sresults" id="sr"></div>`,
    mount(el, L) {
      const draw = () => {
        const q = $('#sq', el).value.trim().toLowerCase();
        const res = state.habits.filter(h => h.name.toLowerCase().includes(q));
        $('#sr', el).innerHTML = res.length ? res.map((h, i) => `<button class="sres" data-id="${h.id}" style="--i:${i}"><img src="${ICONS[h.icon]}" alt=""><div><b>${esc(h.name)}</b><small>${Math.min(count(h.id), h.target)} / ${h.target} times today</small></div></button>`).join('') : `<div class="hempty">No habits match “${esc(q)}”.</div>`;
      };
      draw();
      $('#sq', el).addEventListener('input', draw);
      $('#sr', el).addEventListener('click', e => { const b = e.target.closest('.sres'); if (!b) return; closeLayer(L); setTimeout(() => openDetail(b.dataset.id), 250); });
      if (!native) setTimeout(() => $('#sq', el).focus(), 600);
    }
  });
}

/* ---------- Settings ---------- */
function openSettings() {
  openSheet({
    title: 'Settings',
    body: `<div class="lbl">Your name</div><div class="field"><input id="sn" maxlength="20" value="${esc(state.name)}" placeholder="Your name" autocomplete="off"></div>
      <div class="lbl">Alarm</div>
      <div class="step"><b>Alarm sound</b><button class="switch ${state.sound ? 'on' : ''}" id="ss"><i></i></button></div>
      <button class="cta danger" id="rs" style="margin-top:34px">Reset all data</button>`,
    mount(el, L) {
      $('#sn', el).addEventListener('input', e => { state.name = e.target.value.trim() || 'You'; save(); renderProfile(); });
      $('#ss', el).onclick = e => { state.sound = !state.sound; e.currentTarget.classList.toggle('on', state.sound); save(); renderProfile(); vib(8); };
      $('#rs', el).onclick = askReset;
    }
  });
}
function askReset() {
  confirmPop({ img: 'sleep', title: 'Reset everything?', text: 'All habits, alarms and history will be cleared and the app starts fresh.', ok: 'Reset', danger: true, onOk: () => {
    while (stack.length) closeLayer(stack[stack.length - 1]);
    state = freshState(false); save(); renderLists(); renderAll(); renderAlarmList(); scheduleNative(); toast('All data reset');
  } });
}

/* =====================================================================
   ALARM RINGING
   ===================================================================== */
let actx, soundT, ringing = false;
function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.state === 'suspended' && actx.resume(); } catch (e) {} }
['pointerdown', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, unlockAudio, { once: true, passive: true }));
function beep(t0, f, dur) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.35, t0 + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
  o.start(t0); o.stop(t0 + dur + .02);
}
function startSound() {
  if (!state.sound) return; unlockAudio(); if (!actx) return;
  const play = () => { const t = actx.currentTime; [880, 1175, 880, 1175].forEach((f, i) => beep(t + i * .16, f, .13)); vib([200, 100, 200]); };
  play(); soundT = setInterval(play, 1300);
}
function stopSound() { clearInterval(soundT); soundT = null; }

function ring(a, hb) {
  if (ringing) return; ringing = true;
  const f = fmt(a);
  startSound();
  const end = () => { ringing = false; stopSound(); };
  const snooze = () => {
    end(); const d = new Date(Date.now() + 5 * 60000);
    const data = { h: d.getHours(), m: d.getMinutes(), rep: 'once', label: hb ? hb.name : 'Snoozed alarm' };
    if (hb) data.habit = hb.id;
    addOrUpdateAlarm(data);
    toast('Snoozed for 5 minutes');
  };
  const buttons = hb ? [
    { label: 'Snooze 5m', cls: 'ghost', onClick: snooze },
    { label: 'Done ✓', onClick: () => { end(); if (count(hb.id) < hb.target) setCount(hb.id, count(hb.id) + 1); toast(`“${hb.name}” checked in 🧡`); } },
    { label: 'Later', cls: 'ghost', onClick: end }
  ] : [
    { label: 'Snooze 5m', cls: 'ghost', onClick: snooze },
    { label: 'I’m up!', onClick: () => { end(); toast('Good morning! 🧡'); } }
  ];
  openPopup({
    img: hb ? hb.icon : 'wake', title: hb ? hb.name : (a.label || 'Time to wake up!'), bigtime: `${f.t}<small>${f.ap}</small>`,
    text: hb ? (winText(hb) ? `Time to start! Today’s window: ${winText(hb)}` : 'Time to start!') : 'Rise and shine — a new day, a new routine.',
    ringing: true, lock: true, buttons
  });
  $('#aclock').classList.add('ring-on');
}
function tickAlarms() {
  const now = new Date();
  state.alarms.forEach(a => {
    if (!a.on || a.h !== now.getHours() || a.m !== now.getMinutes() || !repMatch(a, now)) return;
    const k = `${keyOf(now)}-${a.id}-${a.h}:${a.m}`;
    if (state.lastRing[a.id] === k) return;
    state.lastRing = { ...state.lastRing, [a.id]: k };
    if (a.rep === 'once') { a.on = false; if (a.label) state.alarms = state.alarms.filter(x => x.id !== a.id); }
    save(); renderAlarmCard(); renderAlarmList();
    const hb = a.habit && state.habits.find(x => x.id === a.habit);
    if (a.habit && !hb) return;              // habit was deleted meanwhile
    if (hb && isDone(hb, keyOf(now))) return; // already done — no need to ring
    ring(a, hb);
  });
  // habit time windows: ring once a day when the start time arrives
  state.habits.forEach(h => {
    if (!h.from || h.from.h !== now.getHours() || h.from.m !== now.getMinutes()) return;
    if (!habitDays(h).includes(dayIdx(now))) return;
    const k = `${keyOf(now)}-hab-${h.id}-${h.from.h}:${h.from.m}`;
    if (state.lastRing['hab-' + h.id] === k) return;
    state.lastRing = { ...state.lastRing, ['hab-' + h.id]: k };
    save();
    if (isDone(h, keyOf(now))) return;
    ring({ h: h.from.h, m: h.from.m }, h);
  });
}
setInterval(tickAlarms, 1000);

/* optional: native local notifications (needs @capacitor/local-notifications) */
async function scheduleNative() {
  const LN = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
  if (!LN) return;
  try {
    await LN.requestPermissions();
    const pend = await LN.getPending();
    if (pend.notifications && pend.notifications.length) await LN.cancel(pend);
    const list = []; let id = 1;
    const base = { title: 'My Routine', body: 'Time to wake up!', allowWhileIdle: true };
    state.alarms.filter(a => a.on).forEach(a => {
      if (a.rep === 'daily') list.push({ ...base, id: id++, schedule: { on: { hour: a.h, minute: a.m }, allowWhileIdle: true } });
      else if (a.rep === 'weekdays') [2, 3, 4, 5, 6].forEach(w => list.push({ ...base, id: id++, schedule: { on: { weekday: w, hour: a.h, minute: a.m }, allowWhileIdle: true } }));
      else if (a.rep === 'weekends') [1, 7].forEach(w => list.push({ ...base, id: id++, schedule: { on: { weekday: w, hour: a.h, minute: a.m }, allowWhileIdle: true } }));
      else { const d = nextFire(a); if (d) list.push({ ...base, id: id++, schedule: { at: d, allowWhileIdle: true } }); }
    });
    state.habits.filter(h => h.from).forEach(h => {
      const dd = habitDays(h);
      const sched = w => ({ on: { ...(w ? { weekday: w } : {}), hour: h.from.h, minute: h.from.m }, allowWhileIdle: true });
      if (dd.length === 7) list.push({ id: id++, title: h.name, body: `Time to start! ${winText(h)}`, allowWhileIdle: true, schedule: sched() });
      else dd.forEach(i => list.push({ id: id++, title: h.name, body: `Time to start! ${winText(h)}`, allowWhileIdle: true, schedule: sched((i + 1) % 7 + 1) }));
    });
    if (list.length) await LN.schedule({ notifications: list });
  } catch (e) { /* plugin not installed — in-app alarms still work */ }
}

/* =====================================================================
   NAVIGATION + EVENTS
   ===================================================================== */
const ORDER = ['home', 'habits', 'alarm', 'profile'];
let current = 'home';
function go(name) {
  if (name === current) { const sc = $(`#screen-${name} .scroll`); sc && sc.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  current = name;
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === name));
  $('#navPill').style.transform = `translateX(${ORDER.indexOf(name) * 219.5}px)`;
  $$('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === name));
  vib(5);
  if (name === 'home') {
    const s = $('#screen-home'); s.classList.add('replay'); void s.offsetWidth;
    renderAll({ animate: true }); renderLists(); setTimeout(() => s.classList.remove('replay'), 30);
  }
  if (name === 'alarm') renderAlarmList();
  if (name === 'profile') renderProfile();
  if (name === 'habits') { $$('#allHabits .hr').forEach((r, i) => { r.style.setProperty('--i', i); r.classList.add('nodelay'); }); }
}
$('#nav').addEventListener('click', e => { const b = e.target.closest('button[data-go]'); if (b) go(b.dataset.go); });
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]:not(#nav button)'); if (g) { go(g.dataset.go); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  ({ add: openAddHabit, alarm: () => openAlarmSheet(), stats: openStats, calendar: openCalendar })[a.dataset.act]();
});
$('#progressCard').addEventListener('click', () => openStats());
$('#btnSearch').onclick = openSearch;
$('#btnSettings').onclick = openSettings;
$('#pfName2').onclick = openSettings;
$('#pfSound').onclick = () => { state.sound = !state.sound; save(); renderProfile(); vib(8); };
$('#pfReset').onclick = askReset;

/* edit mode */
let editing = false;
$('#btnEdit').onclick = () => {
  editing = !editing;
  $('#homeHabits').classList.toggle('editing', editing);
  $('#btnEdit').firstChild.textContent = editing ? 'Done ' : 'Edit ';
  vib(6);
};

/* habit lists (delegated) */
function onListClick(e) {
  const row = e.target.closest('.hr'); if (!row) return;
  const id = row.dataset.id;
  if (e.target.closest('.del')) {
    const h = state.habits.find(x => x.id === id);
    return confirmPop({ img: h.icon, title: 'Delete this habit?', text: `“${esc(h.name)}” and its history will be removed.`, ok: 'Delete', danger: true, onOk: () => deleteHabit(id) });
  }
  if (e.target.closest('.chk')) return toggleHabit(id, e.target.closest('.chk'));
  if (!editing || row.closest('#allHabits')) openDetail(id);
}
$('#homeHabits').addEventListener('click', onListClick);
$('#allHabits').addEventListener('click', onListClick);

/* alarms */
$('#aSwitch').onclick = () => {
  const a = shownAlarm();
  if (!a) return openAlarmSheet();
  a.on = !a.on; save(); renderAlarmCard(); renderAlarmList(); scheduleNative(); vib(10);
  toast(a.on ? `Alarm on · rings in ${untilText(nextFire(a))}` : 'Alarm off');
};
$('#alarmList').addEventListener('click', e => {
  const row = e.target.closest('.arow'); if (!row) return;
  const a = state.alarms.find(x => x.id === row.dataset.id); if (!a) return;
  if (e.target.closest('.xdel')) {
    row.classList.add('gone');
    setTimeout(() => { state.alarms = state.alarms.filter(x => x.id !== a.id); save(); renderAlarmList(); renderAlarmCard(); scheduleNative(); }, 480);
  } else if (e.target.closest('.switch')) {
    a.on = !a.on; save(); e.target.closest('.switch').classList.toggle('on', a.on); row.classList.toggle('off', !a.on); renderAlarmCard(); scheduleNative(); vib(10);
  } else openAlarmSheet(a);
});

/* cat */
function squishCat(hearts) {
  const cat = $('#cat'); cat.classList.remove('squish'); void cat.offsetWidth; cat.classList.add('squish');
  setTimeout(() => cat.classList.remove('squish'), 700);
  if (hearts) for (let i = 0; i < 3; i++) {
    const h = document.createElement('span'); h.className = 'floaty'; h.textContent = '🧡';
    h.style.left = (120 + i * 90 + Math.random() * 30) + 'px'; h.style.top = '20px'; h.style.animationDelay = (i * 120) + 'ms';
    $('#catWrap').appendChild(h); setTimeout(() => h.remove(), 1600);
  }
}
$('#catWrap').addEventListener('click', () => { squishCat(true); vib(12); });

/* android back button + new-day refresh */
try {
  const AppPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  AppPlugin && AppPlugin.addListener('backButton', () => {
    if (closeTop()) return;
    if (current !== 'home') return go('home');
    AppPlugin.exitApp();
  });
} catch (e) {}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderAll(); renderLists(); renderAlarmCard(); } });

/* =====================================================================
   BOOT
   ===================================================================== */
function boot() {
  state = load();
  if (!state.lastRing) state.lastRing = {};
  layout();
  renderLists(); renderAlarmList(); renderAlarmCard(); renderGreeting(); renderProfile();
  // ring starts empty, then sweeps to the real value once the card has revealed
  $('#ringBar').style.strokeDashoffset = 477.5;
  $('#cntDone').textContent = '0'; $('#pct').textContent = '0%';
  renderWeek(true);
  app.classList.remove('booting');
  setTimeout(() => { renderProgress(); }, 650);
  setTimeout(() => { settledRows = true; $$('.hr').forEach(r => r.classList.add('nodelay')); }, 2400);
  scheduleNative();
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen) window.Capacitor.Plugins.SplashScreen.hide();
}
const ready = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 700))]) : Promise.resolve();
ready.then(() => {
  const imgs = ['cat', 'appicon', 'alarm', 'water', 'dumbbell', 'walk'].map(n => new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = `assets/${n}.webp`; }));
  Promise.race([Promise.all(imgs), new Promise(r => setTimeout(r, 900))]).then(boot);
});
layout();
})();
