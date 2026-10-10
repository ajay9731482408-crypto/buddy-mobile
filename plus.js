/* Buddy Mobile: the extra abilities (reminders, habits, routines, reviews, skills, insights, calendar, share,
   smart merge). Wraps logic.js: it tries its own commands first, then falls back to the base commands,
   and records an activity log so reviews, insights and skill levels have real data. Pure, testable in Node. */
(function (root) {
  'use strict';
  const L = (typeof require !== 'undefined') ? require('./logic.js') : root.BuddyLogic;
  const DAY = 86400000;
  const LOG_CAP = 2000;

  function migrate(s) {
    const b = L.migrate(s);
    return Object.assign(b, {
      reminders: Array.isArray(b.reminders) ? b.reminders : [],
      habits: Array.isArray(b.habits) ? b.habits : [],
      routines: b.routines && typeof b.routines === 'object' ? b.routines : {},
      activity: Array.isArray(b.activity) ? b.activity : [],
      checkins: Array.isArray(b.checkins) ? b.checkins : [],
      notified: Array.isArray(b.notified) ? b.notified : [],
    });
  }
  const clone = (s) => JSON.parse(JSON.stringify(s));
  const day = (t) => L.localDay(t);
  const iso = (t) => new Date(t).toISOString();

  /* ---------- time words: "18:00", "6pm", "6 30 pm", "in 30 minutes", "tomorrow 9" ---------- */
  function parseWhen(text, now) {
    const t = text.toLowerCase();
    let m = t.match(/^in\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b/);
    if (m) {
      const mins = Number(m[1]) * (/^h/.test(m[2]) ? 60 : 1);
      return { at: now + mins * 60000, rest: text.slice(m[0].length).trim() };
    }
    let tomorrow = false, rest = t.replace(/^(at|on)\s+/, '');
    if (/^tomorrow\b/.test(rest)) { tomorrow = true; rest = rest.replace(/^tomorrow\s*/, ''); }
    m = rest.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/);
    if (!m) return null;
    let h = Number(m[1]); const min = Number(m[2] || 0);
    if (m[3] === 'pm' && h < 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    const d = new Date(now); d.setHours(h, min, 0, 0);
    if (tomorrow) d.setDate(d.getDate() + 1);
    else if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return { at: d.getTime(), rest: text.slice(text.length - rest.slice(m[0].length).length).trim() };
  }

  /* ---------- activity log: every real action is recorded once ---------- */
  function diffActivity(before, after, now) {
    const out = [];
    const bDone = new Set(before.tasks.filter((x) => x.done).map((x) => x.id));
    for (const x of after.tasks) if (x.done && !bDone.has(x.id)) out.push({ kind: 'task', at: now });
    for (const g of after.goals) {
      const old = before.goals.find((x) => x.id === g.id);
      const steps = g.progress - (old ? old.progress : 0);
      for (let i = 0; i < steps; i++) out.push({ kind: 'goal', at: now });
    }
    for (const d of Object.keys(after.water)) {
      const add = (after.water[d] || 0) - (before.water[d] || 0);
      if (add > 0) out.push({ kind: 'water', at: now, ml: add });
    }
    const bShop = new Set(before.shopping.filter((x) => x.done).map((x) => x.id));
    for (const x of after.shopping) if (x.done && !bShop.has(x.id)) out.push({ kind: 'list', at: now });
    if (after.moods.length > before.moods.length) out.push({ kind: 'mood', at: now });
    return out;
  }
  function logActivity(s, entries) {
    for (const e of entries) s.activity.push(e);
    if (s.activity.length > LOG_CAP) s.activity = s.activity.slice(-LOG_CAP);
  }

  /* ---------- habits and streaks ---------- */
  function streak(habit, now) {
    // step back one calendar day at a time, so daylight-saving changes do not break a streak
    let n = 0, d = new Date(now);
    while (habit.log.indexOf(day(d.getTime())) !== -1) { n++; d = new Date(d.getTime()); d.setDate(d.getDate() - 1); }
    return n;
  }

  /* ---------- skill levels: from the activity log ---------- */
  function skills(s) {
    const count = (k) => s.activity.filter((a) => a.kind === k).length;
    const rows = [
      { id: 'tasks', name: 'Getting things done', n: count('task') },
      { id: 'goals', name: 'Reaching goals', n: count('goal') },
      { id: 'water', name: 'Looking after yourself', n: count('water') },
      { id: 'lists', name: 'Staying organised', n: count('list') },
      { id: 'habits', name: 'Building habits', n: count('habit') },
    ];
    return rows.map((r) => {
      const level = Math.floor(Math.sqrt(r.n));          // level 1 at 1 action, 2 at 4, 3 at 9, ...
      const next = (level + 1) * (level + 1);
      return Object.assign(r, { level, nextAt: next, pct: Math.round((r.n - level * level) / (next - level * level) * 100) });
    });
  }

  /* ---------- insights: last 7 days ---------- */
  function insights(s, now) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = day(now - i * DAY);
      days.push({
        day: d,
        tasks: s.activity.filter((a) => a.kind === 'task' && day(a.at) === d).length,
        goalSteps: s.activity.filter((a) => a.kind === 'goal' && day(a.at) === d).length,
        waterMl: s.water[d] || 0,
        habits: s.habits.filter((h) => h.log.indexOf(d) !== -1).length,
      });
    }
    return days;
  }

  /* ---------- weekly review (plain words) ---------- */
  function weeklyReview(s, now) {
    const week = insights(s, now);
    const tasks = week.reduce((a, d) => a + d.tasks, 0), steps = week.reduce((a, d) => a + d.goalSteps, 0);
    const water = week.reduce((a, d) => a + d.waterMl, 0) / 7;
    // mood times are stored as text by the base logic, and as numbers by this module: compare as numbers
    const at = (m) => (typeof m.at === 'string' ? Date.parse(m.at) : m.at);
    const moods = s.moods.filter((m) => now - at(m) < 7 * DAY);
    const avg = moods.length ? (moods.reduce((a, m) => a + m.score, 0) / moods.length) : null;
    const best = week.slice().sort((a, b) => (b.tasks + b.goalSteps) - (a.tasks + a.goalSteps))[0];
    const lines = [
      'Your week in review:',
      `• Tasks finished: ${tasks}`,
      `• Goal steps: ${steps}`,
      `• Water: about ${Math.round(water)} ml a day`,
      avg === null ? '• Mood: no check-ins this week' : `• Mood: ${avg >= 4 ? 'mostly good' : avg >= 3 ? 'steady' : 'a hard week'}`,
    ];
    if (best && best.tasks + best.goalSteps > 0) lines.push(`• Your best day was ${best.day}.`);
    lines.push(tasks + steps > 0 ? 'Well done. Pick one small thing for next week.' : 'A quiet week. Start with one small task tomorrow.');
    return lines.join('\n');
  }

  /* ---------- what should I do now? ---------- */
  function nextAction(s, now) {
    const soon = s.reminders.filter((r) => !r.done && r.at >= now).sort((a, b) => a.at - b.at)[0];
    if (soon && soon.at - now < 3 * 3600000) return `Next up: "${soon.text}" at ${new Date(soon.at).toTimeString().slice(0, 5)}.`;
    const goal = s.goals.filter((g) => !g.done).sort((a, b) => (b.progress / b.target) - (a.progress / a.target))[0];
    if (goal) return `Move "${goal.title}" forward: say "step ${goal.id}".`;
    const task = s.tasks.find((t) => !t.done);
    if (task) return `Start with task #${task.id}: ${task.text}.`;
    return 'Nothing urgent. Take a short walk, drink a glass of water, or start a goal.';
  }

  /* ---------- reminders that are due (checked by the app every minute) ---------- */
  function dueReminders(s, now) {
    return s.reminders.filter((r) => !r.done && r.at <= now && s.notified.indexOf(r.id) === -1);
  }

  /* ---------- calendar file (.ics) for reminders ---------- */
  function ics(s, now) {
    const esc = (x) => String(x).replace(/\\/g, '\\\\').replace(/[;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const stamp = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Buddy Mobile//EN', 'CALSCALE:GREGORIAN'];
    for (const r of s.reminders.filter((x) => !x.done)) {
      lines.push('BEGIN:VEVENT', `UID:buddy-${r.id}@buddy-mobile`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(r.at)}`,
        `DTEND:${stamp(r.at + 30 * 60000)}`, `SUMMARY:${esc(r.text)}`, 'BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(r.text)}`, 'END:VALARM', 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /* ---------- share link (WhatsApp uses a normal web link; no account needed) ---------- */
  function shareLink(text) { return 'https://wa.me/?text=' + encodeURIComponent(String(text).slice(0, 1500)); }

  /* ---------- merge two phones without losing either phone's new items ---------- */
  function mergeStates(a, b) {
    const A = migrate(a), B = migrate(b);
    const newer = Date.parse(B.updated) > Date.parse(A.updated) ? B : A, older = newer === A ? B : A;
    const out = clone(newer);
    const lists = ['tasks', 'shopping', 'notes', 'goals', 'reminders', 'habits', 'moods', 'checkins'];
    for (const k of lists) {
      const map = new Map();
      for (const it of older[k]) map.set(String(it.id ?? it.at ?? JSON.stringify(it)), it);
      for (const it of newer[k]) map.set(String(it.id ?? it.at ?? JSON.stringify(it)), it);   // newer wins on the same id
      out[k] = Array.from(map.values());
    }
    out.water = Object.assign({}, older.water, newer.water, Object.fromEntries(Object.keys(older.water).map((d) => [d, Math.max(older.water[d], newer.water[d] || 0)])));
    const seen = new Set(); out.activity = [];
    for (const e of [...older.activity, ...newer.activity]) { const key = e.kind + '|' + e.at; if (!seen.has(key)) { seen.add(key); out.activity.push(e); } }
    out.routines = Object.assign({}, older.routines, newer.routines);
    out.nextId = Math.max(A.nextId, B.nextId, ...out.tasks.map((x) => x.id + 1), ...out.goals.map((x) => x.id + 1), ...out.shopping.map((x) => x.id + 1), ...out.notes.map((x) => x.id + 1), ...out.reminders.map((x) => x.id + 1), ...out.habits.map((x) => x.id + 1));
    out.updated = newer.updated;
    // which reminders THIS phone has already announced is per phone: always keep the local list
    out.notified = A.notified.slice();
    return out;
  }

  /* ---------- commands ---------- */
  function tryPlus(state, text, now) {
    const s = clone(migrate(state));
    const raw = String(text || '').trim().slice(0, 500);
    const t = raw.toLowerCase().replace(/[.!?]+$/, '');
    const id = () => { const n = s.nextId; s.nextId = n + 1; return n; };
    const done = (msg, mood) => ({ state: Object.assign(s, { updated: iso(now) }), reply: msg, mood: mood || 'happy' });
    let m;
    if ((m = t.match(/^remind me\s+(.+)$/))) {
      const body = raw.slice(raw.length - m[1].length);
      const w = parseWhen(body, now);
      if (!w) return done('Tell me when, for example: "remind me at 18:00 to call mum" or "remind me in 30 minutes to stretch".', 'confused');
      const what = w.rest.replace(/^(to|that|about)\s+/i, '').trim();
      if (!what) return done('What should I remind you about?', 'confused');
      if (w.at <= now + 30000) return done('That time has already passed. Give me a time in the future.', 'confused');
      if (w.at > now + 366 * 86400000) return done('I can only remind you within the next year.', 'confused');
      const r = { id: id(), text: what.slice(0, 200), at: w.at, done: false };
      s.reminders.push(r);
      return done(`Reminder set for ${new Date(w.at).toTimeString().slice(0, 5)}: ${r.text}`, 'excited');
    }
    if ((m = t.match(/^snooze reminder\s*#?(\d+)(?:\s+(\d{1,3}))?$/))) {
      const r = s.reminders.find((x) => x.id === Number(m[1]));
      if (!r || r.done) return done('I cannot find that reminder.', 'confused');
      const mins = m[2] ? Math.max(1, Number(m[2])) : 10;
      r.at = now + mins * 60000;
      s.notified = s.notified.filter((id) => id !== r.id);   // it rings again when the new time comes
      return done(`Snoozed for ${mins} minutes: ${r.text}`, 'happy');
    }
    if (/^(reminders|my reminders|list reminders)$/.test(t)) {
      const open = s.reminders.filter((r) => !r.done).sort((a, b) => a.at - b.at);
      return done(open.length ? 'Reminders:\n' + open.map((r) => `#${r.id} ${new Date(r.at).toTimeString().slice(0, 5)} ${r.text}`).join('\n') : 'No reminders set.');
    }
    if ((m = t.match(/^(?:done|cancel)\s+reminder\s*#?(\d+)$/))) {
      const r = s.reminders.find((x) => x.id === Number(m[1]));
      if (!r) return done('I cannot find that reminder.', 'confused');
      r.done = true; return done(`Reminder done: ${r.text}`, 'excited');
    }
    if ((m = t.match(/^habit\s*:?\s+(.+)$/))) {
      const name = raw.slice(raw.length - m[1].length).slice(0, 80);
      const h = { id: id(), name, log: [] };
      s.habits.push(h);
      return done(`Habit added: ${name}. Say "did ${name}" each day to build a streak.`, 'excited');
    }
    if ((m = t.match(/^(?:did|done)\s+habit\s+(.+)$/)) || (m = t.match(/^did\s+(.+)$/))) {
      const name = m[1].trim().toLowerCase();
      const h = s.habits.find((x) => x.name.toLowerCase() === name || x.name.toLowerCase().indexOf(name) !== -1);
      if (!h) return null;     // not a habit we know: treat it as ordinary talk
      const d = day(now);
      if (h.log.indexOf(d) === -1) h.log.push(d);
      const n = streak(h, now);
      return done(`${h.name}: ${n} day${n === 1 ? '' : 's'} in a row.`, n >= 3 ? 'excited' : 'happy');
    }
    if (/^(habits|streaks|my habits)$/.test(t)) {
      if (!s.habits.length) return done('No habits yet. Try: habit study 30 minutes.', 'curious');
      return done('Your habits:\n' + s.habits.map((h) => `${h.name}: ${streak(h, now)} day streak`).join('\n'));
    }
    if ((m = t.match(/^save routine\s+([a-z ]+?)\s*:\s*(.+)$/))) {
      const cmds = raw.slice(raw.length - m[2].length).split(';').map((x) => x.trim()).filter(Boolean).slice(0, 10);
      if (!cmds.length) return done('Give the steps separated by semicolons.', 'confused');
      s.routines[m[1].trim()] = cmds;
      return done(`Routine "${m[1].trim()}" saved with ${cmds.length} step${cmds.length === 1 ? '' : 's'}.`, 'excited');
    }
    if ((m = t.match(/^(?:run routine|routine)\s+([a-z ]+)$/))) {
      const name = m[1].trim(), cmds = s.routines[name];
      if (!cmds) return done(`No routine called "${name}". Save one with "save routine ${name}: step one; step two".`, 'confused');
      // each step runs in order on the state the previous step left behind, and every change is kept
      let cur = s; const outs = [];
      for (const c of cmds) { const r = handleAll(cur, c, now); outs.push(r.reply); cur = r.state; }
      return { state: cur, reply: outs.join('\n'), mood: 'happy' };
    }
    if (/^(what should i do now|what now|what next|next|what should i do)$/.test(t)) return done(nextAction(s, now));
    if (/^(weekly review|review|my week|week review)$/.test(t)) return done(weeklyReview(s, now));
    if (/^(skills|my skills|levels)$/.test(t)) {
      return done('Your skills:\n' + skills(s).map((k) => `${k.name}: level ${k.level} (${k.pct}% to level ${k.level + 1})`).join('\n'));
    }
    if (/^(insights|stats|progress)$/.test(t)) {
      return done('Last 7 days:\n' + insights(s, now).map((d) => `${d.day.slice(5)}: ${d.tasks} tasks, ${d.goalSteps} steps, ${d.waterMl} ml`).join('\n'));
    }
    if (/^(calendar|export calendar|download calendar)$/.test(t)) {
      return done(s.reminders.filter((r) => !r.done).length ? 'Use "Download calendar" in Settings → Your data to save your reminders to your calendar.' : 'No reminders to add to the calendar yet.');
    }
    if ((m = t.match(/^check in\s*:?\s*(.*)$/))) {
      const note = raw.slice(raw.length - m[1].length).slice(0, 300) || 'Checked in';
      s.checkins.push({ at: now, note });
      return done('Thanks for checking in. I have noted how your day went.', 'happy');
    }
    return null;
  }

  function handleAll(state, text, now) {
    const before = migrate(state);
    const mine = tryPlus(state, text, now);
    // the base logic works with ISO timestamps (text); this module works with milliseconds (numbers)
    const r = mine || L.handle(state, text, iso(now));
    const after = migrate(r.state);
    logActivity(after, diffActivity(before, after, now));
    if (!mine && /^(share|share list|send)\b/i.test(String(text).trim())) {
      const sum = L.summary(after, now);
      r.reply = `Summary to share:\n${sum.openTasks} open tasks, ${sum.shopping} to buy, ${Math.round(sum.waterMl / 250)} glasses today.`;
      r.share = shareLink(r.reply);
    }
    r.state = after;
    return r;
  }

  const api = { migrate, handleAll, parseWhen, dueReminders, ics, shareLink, mergeStates, nextAction, weeklyReview, skills, insights, streak, logActivity, diffActivity };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BuddyPlus = api;
})(typeof window !== 'undefined' ? window : globalThis);
