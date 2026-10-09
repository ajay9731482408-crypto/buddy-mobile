/* Buddy Mobile: screens, voice, themes, effects and cloud sync. Pure rules live in logic.js; cloud in cloud.js;
   voice in voice.js; effects in vfx.js; icons in icons.js. Device preferences stay on this phone. */
(function () {
  'use strict';
  const L = BuddyLogic, P = BuddyPlus, C = BuddyCloud, V = BuddyVoice, FX = BuddyVFX;
  const LOCAL_KEY = 'buddy-mobile-state', PREF_KEY = 'buddy-mobile-prefs', CFG_KEY = 'buddy-mobile-cloud', TOKEN_KEY = 'buddy-mobile-token', HOLD_KEY = 'buddy-mobile-sync-hold';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => new Date().toISOString();

  let state = null, prefs = null, cfg = { mode: 'worker', workerUrl: '', accountId: '', namespaceId: '', remember: false, token: '' };
  let cloudOk = false, pushTimer = 0, recog = null, stopFx = null, currentView = 'home';

  /* ---------- preferences (this phone only) ---------- */
  const DEFAULT_PREFS = { voiceOut: true, voiceIn: true, theme: 'night', fx: true, calm: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), sfx: true, rate: 0.98, voiceName: '' };
  function loadPrefs() { try { return Object.assign({}, DEFAULT_PREFS, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { return Object.assign({}, DEFAULT_PREFS); } }
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { } }

  /* ---------- state ---------- */
  function loadLocal() { try { const s = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); if (s) return P.migrate(s); } catch (e) { } return P.migrate(L.emptyState()); }
  function saveLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); }
    catch (e) { toast('This phone is out of storage space. Export a copy, then clear some data.', true); }
    scheduleCloudPush();
  }
  function run(text) { const r = P.handleAll(state, text, Date.now()); state = r.state; saveLocal(); feedback(r); return r; }
  function feedback(r) {
    if (r.mood === 'excited' && prefs.sfx) { beep(); buzz(12); }
  }

  /* ---------- toast ---------- */
  function toast(msg, err) {
    const t = $('toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' err' : '');
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = 'toast'; }, 2800);
  }
  function status(text, cls) { const el = $('status'); el.textContent = text; el.className = 'pill' + (cls ? ' ' + cls : ''); }

  /* Vibration: browsers only allow it after the user has tapped something, so check first */
  function buzz(pattern) {
    try {
      const active = navigator.userActivation && navigator.userActivation.hasBeenActive;
      if (active && navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) { }
  }

  /* ---------- sound (a tiny generated tone; no audio files) ---------- */
  let audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 660; g.gain.value = 0.035;
      o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.14);
    } catch (e) { }
  }

  /* ---------- views ---------- */
  function showView(name) {
    currentView = name;
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === 'v-' + name));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.view === name));
    $('main').scrollTop = 0;
    renderCurrent();
  }
  function renderCurrent() {
    if (currentView === 'home') renderHome();
    if (currentView === 'tasks') { renderTasks(); renderReminders(); }
    if (currentView === 'goals') renderGoals();
    if (currentView === 'lists') renderLists();
    if (currentView === 'health') { renderHealth(); renderHabits(); }
    if (currentView === 'more') { renderMore(); renderSkills(); }
  }

  /* ---------- home ---------- */
  function renderHome() {
    const s = L.summary(state, now()), h = new Date().getHours();
    $('greet').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    $('today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const cells = [[s.openTasks, 'open tasks'], [s.goalsOpen, 'goals in progress'], [Math.round(s.waterMl / 250), 'glasses today'], [s.mood || '–', 'last mood']];
    $('stats').innerHTML = cells.map(([v, l]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
    $('micBtn').hidden = !prefs.voiceIn;
    $('voiceHint').textContent = V.support().listen ? 'Tap the mic and speak. Buddy answers in words too.' : 'Voice input is not supported in this browser. Type instead.';
  }
  function addMsg(who, text) {
    const d = document.createElement('div'); d.className = 'msg ' + who; d.textContent = text;
    const chat = $('chat'); chat.appendChild(d);
    while (chat.children.length > 120) chat.removeChild(chat.firstChild);   // keep the screen light on long days
    chat.scrollTop = chat.scrollHeight;
  }
  function ask(text) {
    const v = String(text || '').trim(); if (!v) return;
    addMsg('u', v);
    const big = $('bigOrb'); big.classList.add('think');
    setTimeout(() => {
      const r = run(v);
      big.classList.remove('think');
      addMsg('b', r.reply);
      if (prefs.voiceOut) V.speak(r.reply, { rate: prefs.rate, voiceName: prefs.voiceName });
      renderHome();
    }, 180);
  }
  function renderChatIntro() {
    if ($('chat').dataset.started) return;
    $('chat').dataset.started = '1';
    addMsg('b', 'Hi, I am Buddy. Tap the mic and talk to me, or type. Say "good morning" for your day.');
  }
  function renderQuick() {
    $('quick').innerHTML = ['good morning', 'what now', 'tasks', 'goals', 'water', 'weekly review', 'help'].map((c) => `<button class="chip" data-cmd="${esc(c)}">${esc(c)}</button>`).join('');
  }

  /* ---------- voice input ---------- */
  function toggleMic() {
    if (!V.support().listen) { toast('Voice input needs Chrome, Edge or Safari on a phone. You can type instead.', true); return; }
    if (recog) { try { recog.abort(); } catch (e) { } recog = null; setMic(false); return; }
    setMic(true);
    recog = V.listen({
      lang: 'en-GB',
      onText: (t) => { ask(t); },
      onError: (code) => {
        setMic(false); recog = null;
        if (code === 'aborted') return;                      // we stopped it ourselves
        const msg = code === 'not-allowed' ? 'Microphone permission is off. Allow it in your browser settings for this site.'
          : code === 'no-speech' ? 'I did not hear anything. Tap the mic and try again.'
          : code === 'network' ? 'Speech needs a connection in this browser. Try again, or type.'
          : 'Voice did not work this time. You can type instead.';
        toast(msg, true);
      },
      onEnd: () => { setMic(false); recog = null; },
    });
  }
  function setMic(on) { const b = $('micBtn'); b.classList.toggle('live', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }

  /* ---------- tasks ---------- */
  function renderTasks() {
    const s = L.summary(state, now());
    const open = state.tasks.filter((x) => !x.done);
    $('taskList').innerHTML = open.length ? open.map((x) =>
      `<li class="item"><button class="check" data-done="${x.id}" aria-label="Mark done: ${esc(x.text)}"></button><span class="t">${esc(x.text)}</span></li>`).join('')
      : '<li class="muted">No open tasks. Add one above.</li>';
    $('taskBar').style.width = s.completion + '%';
    $('taskPct').textContent = `${s.completion}% of all tasks done`;
  }
  /* ---------- reminders, habits, skills ---------- */
  function renderReminders() {
    const open = state.reminders.filter((r) => !r.done).sort((x, y) => x.at - y.at);
    $('remList').innerHTML = open.length ? open.map((r) => {
      const when = new Date(r.at);
      return `<li class="item"><button class="check" data-rdone="${r.id}" aria-label="Done: ${esc(r.text)}"></button><span class="t">${esc(r.text)}<div class="muted">${esc(when.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }))}</div></span></li>`;
    }).join('') : '<li class="muted">No reminders. Try "remind me in 30 minutes to stretch".</li>';
  }
  function renderHabits() {
    $('habitList').innerHTML = state.habits.length ? state.habits.map((h) => {
      const n = P.streak(h, Date.now());
      return `<li class="item"><button class="btn" data-did="${h.id}" aria-label="I did ${esc(h.name)} today">Did it</button><span class="t">${esc(h.name)}<div class="muted">${n} day${n === 1 ? '' : 's'} in a row</div></span></li>`;
    }).join('') : '<li class="muted">No habits yet. Add one, for example "study 30 minutes".</li>';
  }
  function renderSkills() {
    $('skillList').innerHTML = P.skills(state).map((k) =>
      `<li class="item"><span class="t">${esc(k.name)}<div class="bar"><i style="width:${k.pct}%"></i></div><div class="muted">Level ${k.level} · ${k.pct}% to level ${k.level + 1}</div></span></li>`).join('');
  }
  /* ---------- goals ---------- */
  function renderGoals() {
    const goals = state.goals.slice().sort((a, b) => Number(a.done) - Number(b.done) || b.id - a.id);
    $('goalList').innerHTML = goals.length ? goals.map((g) => {
      const pct = Math.round((g.progress / g.target) * 100);
      return `<li class="item ${g.done ? 'done' : ''}" style="flex-wrap:wrap">
        <div class="t"><b>${esc(g.title)}</b><div class="muted">${g.progress} of ${g.target} steps</div>
        <div class="bar"><i style="width:${pct}%"></i></div></div>
        ${g.done ? '<span class="muted">Reached</span>' : `<button class="btn" data-step="${g.id}" aria-label="Add a step to ${esc(g.title)}">+ step</button>`}
      </li>`;
    }).join('') : '<li class="muted">No goals yet. Start one above. Buddy keeps count of your steps.</li>';
  }
  /* ---------- lists ---------- */
  function renderLists() {
    const shop = state.shopping.filter((x) => !x.done);
    $('shopList').innerHTML = shop.length ? shop.map((x) =>
      `<li class="item"><button class="check" data-buy="${x.id}" aria-label="Bought ${esc(x.text)}"></button><span class="t">${esc(x.text)}</span></li>`).join('')
      : '<li class="muted">Nothing to buy.</li>';
    $('noteList').innerHTML = state.notes.length ? state.notes.slice().reverse().map((x) =>
      `<li class="item"><span class="t">${esc(x.text)}</span></li>`).join('') : '<li class="muted">No notes yet.</li>';
  }
  /* ---------- health ---------- */
  function renderHealth() {
    const s = L.summary(state, now());
    $('waterBar').style.width = Math.min(100, Math.round((s.waterMl / s.waterGoalMl) * 100)) + '%';
    $('waterText').textContent = `${s.waterMl} of ${s.waterGoalMl} ml`;
    if (!$('moods').childElementCount) {
      ['great', 'good', 'fine', 'meh', 'tired', 'awful'].forEach((w) => {
        const b = document.createElement('button'); b.className = 'btn'; b.textContent = w; b.dataset.mood = w; $('moods').appendChild(b);
      });
    }
    $('moodNote').textContent = s.mood ? `Last check-in: ${s.mood}` : 'Tap how you feel. It stays on your phone.';
  }

  /* ---------- settings ---------- */
  function applyPrefs() {
    document.documentElement.setAttribute('data-theme', prefs.theme);
    document.documentElement.classList.toggle('calm', !!prefs.calm);
    document.querySelectorAll('[data-theme-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themePick === prefs.theme)));
    // restart the effect so its colour follows the theme
    if (stopFx) { stopFx(); stopFx = null; }
    if (prefs.fx && !prefs.calm && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      stopFx = FX.start($('fx'), { color: getComputedStyle(document.documentElement).getPropertyValue('--c1').trim() || '#0EA5A4' });
    }
  }
  function setSwitch(id, on) { const el = $(id); if (el) el.setAttribute('aria-checked', on ? 'true' : 'false'); }
  function renderMore() {
    setSwitch('swVoiceOut', prefs.voiceOut); setSwitch('swVoiceIn', prefs.voiceIn); setSwitch('swFx', prefs.fx);
    setSwitch('swCalm', prefs.calm); setSwitch('swSfx', prefs.sfx); setSwitch('cfRemember', cfg.remember);
    $('rateRange').value = prefs.rate;
    const sup = V.support();
    $('voiceSupport').textContent = `Voice input: ${sup.listen ? 'available' : 'not in this browser'}. Voice output: ${sup.speak ? 'available' : 'not in this browser'}.`;
    fillVoices();
    fillCfg();
  }
  function fillVoices() {
    const sel = $('voiceSel'), list = V.voices().filter((v) => /^en/i.test(v.lang || ''));
    const cur = prefs.voiceName;
    sel.innerHTML = '<option value="">Automatic (best on this phone)</option>' + list.map((v) => `<option value="${esc(v.name)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('');
    sel.value = cur || '';
  }
  function bindSwitch(id, key, after) {
    $(id).addEventListener('click', () => { prefs[key] = !prefs[key]; savePrefs(); setSwitch(id, prefs[key]); applyPrefs(); if (after) after(); });
  }

  /* ---------- cloud (same protocol as before) ---------- */
  function loadCfg() {
    try { cfg = Object.assign(cfg, JSON.parse(localStorage.getItem(CFG_KEY) || '{}')); } catch (e) { }
    cfg.token = (cfg.remember ? localStorage.getItem(TOKEN_KEY) : sessionStorage.getItem(TOKEN_KEY)) || '';
  }
  function saveCfg() { const { mode, workerUrl, accountId, namespaceId, remember } = cfg; localStorage.setItem(CFG_KEY, JSON.stringify({ mode, workerUrl, accountId, namespaceId, remember })); }
  function setToken(t) {
    cfg.token = t;
    localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
    if (t) (cfg.remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t);
  }
  function fillCfg() {
    $('cfMode').value = cfg.mode || 'worker';
    $('cfWorkerUrl').value = cfg.workerUrl || ''; $('cfAccount').value = cfg.accountId || ''; $('cfNamespace').value = cfg.namespaceId || '';
    $('cfToken').value = cfg.token ? '•••••••••••• (saved for this session)' : '';
    applyCfgMode();
  }
  function applyCfgMode() {
    const worker = ($('cfMode').value || 'worker') === 'worker';
    $('cfWorkerFields').hidden = !worker; $('cfApiFields').hidden = worker;
    $('cfTokenLabel').textContent = worker ? 'Sync secret (the SYNC_SECRET you set in the Worker)' : 'Cloudflare API token';
  }
  function readCfgForm() {
    return { mode: $('cfMode').value, workerUrl: $('cfWorkerUrl').value.trim(), accountId: $('cfAccount').value.trim(),
             namespaceId: $('cfNamespace').value.trim(), token: cfg.token || $('cfToken').value.trim(), remember: cfg.remember };
  }
  function isReady(c) { return c.mode === 'worker' ? !!(c.workerUrl && c.token) : !!(c.accountId && c.namespaceId && c.token); }
  function cfgMsg(msg, err) { $('cfResult').textContent = msg; if (err) toast(msg, true); }
  function holding() { return localStorage.getItem(HOLD_KEY) === '1'; }
  function scheduleCloudPush() { if (!cloudOk || holding()) return; clearTimeout(pushTimer); pushTimer = setTimeout(() => pushCloud(true), 4000); }
  /* Both directions use the safe merge: nothing from either phone is lost. */
  async function syncNow(quiet) {
    try {
      status('Syncing…');
      const merged = await C.sync(cfg, state, P.mergeStates);
      state = P.migrate(merged); localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
      renderCurrent(); status('Cloud synced', 'ok');
      if (!quiet) toast('Synced. Nothing from either phone was lost.');
    } catch (e) { status('Cloud error', 'bad'); if (!quiet) cfgMsg(e.message, true); else status('Cloud error', 'bad'); }
  }
  function pushCloud(quiet) { localStorage.removeItem(HOLD_KEY); return syncNow(quiet); }
  function pullCloud() { localStorage.removeItem(HOLD_KEY); return syncNow(false); }

  /* ---------- export and reset ---------- */
  function exportCopy() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'buddy-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Backup file saved to your downloads.');
  }
  function resetAll() {
    if (!confirm('Clear all of Buddy\'s data on this phone? This cannot be undone. Your cloud copy, if any, is not changed.')) return;
    state = P.migrate(L.emptyState()); localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    // stop automatic sync on this phone, so the cloud copy does not come straight back; Save or Load turns it on again
    localStorage.setItem(HOLD_KEY, '1'); clearTimeout(pushTimer);
    $('chat').innerHTML = ''; delete $('chat').dataset.started; renderChatIntro(); renderCurrent(); toast('Cleared on this phone.');
  }

  /* ---------- wiring ---------- */
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
  $('openMore').addEventListener('click', () => showView('more'));
  $('chatForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('chatText').value; $('chatText').value = ''; ask(v); });
  $('quick').addEventListener('click', (e) => { const b = e.target.closest('[data-cmd]'); if (b) ask(b.dataset.cmd); });
  $('micBtn').addEventListener('click', toggleMic);
  $('taskForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('taskText').value.trim(); if (!v) return; const r = run('add task ' + v); $('taskText').value = ''; toast(r.reply); renderTasks(); });
  $('taskList').addEventListener('click', (e) => { const b = e.target.closest('[data-done]'); if (!b) return; const r = run('done ' + b.dataset.done); toast(r.reply); renderTasks(); });
  $('remForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('remText').value.trim(); if (!v) return; const r = run(v); $('remText').value = ''; toast(r.reply); renderReminders(); });
  $('remList').addEventListener('click', (e) => { const b = e.target.closest('[data-rdone]'); if (!b) return; const r = run('done reminder ' + b.dataset.rdone); toast(r.reply); renderReminders(); });
  $('habitForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('habitText').value.trim(); if (!v) return; const r = run('habit ' + v); $('habitText').value = ''; toast(r.reply); renderHabits(); });
  $('habitList').addEventListener('click', (e) => { const b = e.target.closest('[data-did]'); if (!b) return; const h = state.habits.find((x) => String(x.id) === b.dataset.did); if (!h) return; const r = run('did ' + h.name); toast(r.reply); renderHabits(); });
  $('icsBtn').addEventListener('click', () => {
    const blob = new Blob([P.ics(state, Date.now())], { type: 'text/calendar' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'buddy-reminders.ics';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Calendar file saved. Open it to add your reminders.');
  });
  $('shareBtn').addEventListener('click', async () => {
    const r = P.handleAll(state, 'share', Date.now());
    if (navigator.share) { try { await navigator.share({ title: 'Buddy summary', text: r.reply }); return; } catch (e) { return; } }
    window.open(r.share, '_blank', 'noopener');
  });
  $('reviewBtn').addEventListener('click', () => { const r = run('weekly review'); addMsg('b', r.reply); showView('home'); if (prefs.voiceOut) V.speak(r.reply, { rate: prefs.rate, voiceName: prefs.voiceName }); });
  $('goalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('goalTitle').value.trim(), n = Math.max(1, Math.min(999, parseInt($('goalTarget').value, 10) || 10));
    if (!title) { toast('Type what you want to reach first.', true); return; }
    const r = run(`goal ${title} ${n} steps`); $('goalTitle').value = ''; toast(r.reply); renderGoals();
  });
  $('goalList').addEventListener('click', (e) => { const b = e.target.closest('[data-step]'); if (!b) return; const r = run('step ' + b.dataset.step); toast(r.reply, r.mood === 'confused'); renderGoals(); });
  $('shopForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('shopText').value.trim(); if (!v) return; const r = run('add shopping ' + v); $('shopText').value = ''; toast(r.reply); renderLists(); });
  $('shopList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-buy]'); if (!b) return;
    const item = state.shopping.find((x) => String(x.id) === b.dataset.buy);
    if (item) { item.done = true; item.updated = now(); state.updated = now(); saveLocal(); feedback({ mood: 'excited' }); renderLists(); }
  });
  $('noteForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('noteText').value.trim(); if (!v) return; const r = run('note ' + v); $('noteText').value = ''; toast(r.reply); renderLists(); });
  $('drinkBtn').addEventListener('click', () => { const r = run('drank 1 glass'); toast(r.reply); renderHealth(); });
  $('moods').addEventListener('click', (e) => { const b = e.target.closest('[data-mood]'); if (!b) return; const r = run('i feel ' + b.dataset.mood); toast(r.reply, r.mood === 'worried'); renderHealth(); });

  document.querySelectorAll('[data-theme-pick]').forEach((b) => b.addEventListener('click', () => { prefs.theme = b.dataset.themePick; savePrefs(); applyPrefs(); }));
  bindSwitch('swVoiceOut', 'voiceOut');
  bindSwitch('swVoiceIn', 'voiceIn', renderHome);
  bindSwitch('swFx', 'fx');
  bindSwitch('swCalm', 'calm');
  bindSwitch('swSfx', 'sfx');
  $('voiceSel').addEventListener('change', () => { prefs.voiceName = $('voiceSel').value; savePrefs(); });
  $('rateRange').addEventListener('input', () => { prefs.rate = Number($('rateRange').value); savePrefs(); });
  $('testVoice').addEventListener('click', () => {
    const ok = V.speak('Hello. I am Buddy. I can help you with tasks, goals and your day.', { rate: prefs.rate, voiceName: prefs.voiceName });
    if (!ok) toast('This browser cannot speak out loud. Buddy will reply in text.', true);
  });
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { if (currentView === 'more') fillVoices(); };

  $('cfMode').addEventListener('change', applyCfgMode);
  $('cfRemember').addEventListener('click', () => { cfg.remember = !cfg.remember; setSwitch('cfRemember', cfg.remember); });
  $('cfSaveCfg').addEventListener('click', () => {
    const f = readCfgForm(); const typed = $('cfToken').value.trim();
    cfg.mode = f.mode; cfg.workerUrl = f.workerUrl; cfg.accountId = f.accountId; cfg.namespaceId = f.namespaceId;
    if (typed && !typed.startsWith('•')) setToken(typed);
    saveCfg(); cloudOk = isReady(cfg); localStorage.removeItem(HOLD_KEY);
    status(cloudOk ? 'Cloud ready' : 'On this phone', cloudOk ? 'ok' : '');
    cfgMsg(cloudOk ? 'Settings saved. Use Test connection to check them.' : 'Settings saved. Add the token to use cloud storage.');
  });
  $('cfTest').addEventListener('click', async () => {
    try { status('Testing…'); const ok = await C.test(readCfgForm()); cfgMsg(ok ? 'Connected. The cloud answered correctly.' : 'The test did not get the expected answer. Try again.', !ok); status(ok ? 'Cloud ready' : 'Cloud error', ok ? 'ok' : 'bad'); }
    catch (e) { status('Cloud error', 'bad'); cfgMsg(e.message, true); }
  });
  $('cfPush').addEventListener('click', () => pushCloud(false));
  $('cfPull').addEventListener('click', () => pullCloud());
  $('cfForget').addEventListener('click', () => {
    setToken(''); cfg.accountId = ''; cfg.namespaceId = ''; cfg.workerUrl = ''; cfg.remember = false; cloudOk = false;
    localStorage.removeItem(CFG_KEY); fillCfg(); setSwitch('cfRemember', false); status('On this phone');
    cfgMsg('Forgotten on this phone. Your phone copy of your data is kept.');
  });
  $('exportBtn').addEventListener('click', exportCopy);
  $('resetBtn').addEventListener('click', resetAll);

  /* ---------- start ---------- */
  state = loadLocal();
  prefs = loadPrefs();
  loadCfg();
  cloudOk = isReady(cfg);
  status(cloudOk ? 'Cloud ready' : 'On this phone', cloudOk ? 'ok' : '');
  applyPrefs();
  renderQuick(); renderChatIntro(); renderHome();
  if (cloudOk && !holding()) syncNow(true);
  // reminders: check every 30 seconds while the app is open; each one is announced once
  function checkDue() {
    const live = new Set(state.reminders.filter((r) => !r.done).map((r) => r.id));
    const kept = state.notified.filter((id) => live.has(id));
    if (kept.length !== state.notified.length) { state.notified = kept; saveLocal(); }
    const due = P.dueReminders(state, Date.now());
    for (const r of due) {
      state.notified.push(r.id); saveLocal();
      const msg = 'Reminder: ' + r.text;
      toast(msg); addMsg('b', msg);
      if (prefs.sfx) beep(); buzz([40, 60, 40]);
      if (prefs.voiceOut) V.speak(msg, { rate: prefs.rate, voiceName: prefs.voiceName });
    }
  }
  setInterval(checkDue, 30000); checkDue();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && currentView === 'home') renderHome(); });
  // home-screen shortcuts: ?view=tasks opens a screen, ?cmd=good%20morning runs a command
  const qs = new URLSearchParams(location.search);
  if (qs.get('view') && document.getElementById('v-' + qs.get('view'))) showView(qs.get('view'));
  if (qs.get('cmd')) { setTimeout(() => ask(qs.get('cmd')), 300); }
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
