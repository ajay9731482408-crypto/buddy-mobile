/* Buddy notch: a Dynamic-Island-style pill at the top of the screen.
   Pure state logic (reduce) is separate from drawing (mount) so it can be tested in Node.
   States: idle -> work (label + progress) -> alert (reminder with buttons) -> open (quick actions).
   Priority: alert > open > work > idle. Alerts and results auto-return to the previous state. */
(function (root) {
  'use strict';

  var ALERT_MS = 9000, RESULT_MS = 2200;

  /** Pure reducer. Base = what Buddy is doing (idle or working). Overlays = alert, result, open.
   An overlay sits on top of the base; when it ends, the base comes back (including work that arrived meanwhile).
   state: {mode, label, progress, actions, title, tone, until, base:{mode,label,progress}} */
  var OVERLAY = { alert: 1, result: 1, open: 1 };
  function initial() { return { mode: 'idle', label: 'Buddy', progress: null, actions: [], title: '', tone: '', until: 0, base: { mode: 'idle', label: 'Buddy', progress: null } }; }

  function restore(s) {
    s.mode = s.base.mode; s.label = s.base.label; s.progress = s.base.progress; s.until = 0; s.actions = []; s.tone = '';
    return s;
  }
  function setBase(s, b) { s.base = b; if (!OVERLAY[s.mode]) { s.mode = b.mode; s.label = b.label; s.progress = b.progress; } return s; }

  function reduce(s, evt, now) {
    now = now || 0;
    s = Object.assign({}, s, { base: Object.assign({}, s.base), actions: (s.actions || []).slice() });
    if (s.until && now >= s.until && OVERLAY[s.mode]) s = restore(s);       // timers first
    switch (evt && evt.type) {
      case 'work':
        setBase(s, { mode: 'active', label: String(evt.label || 'Working').slice(0, 60),
                     progress: typeof evt.progress === 'number' ? Math.max(0, Math.min(1, evt.progress)) : null });
        break;
      case 'idle':
        setBase(s, { mode: 'idle', label: 'Buddy', progress: null });
        break;
      case 'alert':
        s.mode = 'alert'; s.title = String(evt.title || 'Reminder').slice(0, 80);
        s.actions = (evt.actions || []).slice(0, 2).map(function (a) { return { label: String(a.label).slice(0, 20), id: String(a.id || a.label) }; });
        s.until = now + (evt.ms || ALERT_MS); s.tone = '';
        break;
      case 'result':
        if (s.mode === 'alert') break;                                       // an alert keeps priority
        s.mode = 'result'; s.label = String(evt.label || 'Done').slice(0, 60); s.tone = evt.tone === 'error' ? 'error' : 'ok';
        s.until = now + RESULT_MS; s.actions = []; s.title = '';
        break;
      case 'open':
        if (s.mode === 'alert') break;
        s.mode = 'open';
        s.actions = (evt.actions || [{ label: 'Agenda', id: 'agenda' }, { label: 'Orders', id: 'orders' }]).slice(0, 3)
          .map(function (a) { return { label: String(a.label).slice(0, 20), id: String(a.id || a.label) }; });
        s.until = now + 8000; s.tone = '';
        break;
      case 'close':
        if (s.mode === 'open') s = restore(s);
        break;
      case 'dismiss':
        if (s.mode === 'alert' || s.mode === 'result') s = restore(s);
        break;
      default: break;
    }
    return s;
  }

  /** Draws the pill into a container. Returns {push(evt), state(), destroy()}. */
  function mount(host, opts) {
    opts = opts || {};
    var el = document.createElement('div');
    el.className = 'bnotch'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.dataset.mode = 'idle';
    el.innerHTML = '<div class="bnotch-row"><span class="bnotch-dot"></span><span class="bnotch-text"></span><span class="bnotch-bar"><i></i></span></div>' +
                   '<div class="bnotch-body"><p class="bnotch-title"></p><div class="bnotch-btns"></div></div>';
    host.appendChild(el);
    var text = el.querySelector('.bnotch-text'), title = el.querySelector('.bnotch-title'), btns = el.querySelector('.bnotch-btns'), bar = el.querySelector('.bnotch-bar i');
    var s = initial(), timer = 0, onAction = opts.onAction || function () { };

    function clock() { return Date.now(); }
    function paint() {
      el.dataset.mode = s.mode; el.dataset.tone = s.tone || '';
      text.textContent = s.mode === 'alert' ? s.title : s.label;
      title.textContent = s.mode === 'alert' ? (s.actions.length ? '' : '') : '';
      bar.style.width = s.progress == null ? '0%' : Math.round(s.progress * 100) + '%';
      el.classList.toggle('indeterminate', s.mode === 'active' && s.progress == null);
      btns.innerHTML = '';
      (s.actions || []).forEach(function (a) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = a.label;
        b.addEventListener('click', function (e) { e.stopPropagation(); push({ type: 'dismiss' }); onAction(a.id); });
        btns.appendChild(b);
      });
      schedule();
    }
    function schedule() {
      clearTimeout(timer);
      if (s.until) timer = setTimeout(function () { push({ type: 'tick' }); }, Math.max(0, s.until - clock()));
    }
    function push(evt) { s = reduce(s, evt, clock()); paint(); return s; }
    el.addEventListener('click', function () { if (s.mode === 'alert') { push({ type: 'dismiss' }); return; } push({ type: s.mode === 'open' ? 'close' : 'open' }); });
    el.tabIndex = 0;
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
    paint();
    return {
      push: push,
      state: function () { return s; },
      destroy: function () { clearTimeout(timer); el.remove(); }
    };
  }

  var api = { reduce: reduce, initial: initial, mount: mount, ALERT_MS: ALERT_MS, RESULT_MS: RESULT_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BuddyNotch = api;
})(typeof window !== 'undefined' ? window : globalThis);
