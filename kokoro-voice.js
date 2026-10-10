/* Free, open-source, offline voice for Buddy: Kokoro (82M parameters, Apache 2.0), run in the browser
   with kokoro-js and Transformers.js. No key, no card, no server. The model downloads once on first use.
   Pure parts (text splitting, voice choice, the speaker with its fallback) are tested in Node; the model
   itself is loaded only on the phone. */
(function (root) {
  'use strict';
  const VOICES = ['af_heart', 'af_bella', 'af_nicole', 'af_sarah', 'am_adam', 'am_michael', 'bf_emma', 'bm_george'];
  const DEFAULT_VOICE = 'af_heart';
  const MAX_CHARS = 300;          // short pieces read more naturally and stay inside the model's limit

  /** Splits text into pieces of at most `max` characters, at sentence ends where possible. */
  function chunkText(text, max) {
    const limit = max || MAX_CHARS;
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    const sentences = clean.match(/[^.!?]+[.!?]*\s*/g) || [clean];
    const pieces = [];
    let cur = '';
    for (let s of sentences) {
      s = s.trim();
      // a very long sentence is cut at word boundaries
      while (s.length > limit) {
        let cut = s.lastIndexOf(' ', limit);
        if (cut <= 0) cut = limit;
        if (cur) { pieces.push(cur); cur = ''; }
        pieces.push(s.slice(0, cut).trim());
        s = s.slice(cut).trim();
      }
      if (!s) continue;
      if (cur && (cur + ' ' + s).length > limit) { pieces.push(cur); cur = s; }
      else cur = cur ? cur + ' ' + s : s;
    }
    if (cur) pieces.push(cur);
    return pieces;
  }

  function pickVoice(name) { return VOICES.indexOf(name) !== -1 ? name : DEFAULT_VOICE; }

  /** A speaker. `load` returns the model (anything with generate(text, {voice}) -> audio with toBlob()).
      The model loads once; if loading fails, the next call tries again. */
  function createSpeaker(opts) {
    const o = opts || {};
    let ready = null;
    function model() {
      if (!ready) {
        ready = Promise.resolve().then(() => o.load()).catch((e) => { ready = null; throw e; });
      }
      return ready;
    }
    async function toBlob(audio) {
      if (audio && typeof audio.toBlob === 'function') return audio.toBlob();
      if (audio && typeof audio.toWav === 'function') return new Blob([audio.toWav()], { type: 'audio/wav' });
      throw new Error('The voice model returned audio in a format this app cannot play.');
    }
    /** Returns one audio Blob per piece of text, in order. */
    async function speak(text, voice) {
      const pieces = chunkText(text);
      if (!pieces.length) throw new Error('Nothing to speak.');
      const tts = await model();
      const blobs = [];
      for (const p of pieces) {
        const audio = await tts.generate(p, { voice: pickVoice(voice) });
        blobs.push(await toBlob(audio));
      }
      return blobs;
    }
    return { speak, isLoaded: () => !!ready };
  }

  const api = { VOICES, DEFAULT_VOICE, MAX_CHARS, chunkText, pickVoice, createSpeaker };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BuddyKokoro = api;
})(typeof window !== 'undefined' ? window : globalThis);
