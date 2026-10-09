# Buddy Mobile

Buddy is a companion for your phone. It keeps your **tasks, goals, reminders, habits, shopping and notes**, tracks **water and mood**, and answers simple commands by **text or voice**. It works offline once it has loaded, installs to your home screen, and can keep a copy of your data in **Cloudflare** so another phone can load it.

- Works in any modern phone browser (Chrome, Edge, Safari)
- No account needed to use it. Your data stays on your phone unless you turn on cloud sync
- Can be hosted on Vercel, GitHub Pages or Cloudflare Pages. Check each provider's current free-plan terms before you rely on them

---

## Contents
1. [Try it on your computer](#1-try-it-on-your-computer)
2. [Put it on the internet with Vercel (recommended)](#2-put-it-on-the-internet-with-vercel-recommended)
3. [Install it on your phone](#3-install-it-on-your-phone)
4. [Turn on cloud sync (optional)](#4-turn-on-cloud-sync-optional)
5. [Talk to Buddy](#5-talk-to-buddy)
6. [Settings](#6-settings)
7. [Privacy and safety](#7-privacy-and-safety)
8. [Troubleshooting](#8-troubleshooting)
9. [Tests](#9-tests)
10. [Project layout](#10-project-layout)
11. [Limits](#11-limits)

---

## 1. Try it on your computer

You need Node.js 18 or newer for the tests, and any simple web server for the app.

```bash
cd buddy-mobile
python3 -m http.server 8080        # or: npx serve .
```

Open `http://localhost:8080` in your browser. (Windows: use `py -m http.server 8080` if `python3` is not found.)

The app needs `https` on the internet to install and to work offline. `localhost` is fine for trying it.

---

## 2. Put it on the internet with Vercel (recommended)

Buddy Mobile is a static site (plain HTML, CSS and JavaScript). Vercel needs no build step for it. The included `vercel.json` sets caching and security headers.

### Option A: dashboard, from GitHub (no command line)
1. **Put the project on GitHub.** Create a repository (for example `buddy-mobile`) and upload the files, or push them with `git`. The `.vercelignore` file keeps the test and Worker folders out of the live site.
2. **Import it.** Go to **vercel.com/new**, sign in, and choose **Import** next to your repository. If you can't see it, use **Adjust GitHub App Permissions** to allow access.
3. **Set the project options.**
   - **Framework Preset:** `Other`
   - **Build Command:** leave empty (switch on the override if it is filled in)
   - **Output Directory:** leave empty, or `.`
   - **Root Directory:** leave as `./` if the repository holds only Buddy. If the repository holds other projects too, choose the `buddy-mobile` folder here.
4. **Click Deploy.** When it finishes you get an address such as `https://buddy-mobile.vercel.app`. Open it to check.
5. **Future updates:** every push to your main branch deploys again automatically. Pull requests get their own preview address.

### Option B: command line (uses the Vercel CLI)
```bash
cd buddy-mobile
npx vercel@latest          # first run: log in, link the project, deploy a preview
npx vercel@latest --prod   # publish the production address
```
If you prefer no login prompts, create a token in your Vercel account settings and set it as `VERCEL_TOKEN` before running the command.

### Keep the address in sync with cloud sync
If you use the cloud copy (section 4), set your **ALLOWED_ORIGIN** in the Cloudflare Worker to your Vercel address, for example:

```
https://buddy-mobile.vercel.app
```

Use no slash at the end. If you also use preview addresses, list them separated by commas. Browsers only accept the Worker's answers for addresses on that list, so the app will fail with a clear message from any other address.

### Other free hosts
- **GitHub Pages:** repository → Settings → Pages → deploy from the `main` branch, folder `/` (root). The address is `https://YOUR-NAME.github.io/buddy-mobile/`. Ignore `vercel.json`; GitHub Pages does not use it.
- **Cloudflare Pages:** create a Pages project, upload the folder or connect the repository, with no build command and output folder `/`.

---

## 3. Install it on your phone

The app must be opened from its `https` address first.

- **Android (Chrome):** open the address, then menu ⋮ → **Add to Home screen** (or **Install app**).
- **iPhone (Safari):** open the address, then Share → **Add to Home Screen**.

After that Buddy opens full screen, like an app. The first visit downloads the app so it can work offline later.

---

## 4. Turn on cloud sync (optional)

Cloud sync keeps a copy of your data on Cloudflare. Use it to move your data to a new phone, or to keep two phones in step. Your phone copy is always the first copy, and nothing is removed from your phone when you sync.

You need a free Cloudflare account. Use **method A**. It works on phones in every browser.

### Method A: your own sync Worker (recommended)
1. **Create storage.** Cloudflare dashboard → **Storage & Databases** (or **Workers & Pages**) → **KV** → **Create a namespace**. Name it `buddy-mobile`.
2. **Create the Worker.** **Workers & Pages** → **Create** → **Create Worker**. Name it `buddy-sync` and click **Deploy**. Then **Edit code**, delete the sample code, paste the whole of `worker/worker.js`, and **Deploy**.
3. **Connect the storage.** In the Worker, go to **Settings → Bindings → Add → KV namespace**. Variable name: `BUDDY_KV`. Namespace: `buddy-mobile`. Save.
4. **Set two secrets.** **Settings → Variables and Secrets → Add**:
   - `SYNC_SECRET`: a random text of at least 24 characters. Make one with `openssl rand -base64 24`, or any password generator. This is the text you type into the app. Keep it private.
   - `ALLOWED_ORIGIN`: your app's address, for example `https://buddy-mobile.vercel.app` (see section 2).
   Click **Deploy** again so the changes take effect.
5. **Connect the app.** In Buddy, open **Settings** (the gear icon) and find **Cloudflare cloud storage**. Choose **My sync Worker**. Enter the Worker address (for example `https://buddy-sync.YOUR-NAME.workers.dev`) and your sync secret. Tap **Save settings**, then **Test connection**.
6. **Use it.** **Save to cloud** sends your data up. **Load from cloud** merges the cloud copy with your phone. Nothing from either phone is lost, and an item that exists on both is not duplicated. Once cloud is ready, the app also saves to the cloud a few seconds after each change.

### Method B: Cloudflare API token (direct)
This calls Cloudflare's API straight from the browser. Some browsers block that, so use method A if this fails.
1. Create a token with **Workers KV Storage: Edit**, limited to your account (Cloudflare → **My Profile → API Tokens**).
2. Find your **Account ID** and your KV **namespace ID**.
3. In Buddy's settings choose **Cloudflare API token**, enter the three values, and use **Test connection**.

### Forgetting a token
**Forget token** removes the token and cloud settings from this phone. Your phone data is kept.

---

## 5. Talk to Buddy

Type into the chat on **Home**, tap a shortcut chip, or tap the **mic** and speak. Buddy answers in words and, if you turn it on, out loud.

| Say or type | What happens |
|---|---|
| `good morning` | A short briefing: open tasks, shopping, water and your top goal |
| `what now` | The next thing to do: a reminder, a goal, or a task |
| `weekly review` | Tasks, goal steps, water and mood for the week, in plain words |
| `add task call mum` · `tasks` · `done 2` | Tasks: add, list, finish by number |
| `remind me at 18:00 to call mum` | A reminder at 18:00 (or the next 18:00) |
| `remind me in 30 minutes to stretch` | A reminder in 30 minutes |
| `remind me tomorrow 9am to take tablets` | A reminder for tomorrow morning |
| `reminders` · `done reminder 3` | List reminders, or finish one |
| `add shopping milk, eggs` · `shopping` · `bought milk` | The shopping list |
| `note remember the gate code` | A quick note |
| `goal learn guitar 20 steps` | A goal with a number of steps |
| `step 1` · `step 1 5` | Add one step, or five, to goal number 1 |
| `goals` | Your goals and progress |
| `habit study 30 minutes` · `did study 30 minutes` · `habits` | Habits and streaks (consecutive days) |
| `drank 2 glasses` · `water` | Water in glasses, counted against 2000 ml a day |
| `I feel tired` (great, good, fine, meh, tired, awful) | A mood check-in. Low moods get a gentle reply |
| `check in: a short note about today` | A daily note on how the day went |
| `save routine morning: good morning; drank 1 glass` · `run routine morning` | A routine: several commands, run in order |
| `skills` · `insights` | Skill levels, and the last 7 days |
| `share` | A summary you can send by the phone's share menu or WhatsApp |
| `help` | The list of commands |

Words are understood in several ways: `todo`, `completed`, `buy` and `cups` all work. Only the first word of a message is changed, so the words of your own tasks and notes stay exactly as you typed them.

**Reminders** are announced while the app is open. The app checks every 30 seconds, announces each reminder once, and shows it as a message, with a tone and a buzz if those are on. Reminders do **not** ring when the app is fully closed (see section 11).

**Calendar:** Settings → **Download calendar (.ics)** saves your open reminders to a file your calendar app can open.

**Weekly review:** Settings → **Weekly review** (or the chip on Home).

---

## 6. Settings

Open the gear icon at the top right.

- **Voice:** turn on or off Buddy speaking its replies, and the mic. Choose a voice and a speed. **Test Buddy's voice** plays a sample.
- **Look and feel:** four themes (Night, Teal, Warm, Light), **Ambient effects** (soft floating light), **Calm mode** (no movement at all), and **Sounds and vibration**.
- **Plan and share:** calendar file, share summary, weekly review, and your skill levels.
- **Cloud storage:** section 4.
- **Your data:** **Export a copy** saves a backup file. **Clear everything on this phone** removes the data from this phone only, after a confirmation.

Theme, voice and effect settings are kept on each phone and are not synced, so each phone keeps its own look.

**Voice input** needs Chrome, Edge or Safari. Chrome and Edge send the spoken words to Google to be turned into text. If your browser has no voice, use typing; the app says so.

---

## 7. Privacy and safety

- **Your data is on your phone.** It lives in your browser's local storage. Nothing is sent anywhere unless you turn on cloud sync.
- **Cloud data** is stored in your own Cloudflare account, behind your own sync secret. Only your Worker can read it.
- **Secrets:** the sync secret and any API token are kept for this browser session only, unless you tick **Remember it on this phone**. On a shared phone, leave that off. Never paste them in chat or post them online.
- **Speech:** voice input is handled by the browser (see above). Buddy's own answers are written by the app; no language model is used in this version.
- **Health:** Buddy is not a medical service. Its mood replies are general support only. If you feel unsafe, contact someone you trust or your local emergency number.
- The app sends no advertising and no tracking. It uses no analytics.

---

## 8. Troubleshooting

| Problem | What to do |
|---|---|
| The Vercel address shows **404 Not Found** | Check **Root Directory** in the Vercel project. It must be the folder that contains `index.html` (or `./` if the repository contains only Buddy). Redeploy. |
| The app looks old after an update | Reload once while online. The app always asks for the newest files first, and uses its saved copy only when you are offline. |
| "Could not reach your Buddy Worker" | Check the Worker address starts with `https://` and the Worker is deployed. Check the internet connection. |
| "The Worker refused this app address" | Your app address is not on the Worker's **ALLOWED_ORIGIN** list. Add it exactly, with `https://` and no slash at the end. |
| "The sync secret is wrong" | The text in the app must match `SYNC_SECRET` in the Worker, exactly. |
| "The Worker's storage binding BUDDY_KV is missing" | Add the KV binding (section 4, step 3) and deploy again. |
| "Could not reach Cloudflare" (method B) | Your browser blocks the direct API calls. Use method A instead. |
| Microphone does nothing | Allow the microphone for this site in your browser settings. Use Chrome, Edge or Safari, and open the `https` address. |
| No spoken replies | Check **Hear Buddy reply** is on. Some phones have few voices; try another in Settings → Voice. |
| Reminder did not sound | The app must be open for reminders to fire (section 11). Check the reminder time with `reminders`. |
| "This phone is out of storage space" | Export a copy (Settings → Your data), then clear some old data. |

---

## 9. Tests

```bash
npm test
```

This runs 58 tests without any network connection:
- commands and the data rules (tasks, lists, goals, water, mood, habits, reminders, routines, reviews, skills, calendar file, sharing)
- the Cloudflare storage client, including the messages for common errors
- the sync Worker's security rules (secret, origin, data checks, storage binding)
- a two-phone sync run through the real Worker code
- a crash test with 2,000 random and hostile inputs
- regression tests for the bugs found in the full check (time zones, safe sync, per-phone reminders, merged task status)

---

## 10. Project layout

```
index.html            the screens (open this, or host the folder)
app.js                screens, toggles, voice, reminders and wiring
logic.js              commands, goals, water, mood and the rule for which copy wins
plus.js               reminders, habits, routines, reviews, skills, calendar, share, two-phone merge
voice.js              speech input and output (Web Speech API)
vfx.js                ambient particle effect (capped, paused in the background)
icons.js              one SVG icon set
cloud.js              cloud storage client (sync Worker, and direct API)
worker/worker.js      the sync Worker, deployed on Cloudflare
sw.js                 offline support (caches the app shell)
manifest.webmanifest  home-screen install settings and shortcuts
vercel.json           Vercel caching and security headers
.vercelignore         keeps tests and the Worker out of the live site
icons/                app icons
docs/RESOURCES.md     sources and design rules
docs/ROADMAP.md       what is built, what is tested, and what is still to do
test/                 tests
```

---

## 11. Limits

- **Reminders ring only while the app is open.** Reminders when the app is closed need push notifications from a server, which is not part of this version.
- **Voice quality** depends on the voices your phone has. Some phones sound more natural than others.
- **No language model yet.** Buddy answers from fixed rules. A conversation with a language model, a natural cloud voice and goal planning are listed in `docs/ROADMAP.md`, with what each needs.
- **Not yet connected to other services:** Google Calendar, Google Tasks, Notion, email, weather and news. Each needs its own sign-in or key.
- **Tested here:** the logic, the sync, the Worker's rules and the screens in a phone-sized browser. Not tested here: a live Vercel deployment, a live Cloudflare Worker, the microphone and spoken voice on a real phone, and installing to a home screen. Try those on your phone first.
