/* Buddy's smart agent (phone side). It builds the instructions, sends the conversation to your Worker,
   and reads the answer. The answer may ask Buddy to run commands, but only commands from Buddy's own list
   are accepted. Anything else is dropped. Nothing here changes data by itself: the app runs the commands. */
(function (root) {
  'use strict';
  const ALLOWED = ['good morning', 'what now', 'weekly review', 'help', 'share', 'skills', 'insights', 'calendar',
    'add task', 'task', 'tasks', 'done', 'add shopping', 'shopping', 'buy', 'bought', 'got', 'note',
    'goal', 'goals', 'step', 'remind me', 'reminders', 'habit', 'habits', 'did', 'drank', 'drink', 'water',
    'i feel', 'feel', 'check in', 'save routine', 'run routine'];
  const MAX_COMMANDS = 3, MAX_SAY = 700;

  function isAllowed(cmd) {
    const c = String(cmd || '').trim().toLowerCase();
    if (!c || c.length > 200) return false;
    return ALLOWED.some((p) => c === p || c.indexOf(p + ' ') === 0 || c.indexOf(p + ':') === 0);
  }

  /** The instructions for the model. Short and specific: a warm companion, plain words, commands only from the list. */
  function buildSystem(summary, now) {
    const lines = [
      'You are Buddy, a warm, calm companion inside a phone app for tasks, goals, reminders, habits, shopping, water and mood.',
      'Speak in plain, natural English, like a thoughtful friend. Keep answers short: two to four sentences. No emoji, no bullet lists unless asked.',
      'To change the user\'s data, call the matching tool. Use a tool only when the user asks for a change. Call at most one tool per idea.',
      'Never claim something was done unless its tool returned a result.',
      'Use common sense. If a time, number or name is missing for an action, ask one short question instead of guessing.',
      'Do not log water, mood or habits unless the user says so. Never record a mood the user did not describe.',
      'Before making more than five changes at once, ask the user to confirm.',
      'If the user says they might hurt themselves or are unsafe, respond with care, suggest talking to someone they trust or local emergency services, and do not use tools.',
      'Keep the summary private to this conversation. Do not repeat personal details the user did not ask about.',
      'Never claim something was done unless its command is in the list. Never invent tasks or numbers: use the summary below.',
      'If the user seems unwell, distressed or unsafe, be gentle, say you care, and suggest talking to someone they trust or local emergency services.',
      'Do not give medical, legal or financial advice as a professional. Suggest seeing a qualified person instead.',
      'Time now: ' + new Date(now).toString().slice(0, 33) + '.',
      'The user\'s current state (summary): ' + String(summary || 'nothing recorded yet').slice(0, 1200),
    ];
    return lines.join('\n');
  }

  /** Reads the model's answer. Accepts JSON (possibly wrapped in text); anything else becomes plain speech. */
  function parseReply(raw) {
    const text = String(raw || '').trim();
    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    let obj = null;
    if (start !== -1 && end > start) {
      try { obj = JSON.parse(text.slice(start, end + 1)); } catch (e) { obj = null; }
    }
    if (!obj || typeof obj !== 'object') {
      return { say: text.slice(0, MAX_SAY), commands: [] };
    }
    const commands = (Array.isArray(obj.commands) ? obj.commands : [])
      .map((c) => String(c || '').trim()).filter(isAllowed).slice(0, MAX_COMMANDS);
    let say = String(obj.say || '').replace(/\s+/g, ' ').trim().slice(0, MAX_SAY);
    if (!say && commands.length) say = 'Done.';
    return { say, commands };
  }

  /** Sends the conversation to the Worker. Returns { say, commands }. Throws with a plain message on failure. */
  async function chat(opts) {
    const o = opts || {};
    const f = o.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f) throw new Error('This browser cannot make web requests.');
    if (!o.base || !o.secret) throw new Error('Set up cloud storage first (Settings, Cloudflare). The agent runs on your Worker.');
    let res;
    try {
      res = await f(String(o.base).replace(/\/+$/, '') + '/agent/chat', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + o.secret, 'content-type': 'application/json' },
        body: JSON.stringify({ system: buildSystem(o.summary, o.now || Date.now()), messages: o.messages || [] }),
      });
    } catch (e) { throw new Error('Could not reach your Worker. Check the internet connection.'); }
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) throw new Error(data.error || ('The agent is unavailable (' + res.status + ').'));
    return parseReply(data.text);
  }

  /** Asks the Worker to speak a line. Returns an audio Blob (WAV). */
  async function speakBlob(opts) {
    const o = opts || {};
    const f = o.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f || !o.base || !o.secret) throw new Error('Natural voice needs your Worker.');
    const text = String(o.text || '').slice(0, 1000);
    const res = await f(String(o.base).replace(/\/+$/, '') + '/agent/speak', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + o.secret, 'content-type': 'application/json' },
      body: JSON.stringify({ text, engine: o.engine || undefined, voice: o.voice || undefined }),
    });
    if (!res.ok) { let m = 'The natural voice is unavailable.'; try { m = (await res.json()).error || m; } catch (e) { } throw new Error(m); }
    return await res.blob();
  }


  /* ---------- tools: the phone checks every input again, then turns it into a Buddy command ---------- */
  const SPECS = {
    add_task: { text: { t: 'str', max: 200 } },
    complete_task: { id: { t: 'int', min: 1, max: 1000000 } },
    add_shopping: { items: { t: 'arr', max: 10, item: { t: 'str', max: 100 } } },
    add_goal: { title: { t: 'str', max: 120 }, steps: { t: 'int', min: 1, max: 999 } },
    step_goal: { id: { t: 'int', min: 1, max: 1000000 }, amount: { t: 'int', min: 1, max: 100, def: 1 } },
    set_reminder: { text: { t: 'str', max: 200 }, minutes: { t: 'int', min: 1, max: 10080 } },
    log_water: { glasses: { t: 'int', min: 1, max: 20 } },
    log_mood: { mood: { t: 'enum', values: ['great', 'good', 'fine', 'meh', 'tired', 'awful'] } },
    get_summary: {},
  };
  const TOOL_NAMES = Object.keys(SPECS);
  function checkOne(spec, v) {
    if (spec.t === 'str') {
      const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
      if (!s) return { ok: false, error: 'a text value is needed' };
      return { ok: true, value: s.slice(0, spec.max) };
    }
    if (spec.t === 'int') {
      const n = v === undefined && spec.def !== undefined ? spec.def : v;
      if (!Number.isInteger(n) || n < spec.min || n > spec.max) return { ok: false, error: `a whole number from ${spec.min} to ${spec.max} is needed` };
      return { ok: true, value: n };
    }
    if (spec.t === 'enum') return spec.values.indexOf(v) !== -1 ? { ok: true, value: v } : { ok: false, error: 'the value is not one of: ' + spec.values.join(', ') };
    if (spec.t === 'arr') {
      if (!Array.isArray(v) || !v.length || v.length > spec.max) return { ok: false, error: `a list of 1 to ${spec.max} items is needed` };
      const out = [];
      for (const it of v) { const c = checkOne(spec.item, it); if (!c.ok) return c; out.push(c.value); }
      return { ok: true, value: out };
    }
    return { ok: false, error: 'unknown input' };
  }
  /** Checks a tool request. Returns { ok, value } or { ok:false, error }. Unknown tools are always refused. */
  function validate(name, input) {
    if (TOOL_NAMES.indexOf(name) === -1) return { ok: false, error: 'that tool is not available' };
    const spec = SPECS[name], src = input && typeof input === 'object' ? input : {};
    const value = {};
    for (const key of Object.keys(spec)) {
      const c = checkOne(spec[key], src[key]);
      if (!c.ok) return { ok: false, error: key + ': ' + c.error };
      value[key] = c.value;
    }
    return { ok: true, value };
  }
  /** The Buddy command a checked tool request means. */
  function toCommand(name, v) {
    switch (name) {
      case 'add_task': return 'add task ' + v.text;
      case 'complete_task': return 'done ' + v.id;
      case 'add_shopping': return 'add shopping ' + v.items.join(', ');
      case 'add_goal': return 'goal ' + v.title + ' ' + v.steps + ' steps';
      case 'step_goal': return 'step ' + v.id + ' ' + v.amount;
      case 'set_reminder': return 'remind me in ' + v.minutes + ' minutes to ' + v.text;
      case 'log_water': return 'drank ' + v.glasses + ' glasses';
      case 'log_mood': return 'i feel ' + v.mood;
      case 'get_summary': return 'good morning';
      default: return null;
    }
  }

  /** The agent loop: asks the Worker, runs any tools the model asks for, sends the results back, repeats.
      execute(command) runs a Buddy command on the phone and returns its reply text. */
  const MAX_TURNS = 4;
  async function runAgent(opts) {
    const o = opts || {};
    const f = o.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f) throw new Error('This browser cannot make web requests.');
    if (!o.base || !o.secret) throw new Error('Set up cloud storage first (Settings, Cloudflare). The agent runs on your Worker.');
    const messages = (o.history || []).slice(-10).concat([{ role: 'user', content: String(o.userText || '').slice(0, 2000) }]);
    const results = [];
    let say = '';
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      let res;
      try {
        res = await f(String(o.base).replace(/\/+$/, '') + '/agent/chat', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + o.secret, 'content-type': 'application/json' },
          body: JSON.stringify({ system: buildSystem(o.summary, o.now || Date.now()), messages }),
        });
      } catch (e) { throw new Error('Could not reach your Worker. Check the internet connection.'); }
      let data = {};
      try { data = await res.json(); } catch (e) { data = {}; }
      if (!res.ok) throw new Error(data.error || ('The agent is unavailable (' + res.status + ').'));
      const blocks = Array.isArray(data.content) ? data.content : [];
      messages.push({ role: 'assistant', content: blocks });
      if (data.stop_reason !== 'tool_use') {
        say = blocks.filter((b) => b.type === 'text').map((b) => b.text).join(' ').replace(/\s+/g, ' ').trim().slice(0, MAX_SAY);
        break;
      }
      const toolResults = [];
      for (const b of blocks.filter((x) => x.type === 'tool_use')) {
        const id = String(b.id || '');
        if (!id) continue;
        const v = validate(b.name, b.input);
        let content;
        if (!v.ok) content = 'Not done: ' + v.error;
        else {
          const cmd = toCommand(b.name, v.value);
          content = String(await o.execute(cmd) || 'Done.');
          results.push(content);
        }
        toolResults.push({ type: 'tool_result', tool_use_id: id, content: content.slice(0, 500) });
      }
      messages.push({ role: 'user', content: toolResults });
    }
    return { say: say || (results.length ? 'Done.' : ''), results };
  }

  const api = { ALLOWED, isAllowed, buildSystem, parseReply, chat, speakBlob, MAX_COMMANDS, TOOL_NAMES, validate, toCommand, runAgent, MAX_TURNS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BuddyAgent = api;
})(typeof window !== 'undefined' ? window : globalThis);
