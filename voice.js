/* Voice for Buddy: speak to it (speech recognition) and hear it reply (speech synthesis).
   Uses the browser's built-in Web Speech API. No key, no paid service, nothing installed.
   Notes from MDN and browser guides: Chrome and Edge recognise speech through Google's servers;
   Safari on iPhone and iPad needs iOS 14.5+ and uses webkit prefixes; some browsers have no speech output.
   Every function fails softly: if something is missing, the app shows text only. */
(function (root) {
  'use strict';
  const Rec = root.SpeechRecognition || root.webkitSpeechRecognition || null;
  const hasSynth = !!root.speechSynthesis && typeof root.SpeechSynthesisUtterance !== 'undefined';

  function support() { return { listen: !!Rec, speak: hasSynth }; }

  /** Turns a reply into something that sounds right when spoken: no emoji, no bullets, short pauses. */
  function cleanForSpeech(text) {
    return String(text || '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '')
      .replace(/[•·*_#]/g, ' ')
      .replace(/\n+/g, '. ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 600);
  }

  /** Picks a voice in the language, preferring ones marked as natural or high quality. */
  function pickVoice(voices, lang, preferredName) {
    if (!voices || !voices.length) return null;
    if (preferredName) { const v = voices.find((x) => x.name === preferredName); if (v) return v; }
    const prefix = String(lang || 'en').slice(0, 2).toLowerCase();
    const inLang = voices.filter((v) => String(v.lang || '').toLowerCase().startsWith(prefix));
    const natural = inLang.find((v) => /natural|neural|premium|enhanced|google/i.test(v.name));
    return natural || inLang[0] || voices[0];
  }

  /** Listens once. Calls onText(text) with the spoken words, onError(code) on failure, onEnd() when done. */
  function listen(opts) {
    const o = opts || {};
    if (!Rec) { if (o.onError) o.onError('unsupported'); return null; }
    let r;
    try { r = new Rec(); } catch (e) { if (o.onError) o.onError('unsupported'); return null; }
    r.lang = o.lang || 'en-GB';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;
    r.onresult = (e) => {
      const alt = e && e.results && e.results[0] && e.results[0][0];
      const text = alt ? String(alt.transcript || '').trim() : '';
      if (text && o.onText) o.onText(text.slice(0, 500));
    };
    r.onerror = (e) => { if (o.onError) o.onError((e && e.error) || 'error'); };
    r.onend = () => { if (o.onEnd) o.onEnd(); };
    try { r.start(); } catch (e) { if (o.onError) o.onError('busy'); return null; }
    return r;
  }

  /** Speaks text. Returns true if speech started. */
  function speak(text, opts) {
    const o = opts || {};
    if (!hasSynth) return false;
    const clean = cleanForSpeech(text);
    if (!clean) return false;
    try {
      root.speechSynthesis.cancel();
      const u = new root.SpeechSynthesisUtterance(clean);
      u.lang = o.lang || 'en-GB';
      u.rate = Math.min(1.2, Math.max(0.7, o.rate || 0.98));
      u.pitch = Math.min(1.3, Math.max(0.8, o.pitch || 1.02));
      const v = pickVoice(root.speechSynthesis.getVoices ? root.speechSynthesis.getVoices() : [], u.lang, o.voiceName);
      if (v) u.voice = v;
      root.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  function stop() { if (hasSynth) try { root.speechSynthesis.cancel(); } catch (e) { } }

  function voices() { return hasSynth && root.speechSynthesis.getVoices ? root.speechSynthesis.getVoices() : []; }

  const api = { support, listen, speak, stop, voices, cleanForSpeech, pickVoice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BuddyVoice = api;
})(typeof window !== 'undefined' ? window : globalThis);
