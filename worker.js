/* Buddy sync and agent Worker (your own, on Cloudflare).
   /state         : the sync copy (KV)
   /agent/chat    : the smart agent (Claude, via your ANTHROPIC_API_KEY)
   /agent/speak   : the natural voice (Gemini text-to-speech, via your GEMINI_API_KEY) -> WAV audio
   Every route needs the SYNC_SECRET as a Bearer token. Keys never leave the Worker.
   Setup: see START_HERE.md, part 7 (sync) and part 8 (agent and voice). */

/* ---------- AWS Signature Version 4 (Web Crypto, runs in a Cloudflare Worker). Checked against AWS's test vector. ---------- */
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function sha256Hex(data) { return hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data)); }
async function hmac(key, data) {
  const k = typeof key === 'string' ? enc.encode(key) : key;
  const ck = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', ck, enc.encode(data)));
}
/** Returns the Authorization header value and the date headers to send. */
async function signV4({ method, host, path, query = '', body = '', region, service, accessKeyId, secretAccessKey, amzDate, contentType }) {
  const date = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);
  const headerLines = [['host', host], ['x-amz-date', amzDate]];
  if (contentType) headerLines.push(['content-type', contentType]);
  headerLines.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const canonicalHeaders = headerLines.map(([k, v]) => `${k}:${String(v).trim()}\n`).join('');
  const signedHeaders = headerLines.map(([k]) => k).join(';');
  const canonicalRequest = [method, path, query, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');
  let k = await hmac('AWS4' + secretAccessKey, date);
  k = await hmac(k, region); k = await hmac(k, service); k = await hmac(k, 'aws4_request');
  const signature = hex(await hmac(k, stringToSign));
  return { authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`, payloadHash };
}

const JSON_HDR = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const DEFAULT_CHAT_MODEL = 'claude-haiku-5-5';
const DEFAULT_TTS_MODEL = 'gemini-3.1-flash-tts-preview';
const FALLBACK_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const DEFAULT_VOICE = 'Kore';
const DEFAULT_DAILY_LIMIT = 200;
const MAX_SPEAK_CHARS = 1000;
const MAX_CHAT_TURNS = 24;

/* The tools the agent may use. Defined here, on the Worker, so the phone cannot add its own.
   One tool = one job. Every tool maps to a Buddy command on the phone, which checks the input again. */
export const AGENT_TOOLS = [
  { name: 'add_task', description: 'Add a task to the user\'s task list.', strict: true,
    input_schema: { type: 'object', properties: { text: { type: 'string', description: 'What to do, in a few words.' } }, required: ['text'], additionalProperties: false } },
  { name: 'complete_task', description: 'Mark a task as done, by its number.', strict: true,
    input_schema: { type: 'object', properties: { id: { type: 'integer', description: 'The task number shown in the list.' } }, required: ['id'], additionalProperties: false } },
  { name: 'add_shopping', description: 'Add items to the shopping list.', strict: true,
    input_schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'string' }, description: 'Item names.' } }, required: ['items'], additionalProperties: false } },
  { name: 'add_goal', description: 'Start a new goal with a number of steps.', strict: true,
    input_schema: { type: 'object', properties: { title: { type: 'string' }, steps: { type: 'integer', description: 'How many steps to reach it.' } }, required: ['title', 'steps'], additionalProperties: false } },
  { name: 'step_goal', description: 'Move a goal forward by some steps.', strict: true,
    input_schema: { type: 'object', properties: { id: { type: 'integer', description: 'The goal number.' }, amount: { type: 'integer', description: 'Steps to add, usually 1.' } }, required: ['id'], additionalProperties: false } },
  { name: 'set_reminder', description: 'Set a reminder for a number of minutes from now.', strict: true,
    input_schema: { type: 'object', properties: { text: { type: 'string' }, minutes: { type: 'integer', description: 'Minutes from now, 1 to 10080.' } }, required: ['text', 'minutes'], additionalProperties: false } },
  { name: 'log_water', description: 'Record glasses of water drunk today.', strict: true,
    input_schema: { type: 'object', properties: { glasses: { type: 'integer', description: 'Glasses, 1 to 20.' } }, required: ['glasses'], additionalProperties: false } },
  { name: 'log_mood', description: 'Record how the user feels right now.', strict: true,
    input_schema: { type: 'object', properties: { mood: { type: 'string', enum: ['great', 'good', 'fine', 'meh', 'tired', 'awful'] } }, required: ['mood'], additionalProperties: false } },
  { name: 'get_summary', description: 'Give the user a short summary of their day. Use when they ask how things look.', strict: true,
    input_schema: { type: 'object', properties: {}, additionalProperties: false } },
];
const BLOCK_TYPES = ['text', 'tool_use', 'tool_result'];
function validMessage(m) {
  if (!m || (m.role !== 'user' && m.role !== 'assistant')) return false;
  if (typeof m.content === 'string') return m.content.length <= 4000;
  if (!Array.isArray(m.content) || m.content.length > 20) return false;
  return m.content.every((b) => b && BLOCK_TYPES.indexOf(b.type) !== -1 && JSON.stringify(b).length <= 4000);
}

function same(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function corsFor(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] || 'null'),
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
}

/* ---------- storage: Supabase when its keys are set (table buddy_kv), otherwise Cloudflare KV ---------- */
function supabaseStore(env) {
  const base = env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/buddy_kv';
  const h = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY };
  return {
    async get(key) {
      const r = await fetch(base + '?key=eq.' + encodeURIComponent(key) + '&select=value', { headers: h });
      if (!r.ok) throw new Error('Supabase read failed with ' + r.status);
      const rows = await r.json();
      return rows.length ? rows[0].value : null;
    },
    async put(key, value) {
      const r = await fetch(base + '?on_conflict=key', {
        method: 'POST',
        headers: { ...h, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key, value, updated: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error('Supabase write failed with ' + r.status);
    },
  };
}
export function storeFor(env) {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) return supabaseStore(env);
  if (env.BUDDY_KV) return { get: (k) => env.BUDDY_KV.get(k), put: (k, v, o) => env.BUDDY_KV.put(k, v, o) };
  return null;
}

/* ---------- daily limit: counts every agent call (chat or voice) ---------- */
export async function spend(env, n = 1) {
  const store = storeFor(env);
  if (!store) return false;
  const limit = parseInt(env.AGENT_DAILY_LIMIT || DEFAULT_DAILY_LIMIT, 10) || DEFAULT_DAILY_LIMIT;
  const key = 'quota:' + new Date().toISOString().slice(0, 10);
  const used = parseInt((await store.get(key)) || '0', 10) || 0;
  if (used + n > limit) return false;
  await store.put(key, String(used + n));
  return true;
}

/* ---------- WAV: wraps raw 16-bit mono PCM so every browser can play it ---------- */
export function wavFromPcm(pcm, rate) {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const write = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  write(0, 'RIFF'); v.setUint32(4, 36 + pcm.byteLength, true); write(8, 'WAVE');
  write(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  write(36, 'data'); v.setUint32(40, pcm.byteLength, true);
  const out = new Uint8Array(44 + pcm.byteLength);
  out.set(new Uint8Array(header), 0); out.set(pcm, 44);
  return out;
}
function base64ToBytes(b64) {
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function rateFrom(mime) { const m = /rate=(\d+)/.exec(mime || ''); return m ? parseInt(m[1], 10) : 24000; }

/* ---------- the agent (Claude) ---------- */
async function agentChat(request, env, json) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) return json({ error: 'Send the chat messages.' }, 400);
  if (!body.messages.every(validMessage)) return json({ error: 'The conversation has a message in the wrong form.' }, 400);
  let msgs = body.messages.slice(-MAX_CHAT_TURNS);
  while (msgs.length && !(msgs[0].role === 'user' && typeof msgs[0].content === 'string')) msgs.shift();   // open with a plain user message, never in the middle of a tool exchange
  if (!msgs.length) return json({ error: 'Nothing to answer yet.' }, 400);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'The smart agent is not set up. Add ANTHROPIC_API_KEY to the Worker (START_HERE.md, part 8).' }, 503);
  if (!(await spend(env, 1))) return json({ error: 'The daily agent limit is reached. Buddy still answers commands on your phone. Try the agent again tomorrow.' }, 429);
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: env.AGENT_MODEL || DEFAULT_CHAT_MODEL, max_tokens: 700, system: String(body.system || '').slice(0, 8000), messages: msgs, tools: AGENT_TOOLS }),
  });
  if (!r.ok) return json({ error: `The agent provider answered with error ${r.status}. Try again in a moment.` }, 502);
  const d = await r.json();
  // only text and tool requests go back to the phone
  const content = (d.content || []).filter((c) => c.type === 'text' || c.type === 'tool_use')
    .map((c) => (c.type === 'text' ? { type: 'text', text: String(c.text || '').slice(0, 4000) } : { type: 'tool_use', id: String(c.id || ''), name: String(c.name || ''), input: c.input || {} }));
  return json({ content, stop_reason: d.stop_reason || 'end_turn' });
}

/* ---------- the voices: Amazon Polly (neural, Alexa-style voices) and Google Gemini ---------- */
const POLLY_VOICES = ['Joanna', 'Matthew', 'Ivy', 'Kendra', 'Kimberly', 'Salli', 'Joey', 'Justin', 'Kevin'];
const pollyReady = (env) => !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);

async function speakPolly(text, env, voiceWanted) {
  const region = env.POLLY_REGION || 'us-east-1';
  const host = `polly.${region}.amazonaws.com`;
  const voice = POLLY_VOICES.indexOf(voiceWanted) !== -1 ? voiceWanted : (env.POLLY_VOICE || 'Joanna');
  const body = JSON.stringify({ Engine: 'neural', LanguageCode: 'en-US', OutputFormat: 'pcm', SampleRate: '16000', Text: text, TextType: 'text', VoiceId: voice });
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const sig = await signV4({ method: 'POST', host, path: '/v1/speech', body, region, service: 'polly',
    accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY, amzDate, contentType: 'application/json' });
  const r = await fetch(`https://${host}/v1/speech`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-amz-date': amzDate, Authorization: sig.authorization },
    body,
  });
  if (!r.ok) throw new Error('Amazon Polly answered with error ' + r.status);
  const pcm = new Uint8Array(await r.arrayBuffer());
  if (!pcm.byteLength) throw new Error('Amazon Polly returned no audio.');
  return wavFromPcm(pcm, 16000);
}

