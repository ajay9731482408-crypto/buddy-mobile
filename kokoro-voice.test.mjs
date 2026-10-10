import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const K = require("./kokoro-voice.js");

test("text is split into short pieces that never exceed the limit, and nothing is lost", () => {
  const text = "Good morning! ".repeat(60) + "x".repeat(700) + " The end.";
  const pieces = K.chunkText(text);
  assert.ok(pieces.every((p) => p.length <= K.MAX_CHARS), "every piece fits");
  assert.equal(pieces.join(" ").replace(/\s+/g, "").length, text.replace(/\s+/g, "").length, "no words are lost");
  assert.deepEqual(K.chunkText("   "), []);
  assert.equal(K.chunkText("Hello there.").length, 1);
});
test("unknown voices fall back to the default", () => {
  assert.equal(K.pickVoice("am_adam"), "am_adam");
  assert.equal(K.pickVoice("nope"), K.DEFAULT_VOICE);
});
test("the speaker loads the model once and returns one audio blob per piece, in order", async () => {
  let loads = 0; const calls = [];
  const model = { generate: async (text, o) => { calls.push({ text, voice: o.voice }); return { toBlob: async () => new Blob([text], { type: "audio/wav" }) }; } };
  const sp = K.createSpeaker({ load: async () => { loads++; return model; } });
  const blobs = await sp.speak("First sentence. Second sentence.", "am_adam");
  await sp.speak("Again.", "am_adam");
  assert.equal(loads, 1, "the model is loaded once");
  assert.equal(blobs.length, 1);
  assert.equal(calls[0].voice, "am_adam");
  assert.equal(sp.isLoaded(), true);
});
test("if loading fails, the error is reported and the next call tries again", async () => {
  let attempts = 0;
  const sp = K.createSpeaker({ load: async () => { attempts++; if (attempts === 1) throw new Error("network down"); return { generate: async () => ({ toBlob: async () => new Blob(["ok"]) }) }; } });
  await assert.rejects(sp.speak("hello"), /network down/);
  await sp.speak("hello");
  assert.equal(attempts, 2, "the second attempt loads the model");
});
test("audio that cannot be turned into a blob is reported clearly", async () => {
  const sp = K.createSpeaker({ load: async () => ({ generate: async () => ({}) }) });
  await assert.rejects(sp.speak("hello"), /format this app cannot play/);
});
test("empty text is refused before the model is loaded", async () => {
  let loaded = false;
  const sp = K.createSpeaker({ load: async () => { loaded = true; return {}; } });
  await assert.rejects(sp.speak("   "), /Nothing to speak/);
  assert.equal(loaded, false);
});
