/* Buddy's avatar: an original companion face. Pure behaviour (testable in Node) plus a small SVG renderer.
   It has its own shape and face. It follows the pointer with its eyes, squishes when tapped, gets dizzy after
   repeated taps, blinks, and reacts to what Buddy is doing (listening, thinking, happy, worried, alert). */
(function (root) {
  'use strict';
  const STATES = ['idle', 'listening', 'thinking', 'happy', 'worried', 'alert', 'dizzy', 'squish'];
  const TAP_WINDOW = 3000, DIZZY_TAPS = 5, DIZZY_FOR = 3000, MAX_EYE = 4.5;

  function initial() { return { state: 'idle', taps: [], dizzyUntil: 0 }; }

  /** A tap at time `now` (ms). Five taps within three seconds make Buddy dizzy for three seconds. */
  function tap(s, now) {
    const taps = s.taps.filter((t) => now - t < TAP_WINDOW).concat(now);
    if (taps.length >= DIZZY_TAPS) return { state: 'dizzy', taps: [], dizzyUntil: now + DIZZY_FOR };
    if (s.state === 'dizzy' || s.state === 'listening') return Object.assign({}, s, { taps });
    return { state: 'squish', taps, dizzyUntil: s.dizzyUntil };
  }
  /** Moves a state on when its short moment is over. */
  function settle(s, now) {
    if (s.state === 'dizzy' && now >= s.dizzyUntil) return { state: 'idle', taps: [], dizzyUntil: 0 };
    if (s.state === 'squish') return Object.assign({}, s, { state: 'idle' });
    return s;
  }
  /** Sets a state by name. Unknown names are ignored. */
  function set(s, name) { return STATES.indexOf(name) === -1 ? s : Object.assign({}, s, { state: name }); }
  /** A reply from the chat, using the same mood words the chat uses. */
  function reply(s, mood) {
    if (mood === 'excited' || mood === 'happy') return set(s, 'happy');
    if (mood === 'worried') return set(s, 'worried');
    if (mood === 'confused' || mood === 'curious') return set(s, 'thinking');
    return set(s, 'idle');
  }
  /** Where the pupils sit, in SVG units, for a pointer at (px, py) relative to the face centre (cx, cy). */
  function eyeOffset(px, py, cx, cy) {
    const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
    if (d < 1) return { x: 0, y: 0 };
    const k = Math.min(1, d / 300) * MAX_EYE / d;
    return { x: +(dx * k).toFixed(2), y: +(dy * k).toFixed(2) };
  }

  /* ---- renderer: one SVG, drawn in a 100 x 100 box ---- */
  const MOUTH = {
    idle: 'M38 62 Q50 68 62 62', happy: 'M34 60 Q50 76 66 60', worried: 'M38 68 Q50 60 62 68',
    listening: null, thinking: 'M42 65 H58', alert: 'M40 62 Q50 70 60 62', squish: 'M38 62 Q50 68 62 62',
    dizzy: 'M38 66 Q42 60 46 66 Q50 72 54 66 Q58 60 62 66',
  };
  function svg(state, off) {
    const o = off || { x: 0, y: 0 };
    const mouth = MOUTH[state];
    const eyes = state === 'dizzy'
      ? '<path d="M30 40 l8 8 M38 40 l-8 8 M54 40 l8 8 M62 40 l-8 8" stroke="#05060f" stroke-width="2.6" stroke-linecap="round"/>'
      : `<g class="eyes">` +
        `<ellipse data-bx="36" data-by="42" cx="${36 + o.x}" cy="${42 + o.y}" rx="5.5" ry="${state === 'thinking' ? 3 : 6.5}" fill="#05060f"/>` +
        `<ellipse data-bx="64" data-by="42" cx="${64 + o.x}" cy="${42 + o.y}" rx="5.5" ry="${state === 'thinking' ? 3 : 6.5}" fill="#05060f"/>` +
        `<circle data-bx="38" data-by="39" cx="${38 + o.x}" cy="${39 + o.y}" r="1.8" fill="#fff" opacity=".9"/>` +
        `<circle data-bx="66" data-by="39" cx="${66 + o.x}" cy="${39 + o.y}" r="1.8" fill="#fff" opacity=".9"/></g>`;
    const m = state === 'listening'
      ? '<ellipse cx="50" cy="65" rx="4" ry="4.6" fill="#05060f"/>'
      : `<path d="${mouth}" fill="none" stroke="#05060f" stroke-width="2.8" stroke-linecap="round"/>`;
    const ring = state === 'thinking' ? '<circle class="ring" cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,.35)" stroke-dasharray="6 9" />' : '';
    return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">` +
      `<defs><radialGradient id="bodyG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/>` +
      `<stop offset=".35" stop-color="var(--c1)"/><stop offset="1" stop-color="var(--c2)"/></radialGradient></defs>` +
      `<ellipse class="shadow" cx="50" cy="93" rx="26" ry="4" fill="rgba(0,0,0,.35)"/>` +
      `<path class="body" d="M50 6 C78 6 94 26 94 52 C94 80 74 94 50 94 C26 94 6 80 6 52 C6 26 22 6 50 6 Z" fill="url(#bodyG)"/>` +
      ring + eyes + m + `</svg>`;
  }

  const api = { STATES, initial, tap, settle, set, reply, eyeOffset, svg, MOUTH, TAP_WINDOW, DIZZY_TAPS, DIZZY_FOR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BuddyAvatar = api;
})(typeof window !== 'undefined' ? window : globalThis);