/* ---------- the natural voice: Polly when its keys are set (or asked for), otherwise Gemini ---------- */
async function speak(request, env, cors) {
  const fail = (msg, status) => new Response(JSON.stringify({ error: msg }), { status, headers: { ...JSON_HDR, ...cors } });
  const body = await request.json().catch(() => null);
  const text = String((body && body.text) || '').replace(/\s+/g, ' ').trim().slice(0, MAX_SPEAK_CHARS);
  if (!text) return fail('Send some text to speak.', 400);
  const asked = body && body.engine;
  const useAws = asked === 'polly' || (asked !== 'gemini' && pollyReady(env) && env.TTS_PROVIDER !== 'gemini');
  if (useAws && !pollyReady(env)) return fail('Amazon Polly is not set up. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to the Worker (START_HERE.md, part 8b).', 503);
  if (!useAws && !env.GEMINI_API_KEY) return fail('The natural voice is not set up. Add GEMINI_API_KEY to the Worker (START_HERE.md, part 8).', 503);
  if (!(await spend(env, 1))) return fail('The daily voice limit is reached. The phone voice still works.', 429);
  if (useAws) {
    try {
      const wav = await speakPolly(text, env, body && body.voice);
      return new Response(wav, { headers: { ...cors, 'content-type': 'audio/wav', 'cache-control': 'no-store' } });
    } catch (e) {
      return fail('The Amazon voice could not speak right now. Try again, or switch the voice in Settings.', 502);
    }
  }
  const voice = env.GEMINI_VOICE || DEFAULT_VOICE;
  const model = env.GEMINI_TTS_MODEL || DEFAULT_TTS_MODEL;
  const call = (m) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    }),
  });
  let r = await call(model);
  if (r.status === 404 && model !== FALLBACK_TTS_MODEL) r = await call(FALLBACK_TTS_MODEL);   // retired model name: use the older one
  if (!r.ok) return fail(`The voice service answered with error ${r.status}. Try again later.`, 502);
  const d = await r.json();
  const part = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0];
  const inline = part && part.inlineData;
  if (!inline || !inline.data) return fail('The voice service did not return audio.', 502);
  const wav = wavFromPcm(base64ToBytes(inline.data), rateFrom(inline.mimeType));
  return new Response(wav, { headers: { ...cors, 'content-type': 'audio/wav', 'cache-control': 'no-store' } });
}

