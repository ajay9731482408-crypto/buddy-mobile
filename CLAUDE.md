# Buddy Mobile: instructions for AI coding assistants

Read this before changing anything. The same text is in AGENTS.md for other assistants.

## What this project is
Buddy is a phone companion: tasks, goals, reminders, habits, shopping, notes, water, mood, and an optional agent and voice. It is a static web app (plain HTML, CSS and JavaScript, no framework, no build step), with an optional Cloudflare Worker (worker.js) for sync, the agent and voice.

## Commands
- Run all tests: `npm test` (must stay green; 155 tests, no network needed).
- Try the app locally: `python3 -m http.server 8080`, then open http://localhost:8080.
- Check syntax of every file: `for f in *.js *.mjs; do node --check "$f"; done`

## Layout (flat on purpose: the phone upload flattens folders)
- index.html: all screens and styles (design system at the top of the style block).
- app.js: wiring for screens, buttons and the chat. Uses element IDs from index.html; never rename an ID without updating app.js.
- logic.js: core commands (tasks, lists, goals, water, mood). plus.js: reminders, habits, routines, reviews, calendar, merge. Both are pure and tested.
- agent.js: the agent's instructions, tool checks, and the tool loop. worker.js: the only server file (sync, agent, voice, storage). Deploy it as ONE file: never add imports to it.
- avatar.js, notch.js, voice.js, vfx.js, icons.js, cloud.js, kokoro-voice.js: UI and voice helpers.
- sw.js: offline cache list. Every new script must be added to SHELL there, and the version string must be bumped.
- *.test.mjs and evals/golden.test.mjs: tests. Golden tests are real conversations with expected results.

## Rules when you change code
1. Add or change a test before changing behaviour. Run `npm test`.
2. Keep the offline cache in step: add new files to sw.js SHELL and bump `const V`.
3. Never put API keys, tokens or the sync secret in any file. Keys belong in Cloudflare Worker secrets.
4. Keep the agent safe: tools are defined only in worker.js; the phone re-checks every tool input; there is no delete tool; do not add tools that touch other apps.
5. Keep corners on the nested-radius rule (outer = inner + padding) and motion inside the existing duration scale.
6. Do not add third-party code without checking its licence. Buddy is published on Vercel, so network-use licences (such as AGPL) apply.
7. Keep user data on the phone unless the user turns on cloud sync. Never send data anywhere new without a visible switch that is off by default.

## Before you finish a change
- `npm test` passes.
- Syntax checks pass.
- Every script loaded by index.html is listed in sw.js.
- DESIGN.md and START_HERE.md are updated if the behaviour a user sees has changed.
