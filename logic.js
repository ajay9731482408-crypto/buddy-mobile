/* Buddy Mobile: pure logic (no browser APIs). Testable in Node.
   Every change stamps `updated`; the newer copy wins when phone and cloud differ. */
(function (root) {
  'use strict';
  const WATER_GLASS_ML = 250, WATER_GOAL_ML = 2000;
  const MOODS = { great: 5, good: 4, fine: 3, ok: 3, okay: 3, meh: 2, tired: 2, sad: 2, low: 2, stressed: 2, anxious: 2, awful: 1, bad: 1 };
  const SYNONYM = { todo: 'task', todos: 'task', reminder: 'task', chore: 'task', buy: 'shopping', get: 'shopping', purchase: 'shopping',
                    completed: 'done', finished: 'done', complete: 'done', finish: 'done', glass: 'glass', glasses: 'glass', cup: 'glass', cups: 'glass',
                    jot: 'note', memo: 'note', objective: 'goal', aim: 'goal' };
  const SAFETY = 'I am sorry you feel that way. A glass of water, a few slow breaths, or a short walk can help. If you feel unsafe, contact someone you trust or local emergency services.';

  function emptyState(now) {
    return { version: 2, updated: now || new Date().toISOString(), nextId: 1, tasks: [], shopping: [], notes: [], water: {}, moods: [], goals: [], prefs: {} };
  }
  function clone(s) { return JSON.parse(JSON.stringify(s)); }
  /* The day a moment belongs to, on THIS phone (local time). Accepts ISO text or milliseconds. */
  function localDay(t) {
    const d = new Date(typeof t === 'number' ? t : Date.parse(t));
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function dayKey(now) { return localDay(now); }
  function migrate(s) {
    const base = emptyState(s && s.updated);
    if (!s || typeof s !== 'object') return base;
    return Object.assign(base, s, { version: 2, goals: Array.isArray(s.goals) ? s.goals : [], prefs: s.prefs || {} });
  }

  /* Normalise words so "completed", "todos", "buy" and "cups" all work. Keeps order and text. */
  /* Only the command word (the first word) is normalised. The rest of the text is kept exactly,
     so "add task buy stamps" stays a task about stamps. */
  function normalise(text) {
    const clean = String(text || '').trim().slice(0, 500).replace(/\s+/g, ' ');
    const m = clean.match(/^([A-Za-z']+)(\W.*|)$/);
    if (!m) return clean;
    const first = SYNONYM[m[1].toLowerCase()] || m[1];
    return first + m[2].replace(/^:\s*/, ' ');
  }

  /** Pure command handler. Returns { state, reply, mood }. Never throws on user text. */
  function handle(state, text, now) {
    const s = clone(migrate(state));
    const raw = normalise(text);
    const t = raw.toLowerCase().replace(/[.!?]+$/, '');
    const id = () => s.nextId++;
    const touch = () => { s.updated = now; return s; };
    const reply = (msg, mood) => ({ state: touch(), reply: msg, mood: mood || 'happy' });
    if (!raw) return reply('I am listening.');
    let m;

    if (/^(good morning|morning|briefing|brief me|what is my day|my day|summary)$/.test(t)) {
      const sum = summary(s, now);
      const topGoal = s.goals.filter((g) => !g.done)[0];
      const lines = [`You have ${sum.openTasks} open task${sum.openTasks === 1 ? '' : 's'} and ${sum.shopping} thing${sum.shopping === 1 ? '' : 's'} to buy.`,
        `Water today: ${sum.waterMl} ml of ${WATER_GOAL_ML}.`];
      if (topGoal) lines.push(`Goal to focus on: ${topGoal.title} (${topGoal.progress} of ${topGoal.target}).`);
      return reply(lines.join('\n'), 'happy');
    }
    if ((m = t.match(/^(?:add task|task)\s+(.+)$/))) {
      const wanted = m[1].trim().toLowerCase();
      const same = s.tasks.find((x) => !x.done && x.text.trim().toLowerCase() === wanted);
      if (same) return reply(`That is already on your list as task #${same.id}.`, 'happy');
      const task = { id: id(), text: raw.slice(raw.length - m[1].length), done: false, created: now };
      s.tasks.push(task);
      return reply(`Added task #${task.id}: ${task.text}`);
    }
    if (/^(tasks|list tasks|my tasks|task list|what do i have to do)$/.test(t)) {
      const open = s.tasks.filter((x) => !x.done);
      return reply(open.length ? 'Open tasks:\n' + open.map((x) => `#${x.id} ${x.text}`).join('\n') : 'No open tasks. Nice work.', 'happy');
    }
    if ((m = t.match(/^(?:done|finish|complete)\s*#?(\d+)$/))) {
      const task = s.tasks.find((x) => x.id === Number(m[1]));
      if (!task) return reply(`I cannot find task #${m[1]}.`, 'confused');
      task.done = true; task.doneAt = now;
      return reply(`Done: ${task.text}`, 'excited');
    }
    if ((m = t.match(/^(?:add shopping|shopping add)\s+(.+)$/)) || (m = t.match(/^shopping\s+(.+)$/))) {
      const items = raw.slice(raw.length - m[1].length).split(/,| and /).map((x) => x.trim()).filter(Boolean);
      let added = 0;
      for (const it of items) {
        if (!s.shopping.some((x) => !x.done && x.text.toLowerCase() === it.toLowerCase())) { s.shopping.push({ id: id(), text: it, done: false }); added++; }
      }
      return reply(added ? `Added ${added} item${added === 1 ? '' : 's'} to the shopping list.` : 'Those are already on the list.');
    }
    if (/^(shopping|shopping list|list shopping)$/.test(t)) {
      const open = s.shopping.filter((x) => !x.done);
      return reply(open.length ? 'Shopping list:\n' + open.map((x) => `• ${x.text}`).join('\n') : 'The shopping list is empty.');
    }
    if ((m = t.match(/^(?:bought|got|bought the|got the)\s+(.+)$/))) {
      const hit = s.shopping.find((x) => !x.done && x.text.toLowerCase().includes(m[1].trim()));
      if (!hit) return reply('I do not see that on the list.', 'confused');
      hit.done = true;
      return reply(`Crossed off: ${hit.text}`, 'happy');
    }
    if ((m = t.match(/^note\s*:?\s+(.+)$/))) {
      s.notes.push({ id: id(), text: raw.slice(raw.length - m[1].length), created: now });
      return reply('Note saved.');
    }
    if ((m = t.match(/^(?:drank|drink)\s+(\d{1,2})\s*(?:glass|glasses|cup|cups)?$/))) {
      const n = Number(m[1]);
      if (n < 1) return reply('Tell me how many glasses you drank, for example "drank 2 glasses".', 'confused');
      if (n > 20) return reply('That is more than 20 glasses in one go. Please log a smaller number, or check the total on Health.', 'confused');
      const day = dayKey(now);
      s.water[day] = (s.water[day] || 0) + n * WATER_GLASS_ML;
      const left = Math.max(0, WATER_GOAL_ML - s.water[day]);
      if (s.water[day] >= 3000) return reply(`Water today: ${s.water[day]} ml. That is a lot for one day. Are you feeling all right?`, 'worried');
      return reply(left ? `Water today: ${s.water[day]} ml. ${left} ml to go.` : `Water goal reached: ${s.water[day]} ml. Well done!`, 'excited');
    }
    if (/^(water|water today|how much water)$/.test(t)) {
      return reply(`Water today: ${s.water[dayKey(now)] || 0} ml of ${WATER_GOAL_ML} ml.`);
    }
    if ((m = t.match(/^goal\s*:?\s+(.+)$/)) && !/^goal\s*:?\s+(\d+)/.test(t)) {
      const body = raw.slice(raw.length - m[1].length);
      const tgt = body.match(/(\d+)\s*(?:steps|times|days|pages|sessions)?$/);
      if (tgt && Number(tgt[1]) < 1) return reply('A goal needs at least one step. Try "goal learn guitar 20 steps".', 'confused');
      const target = tgt ? Math.min(999, Number(tgt[1])) : 10;
      const title = (tgt ? body.slice(0, body.length - tgt[0].length) : body).replace(/\b(to|for)\s*$/i, '').trim() || 'My goal';
      const g = { id: id(), title: title.slice(0, 120), target, progress: 0, done: false, created: now };
      s.goals.push(g);
      return reply(`New goal #${g.id}: ${g.title}, ${g.target} steps. Say "step ${g.id}" each time you move forward.`, 'excited');
    }
    if (/^(goals?|my goals|goal list|list goals)$/.test(t)) {
      const open = s.goals.filter((g) => !g.done);
      return reply(open.length ? 'Your goals:\n' + open.map((g) => `#${g.id} ${g.title}: ${g.progress} of ${g.target}`).join('\n') : 'No goals yet. Try: goal learn guitar 20 steps.', 'happy');
    }
    if ((m = t.match(/^(?:step|progress|add step)\s*#?(\d+)(?:\s+(\d{1,3}))?$/))) {
      const g = s.goals.find((x) => x.id === Number(m[1]));
      if (!g) return reply(`I cannot find goal #${m[1]}.`, 'confused');
      if (g.done) return reply(`${g.title} is already reached. Start a new goal to keep going.`, 'happy');
      g.progress = Math.min(g.target, g.progress + (m[2] ? Number(m[2]) : 1));
      if (g.progress >= g.target) { g.done = true; g.doneAt = now; return reply(`Goal reached: ${g.title}! Brilliant.`, 'excited'); }
      return reply(`${g.title}: ${g.progress} of ${g.target}. ${g.target - g.progress} to go.`, 'happy');
    }
    if ((m = t.match(/^(?:i feel|feel)\s+(\w+)$/))) {
      const score = MOODS[m[1]];
      if (!score) return reply('Thanks for telling me. How would you rate it: great, good, fine, meh, tired, or awful?', 'curious');
      s.moods.push({ score, word: m[1], at: now });
      if (score <= 2) return reply(SAFETY, 'worried');
      return reply('Glad to hear it.', 'happy');
    }
    if (/^(help|commands|what can you do)$/.test(t)) {
      return reply('Try: good morning · add task call mum · tasks · done 2 · add shopping milk, eggs · bought milk · goal learn guitar 20 steps · step 1 · goals · drank 2 glasses · water · I feel tired · note remember the key');
    }
    if (/^(hi|hello|hey|hiya)\b/.test(t)) return reply('Hi! I am Buddy. Say "good morning" for your day, or type help.');
    return reply(`I did not understand "${raw.slice(0, 40)}". Type help to see what I can do.`, 'confused');
  }

  /** Summary numbers for the home screen. */
  function summary(state, now) {
    const s = migrate(state);
    const open = s.tasks.filter((x) => !x.done).length;
    const done = s.tasks.filter((x) => x.done).length;
    const shop = s.shopping.filter((x) => !x.done).length;
    const ml = s.water[dayKey(now)] || 0;
    const last = s.moods[s.moods.length - 1];
    const goalsOpen = s.goals.filter((g) => !g.done);
    const goalPct = s.goals.length ? Math.round((s.goals.filter((g) => g.done).length / s.goals.length) * 100) : 0;
    return { openTasks: open, doneTasks: done, shopping: shop, waterMl: ml, waterGoalMl: WATER_GOAL_ML,
             mood: last ? last.word : null, completion: s.tasks.length ? Math.round((done / s.tasks.length) * 100) : 0,
             goalsOpen: goalsOpen.length, goalPct };
  }

  /** Last write wins, by the `updated` stamp. */
  function pickNewer(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    return Date.parse(remote.updated) > Date.parse(local.updated) ? remote : local;
  }

  const api = { emptyState, migrate, handle, summary, pickNewer, normalise, localDay, WATER_GOAL_ML, WATER_GLASS_ML, SAFETY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BuddyLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