export async function route(request, env) {
  const cors = corsFor(request, env);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...JSON_HDR, ...cors } });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const url = new URL(request.url);
  const auth = request.headers.get('Authorization') || '';
  const got = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.SYNC_SECRET || env.SYNC_SECRET.length < 16 || !same(got, env.SYNC_SECRET)) {
    return json({ error: 'The sync secret is wrong.' }, 401);
  }
  try {
    if (url.pathname === '/agent/chat' && request.method === 'POST') return await agentChat(request, env, json);
    if (url.pathname === '/agent/speak' && request.method === 'POST') return await speak(request, env, cors);
    if (url.pathname !== '/state') return json({ error: 'Not found.' }, 404);
    const store = storeFor(env);
    if (!store) return json({ error: 'No storage is connected. Add Supabase keys or the BUDDY_KV binding (START_HERE.md, part 7 or 7c).' }, 500);
    if (request.method === 'GET') {
      const value = await store.get('state');
      if (value === null) return new Response('', { status: 404, headers: cors });
      return new Response(value, { headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    if (request.method === 'PUT') {
      const body = await request.text();
      if (body.length > 200000) return json({ error: 'The data is too large.' }, 413);
      try { JSON.parse(body); } catch (e) { return json({ error: 'The data is not valid JSON.' }, 400); }
      await store.put('state', body);
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed.' }, 405);
  } catch (e) {
    return json({ error: 'The Worker had a problem. Nothing was changed.' }, 500);
  }
}

export { signV4 };
export default { fetch: (request, env) => route(request, env) };
