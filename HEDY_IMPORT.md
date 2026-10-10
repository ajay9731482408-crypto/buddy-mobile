# Plan: import Hedy action items into Buddy

Status: PLAN ONLY. Not built, not tested against the live Hedy server. Read this with the Hedy help pages, which can change.

## Goal
Meeting action items (to-dos) from Hedy appear as Buddy tasks, once, with the meeting name as their source. Transcripts and summaries are NOT imported.

## What is known (from Hedy's public help pages)
- Server: `https://api.hedy.bot/mcp` (MCP over HTTP). Needs a Hedy Pro subscription.
- Sign-in: OAuth 2.1. Authorization URL `https://api.hedy.bot/mcp/oauth/authorize`; token URL `https://api.hedy.bot/mcp/oauth/token`.
- Scopes listed: `mcp.sessions.read`, `mcp.highlights.read`, `mcp.todos.read`, `mcp.topics.read`. Buddy asks only for `mcp.todos.read`.
- Protected-resource metadata: `https://api.hedy.bot/mcp/.well-known/oauth-protected-resource`.
- The server offers tools to list to-dos, including completed ones.

## Unknowns to check first (do this before coding)
1. Exact tool name for to-dos and its input and output fields. Do not hard-code it: call `tools/list` at runtime and pick the to-do tool by its description.
2. Whether the token endpoint supports PKCE and refresh tokens, and how long tokens last.
3. Whether to-dos have stable IDs (needed for "no duplicates").
4. Current rate limits.

## Design

### Worker (worker.js, still one file)
- `GET /hedy/start`: creates a PKCE verifier and state, stores them with a 10-minute expiry, redirects to the Hedy authorization URL with `scope=mcp.todos.read`. Requires the sync secret, so only your phone can start it.
- `GET /hedy/callback`: checks `state`, exchanges the code at the token URL using the verifier, stores the refresh token encrypted with a key held in a Worker secret (`HEDY_ENC_KEY`). Never stores the access token.
- `POST /hedy/todos`: refreshes the access token if needed, calls `tools/list`, then the to-do tool, and returns a list of `{id, text, done, meeting, due}` only. Limits: 100 items per call.
- `POST /hedy/disconnect`: deletes the stored refresh token.

### Phone (app)
- Settings → **Meeting import** card. Switch **Import Hedy action items** is OFF by default.
- Buttons: **Connect Hedy** (opens `/hedy/start`), **Import now**, **Disconnect**.
- Import maps each to-do to a task with `source: 'hedy'`, `hedyId`, and text "meeting name: item". Duplicates are skipped by `hedyId`. Completed to-dos are marked done locally only if the user chooses that option.
- Nothing is imported in the background. Import happens only when the user taps **Import now**.

### Data kept
- Stored by the Worker: the encrypted refresh token only.
- Stored on the phone: the imported task text, source label and Hedy id.
- Not stored: transcripts, summaries, highlights, recordings.

## Tests to write first (golden style)
- Import maps a to-do to exactly one task, and a second import adds nothing.
- Completed to-dos are skipped unless the option is on.
- A missing or expired token gives a plain "Connect Hedy again" message.
- The Worker never returns the refresh token or the access token to the phone.
- `/hedy/*` routes refuse requests without the sync secret.
- The OAuth state is checked, and an unknown state is rejected.

## Risks
- Hedy may change its API or sign-in rules. The app should fail with a plain message, not crash.
- Meeting content is sensitive. Import stays opt-in, and the switch explains what is read.
- Token storage is the main security risk: keep `HEDY_ENC_KEY` only in Worker secrets, and rotate it if it leaks.

## Steps for you (once the build is approved)
1. Confirm you have a Hedy Pro subscription, and that you are happy for Buddy to read your to-dos.
2. Register Buddy with Hedy, if Hedy requires an app registration for OAuth. Check its help pages for this.
3. Add `HEDY_ENC_KEY` (a random 32-byte value) to the Worker secrets.
4. Redeploy the Worker. Turn on the Meeting import switch in Settings, then tap Connect Hedy.

## Build order
1. Confirm the unknowns above with a short live test on your own account.
2. Write the golden tests.
3. Build the Worker routes, then the phone mapping, then the Settings card.
4. Test with your account. Then update START_HERE.md with the steps above.
