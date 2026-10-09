/* Ambient visual effects: soft floating particles behind the screen, in the theme colours.
   Designed to be light: capped frame rate, paused when the app is hidden, and off when the phone
   asks for reduced motion or when Buddy's "calm" option is on. The maths is pure, so it is tested in Node. */
(function (root) {
  'use strict';
  function density(w, h) {
    // about one particle per 14,000 px of screen, between 10 and 40
    return Math.max(10, Math.min(40, Math.round((w * h) / 14000)));
  }
  function make(count, w, h, rnd) {
    const r = rnd || Math.random;
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push({ x: r() * w, y: r() * h, vx: (r() - 0.5) * 0.12, vy: -0.04 - r() * 0.12, s: 1 + r() * 2.6, a: 0.12 + r() * 0.3, ph: r() * 6.28 });
    }
    return out;
  }
  /** Moves particles by dt milliseconds, wrapping at the edges. Returns the same array (updated). */
  function step(parts, dt, w, h, t) {
    const k = Math.min(64, dt || 16) / 16;
    for (const p of parts) {
      p.x += p.vx * k * 16 + Math.sin((t || 0) / 1400 + p.ph) * 0.05;
      p.y += p.vy * k * 16;
      if (p.y < -6) { p.y = h + 6; p.x = (p.x % w + w) % w; }
      if (p.x < -6) p.x = w + 6;
      if (p.x > w + 6) p.x = -6;
    }
    return parts;
  }
  /** Starts the effect on a canvas. Returns a stop() function. */
  function start(canvas, opts) {
    const o = opts || {};
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return () => { };
    let w = 0, h = 0, parts = [], last = 0, raf = 0, running = true;
    const color = o.color || '#0EA5A4';
    const fps = o.fps || 30, frame = 1000 / fps;
    function resize() {
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = make(density(w, h), w, h);
    }
    function tick(now) {
      if (!running) return;
      raf = root.requestAnimationFrame(tick);
      if (now - last < frame) return;
      const dt = last ? now - last : frame;
      last = now;
      step(parts, dt, w, h, now);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      for (const p of parts) { ctx.globalAlpha = p.a; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.2832); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    const onVis = () => { if (root.document && root.document.hidden) { root.cancelAnimationFrame(raf); last = 0; } else if (running) { raf = root.requestAnimationFrame(tick); } };
    resize();
    root.addEventListener('resize', resize);
    if (root.document) root.document.addEventListener('visibilitychange', onVis);
    raf = root.requestAnimationFrame(tick);
    return function stop() {
      running = false; root.cancelAnimationFrame(raf);
      root.removeEventListener('resize', resize);
      if (root.document) root.document.removeEventListener('visibilitychange', onVis);
      ctx.clearRect(0, 0, w, h);
    };
  }
  const api = { density, make, step, start };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BuddyVFX = api;
})(typeof window !== 'undefined' ? window : globalThis);
